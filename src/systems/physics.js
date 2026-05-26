// src/systems/physics.js
// Per spec §2 rule 1: THIS IS THE ONLY FILE THAT CALLS scene.matter.*

// Collision categories:
//   0x0001 VEHICLE  — chassis and wheels
//   0x0002 JOINT    — joint-circle bodies (no-collision; just constraint endpoints)
//   0x0004 BEAM     — beam rectangle bodies (the collision surface)
//   0x0008 WORLD    — canyon walls and other static geometry
//
// Masks:
//   chassis = 0xFFFF & ~0x0002  — collide with everything except joints (kept from plan)
//   wheel   = default (0xFFFFFFFF) — collide with everything
//   joint   = 0x0000            — collide with nothing (unchanged)
//   beam    = 0x0001            — collide ONLY with vehicle (so beams don't collide with walls/each other)
//   wall    = 0xFFFF            — collide with everything except joints (joints have mask=0)
//
// Beam bodies share group = -1 so adjacent beams sharing a joint don't shove each other.

const MIN_REST_LEN = 4;
const SNAP_ABS_PX  = 8;
// 6px overhang per end (12px junction overlap) so wheel radius-10 circles never
// fall through the seam between two kinematic road segments at a mid-joint.
// Chassis mask now excludes beams (~0x0004) so only wheels contact road;
// without overlap those 10px wheels can slip through a zero-width junction.
const BEAM_OVERHANG = 6;

// Visual strain saturation point: the stretch ratio at which the visual
// stress signal reads 1.0. Independent of material.snapThreshold so future
// snap tuning doesn't break the visualization.
// Calibrated to match road snapThreshold (0.065) so the colour progression
// covers the full sag range before snap: MED green at ~25px sag, HIGH yellow
// at ~40px, CRIT red at ~53px, snap at ~56px on a typical 150px half-span.
let VISUAL_FULL_STRAIN = 0.05;

const physics = {
  _scene: null,
  _nodes: new Map(),       // jointId -> Matter.Body (small circle)
  _beamConstraints: [],    // [{ constraint, material, body, attachA, attachB }]
  _canyonBodies: [],
  _bodySnapshots: new Map(),
  _pendingSnaps: [],
  _lastStaggerAt: 0,
  _cascadeActiveUntil: 0,
  _onSnapCallback: null,

  attach(scene) {
    this._scene = scene;
    // Reposition kinematic beam bodies before each physics step so they track
    // the live joint positions without being dynamic (and therefore rotatable).
    this._beforeUpdateCb = () => this._updateKinematicBeams();
    scene.matter.world.on('beforeupdate', this._beforeUpdateCb);
  },

  detach(_scene) {
    if (this._scene && this._beforeUpdateCb) {
      this._scene.matter.world.off('beforeupdate', this._beforeUpdateCb);
    }
    this._beforeUpdateCb = null;
    this.reset();
    this._scene = null;
  },

  reset() {
    if (this._scene) {
      const toRemove = [
        ...this._nodes.values(),
        ...this._canyonBodies,
      ];
      for (const b of this._beamConstraints) {
        toRemove.push(b.constraint);
        if (b.body) toRemove.push(b.body);
        if (b.attachA) toRemove.push(b.attachA);
        if (b.attachB) toRemove.push(b.attachB);
      }
      if (this._vehicle) {
        toRemove.push(this._vehicle.chassis);
        if (this._vehicle.wheelA) toRemove.push(this._vehicle.wheelA, this._vehicle.wheelB);
        if (this._vehicle.axleA)  toRemove.push(this._vehicle.axleA,  this._vehicle.axleB);
      }
      this._scene.matter.world.remove(toRemove);
    }
    this._nodes.clear();
    this._beamConstraints.length = 0;
    this._canyonBodies.length = 0;
    this._bodySnapshots.clear();
    this._vehicle = null;
    this._pendingSnaps = this._pendingSnaps || [];
    this._pendingSnaps.length = 0;
    this._lastStaggerAt = 0;
    this._cascadeActiveUntil = 0;
  },

  // Build a small circle "joint node" body. Returns the body.
  //
  // Mid-joints get density 0.05 (mass ≈ 2.5) so they have enough inertia to
  // resist being yanked downward by the car's weight via the beam attach
  // constraints. Default Matter density would give mass ≈ 0.05 — 900× lighter
  // than the car, which made joints plummet and the car fall through.
  // Anchors are static so density has no effect on them.
  ensureJointNode(jointId, x, y, isAnchor) {
    if (this._nodes.has(jointId)) return this._nodes.get(jointId);
    const body = this._scene.matter.add.circle(x, y, 4, {
      isStatic: !!isAnchor,
      label: isAnchor ? 'anchor' : 'joint',
      density: 0.10,
      collisionFilter: { category: 0x0002, mask: 0x0000 }, // BRIDGE category, no collisions with vehicle yet
      render: { fillStyle: isAnchor ? '#ff3b3b' : '#9b6b3a' },
    });
    this._nodes.set(jointId, body);
    return body;
  },

  // Create static collision bodies for terrain walls. Called once from LevelScene
  // after physics.attach. Idempotent: clears existing bodies first.
  buildTerrain(terrainData) {
    if (!this._scene) return;
    if (this._canyonBodies.length > 0) {
      this._scene.matter.world.remove(this._canyonBodies);
      this._canyonBodies.length = 0;
    }
    for (const side of [terrainData.left, terrainData.right]) {
      const { x, y, width, height } = side.physRect;
      const body = this._scene.matter.add.rectangle(x, y, width, height, {
        isStatic: true,
        label: 'terrain',
        friction: 0.6,
        collisionFilter: { category: 0x0008, mask: 0xFFFF },
      });
      this._canyonBodies.push(body);
    }
  },

  // Build static collision bodies for rocks. Must be called after buildTerrain,
  // once per scene lifecycle. Pushes bodies into _canyonBodies so reset() clears them.
  buildRocks(rocks) {
    if (!this._scene) return;
    for (const rock of rocks) {
      const { x, y, width, height } = rock.physRect;
      const body = this._scene.matter.add.rectangle(x, y, width, height, {
        isStatic: true,
        label: 'rock',
        friction: 0.6,
        collisionFilter: { category: 0x0008, mask: 0xFFFF },
      });
      this._canyonBodies.push(body);
      for (const anchor of (rock.anchors ?? [])) {
        this.ensureJointNode(anchor.id, anchor.x, anchor.y, true);
      }
    }
  },

  // A beam is:
  //   1. A stress constraint between the two joint nodes (measures separation,
  //      drives the snap logic — unchanged from plan).
  //   2. A rectangle collision body lying along the beam — what wheels roll on.
  //      If both endpoints are static anchors, the body is static too: rigid
  //      plank, no attach constraints needed. Otherwise the body is dynamic
  //      and pinned to both joints via stiff zero-length constraints so it
  //      tracks them as the bridge flexes. The dynamic path uses a thicker,
  //      heavier body to resist wheel tunneling and impulse pushback.
  buildBeam(bodyA, bodyB, material) {
    const dx = bodyB.position.x - bodyA.position.x;
    const dy = bodyB.position.y - bodyA.position.y;
    const length = Math.hypot(dx, dy);
    const angle = Math.atan2(dy, dx);
    const midX = (bodyA.position.x + bodyB.position.x) / 2;
    const midY = (bodyA.position.y + bodyB.position.y) / 2;
    const bothStatic = bodyA.isStatic && bodyB.isStatic;

    // (1) Stress constraint between joints — unchanged behavior.
    const constraint = this._scene.matter.add.constraint(
      bodyA, bodyB, length, material.stiffness, { damping: 0.08 }
    );
    constraint.material = material;
    constraint._stressHistory = [];
    constraint._critSinceMs = -1; // ms timestamp when stress first hit ≥ 1.0; -1 = not at crit

    // (2) Collision body. Static plank if anchor-to-anchor (cheapest, perfect
    // collision surface, zero pushback). Otherwise dynamic with stiff pins.
    //
    // The body is shifted perpendicular-down by thickness/2 so its TOP edge
    // (not its centerline) lies along the joint-to-joint line. Without this,
    // the beam protrudes T/2 above the anchor and the vehicle wheels hit a
    // curb when transitioning wall → beam.
    //   perp-down direction (in screen coords, +y is down): (-sin θ, cos θ)
    const thickness = bothStatic ? 10 : 30;
    const perpDownX = -Math.sin(angle);
    const perpDownY = Math.cos(angle);
    const beamCenterX = midX + perpDownX * (thickness / 2);
    const beamCenterY = midY + perpDownY * (thickness / 2);

    // All beam bodies are static. Anchor-to-anchor beams never move so static
    // is exact. Non-anchor beams are kinematic: _updateKinematicBeams()
    // repositions them before every physics step to track the live joint
    // positions. This avoids dynamic bodies, which rotate under vehicle torque
    // regardless of how many constraint iterations are used.
    //
    // Non-anchor bodies are BEAM_OVERHANG px wider than joint-to-joint length
    // on each end so adjacent beams overlap at junctions, closing the gap the
    // vehicle would otherwise fall through at each mid-joint.
    // Road segments get a kinematic collision body (vehicle drives on them).
    // Beam segments (structural) get no collision body — they brace road joints
    // via the stress constraint only. Vehicle cannot land on a beam.
    const isRoad = material.type === 'road';
    let beamBody = null;
    if (isRoad) {
      const bodyLength = bothStatic ? length : length + 2 * BEAM_OVERHANG;
      beamBody = this._scene.matter.add.rectangle(beamCenterX, beamCenterY, bodyLength, thickness, {
        label: 'beam',
        angle,
        isStatic: true,
        friction: 0.6,
        restitution: 0,
        collisionFilter: { category: 0x0004, mask: 0x0001, group: -1 },
      });
    }

    this._beamConstraints.push({
      constraint, material, body: beamBody,
      attachA: null, attachB: null,
      kinematic: !bothStatic,
      type: material.type,
      // Track current body width so _updateKinematicBeams can resize it as beams stretch.
      _scaledLength: (!bothStatic && isRoad) ? (length + 2 * BEAM_OVERHANG) : null,
    });
    return constraint;
  },

  beamCount() {
    return this._beamConstraints.length;
  },

  isAnchor(body) {
    return body.isStatic && body.label === 'anchor';
  },

  // Disconnect a beam at runtime (called by cascade in Task 8)
  removeBeam(constraint) {
    if (!this._scene) return;
    const idx = this._beamConstraints.findIndex(b => b.constraint === constraint);
    if (idx === -1) return;
    const entry = this._beamConstraints[idx];
    const toRemove = [entry.constraint];
    if (entry.body)    toRemove.push(entry.body);
    if (entry.attachA) toRemove.push(entry.attachA);
    if (entry.attachB) toRemove.push(entry.attachB);
    this._scene.matter.world.remove(toRemove);
    this._beamConstraints.splice(idx, 1);
  },

  // Capture rollback snapshot. Spec §3.15.
  captureSnapshot() {
    this._bodySnapshots.clear();
    const Matter = this._scene.matter; // wrapper; we use raw Matter only here
    for (const body of this._nodes.values()) {
      this._bodySnapshots.set(body, {
        position: { x: body.position.x, y: body.position.y },
        velocity: { x: body.velocity.x, y: body.velocity.y },
      });
    }
  },

  // NaN watchdog soft-restart (spec §3.15)
  softRestart() {
    if (!this._scene) return;
    this._scene.matter.world.engine.timing.timeScale = 1.0;
    const Matter = this._scene.matter;
    for (const [body, snap] of this._bodySnapshots) {
      Matter.body.setPosition(body, snap.position);
      Matter.body.setVelocity(body, { x: 0, y: 0 });
    }
  },

  tickWatchdog() {
    for (const body of this._nodes.values()) {
      if (body.isStatic) continue;
      if (Number.isNaN(body.position.x) || Number.isNaN(body.position.y)) {
        this.softRestart();
        return true;
      }
    }
    return false;
  },

  // ---- Seam-rule wrappers (the ONLY way scene/system code touches the engine) ----

  setRunnerEnabled(enabled) {
    if (this._scene) {
      this._scene.matter.world.enabled = enabled;
      this._scene.matter.world.runner.enabled = enabled; // belt-and-suspenders; safe and harmless
    }
  },

  getTimeScale() {
    return this._scene ? this._scene.matter.world.engine.timing.timeScale : 1.0;
  },

  setTimeScale(scale) {
    if (this._scene) this._scene.matter.world.engine.timing.timeScale = scale;
  },

  freezeVehicle() {
    if (!this._scene || !this._vehicle) return;
    const { chassis, wheelA, wheelB } = this._vehicle;
    this._scene.matter.body.setStatic(chassis, true);
    if (wheelA) {
      this._scene.matter.body.setStatic(wheelA, true);
      this._scene.matter.body.setStatic(wheelB, true);
    }
  },

  removeVehicle() {
    if (!this._scene || !this._vehicle) return;
    const { chassis, wheelA, wheelB, axleA, axleB } = this._vehicle;
    const toRemove = [chassis];
    if (wheelA) toRemove.push(wheelA, wheelB);
    if (axleA)  toRemove.push(axleA, axleB);
    this._scene.matter.world.remove(toRemove);
    this._vehicle = null;
  },

  spawnVehicle(config) {
    if (!this._scene) return null;
    const { spawnAt } = config;
    const spawnX = spawnAt === 'left' ? 240 : 1040;
    const spawnY = 320;
    const WHEEL_R   = 10;
    const WHEEL_X   = 26; // ±px from chassis centre
    const CHASSIS_H = 12; // half-height of chassis rectangle

    // Chassis does not contact road beams — wheels do.
    // group -2 prevents chassis↔wheel self-collision.
    const chassis = this._scene.matter.add.rectangle(spawnX, spawnY, 80, 24, {
      label: 'vehicle-chassis',
      density: config.density ?? 0.008,
      restitution: 0,
      friction: 0,
      chamfer: { radius: 6 },
      collisionFilter: { category: 0x0001, mask: 0xFFFF & ~0x0002 & ~0x0004, group: -2 },
    });

    // Wheels spawn at chassis-bottom corners so the zero-length axle constraints
    // start at rest length and produce no initial jolt.
    const wheelOpts = {
      label: 'vehicle-wheel',
      density: 0.003,
      friction: 0.8,
      frictionStatic: 0.5,
      restitution: 0,
      collisionFilter: { category: 0x0001, mask: 0xFFFF & ~0x0002, group: -2 },
    };
    const wheelY  = spawnY + CHASSIS_H;
    const wheelA  = this._scene.matter.add.circle(spawnX + WHEEL_X, wheelY, WHEEL_R, wheelOpts);
    const wheelB  = this._scene.matter.add.circle(spawnX - WHEEL_X, wheelY, WHEEL_R, wheelOpts);

    // Zero-length, stiffness-1 constraints act as rigid axles.
    const axleA = this._scene.matter.add.constraint(chassis, wheelA, 0, 1,
      { pointA: { x:  WHEEL_X, y: CHASSIS_H }, pointB: { x: 0, y: 0 } });
    const axleB = this._scene.matter.add.constraint(chassis, wheelB, 0, 1,
      { pointA: { x: -WHEEL_X, y: CHASSIS_H }, pointB: { x: 0, y: 0 } });

    this._vehicle = { chassis, wheelA, wheelB, axleA, axleB, config };
    return this._vehicle;
  },

  driveVehicle() {
    if (!this._vehicle) return;
    const { chassis, config } = this._vehicle;
    const dir      = config.spawnAt === 'left' ? 1 : -1;
    const maxSpeed = config.driveSpeed ?? 3;
    const gain     = config.driveForceGain ?? 0.001;
    const vx       = chassis.velocity.x;

    // Apply a proportional drive force toward target speed. Only push — never
    // brake — so the car coasts freely on downslopes past maxSpeed. On steep
    // uphills the force is insufficient to overcome gravity and the car stalls.
    if (dir * vx < maxSpeed) {
      this._scene.matter.body.applyForce(chassis, chassis.position, {
        x: dir * (maxSpeed - dir * vx) * gain,
        y: 0,
      });
    }

    // Damp angular velocity rather than zeroing it. Hard-zeroing prevented the
    // chassis from tipping its nose at slope junctions, causing it to stall
    // at every peak node. Heavy damping (30% retained) still prevents spinning
    // while allowing enough rotation to navigate angle transitions.
    this._scene.matter.body.setAngularVelocity(chassis, chassis.angularVelocity * 0.3);
  },

  getDebugInfo() {
    if (!this._vehicle) return null;
    const chassis = this._vehicle.chassis;
    const vx = chassis.velocity.x;
    const vy = chassis.velocity.y;
    const speed = Math.hypot(vx, vy);
    const angleDeg = chassis.angle * 180 / Math.PI;
    const angVelDeg = chassis.angularVelocity * 180 / Math.PI;

    const dir = this._vehicle.config.spawnAt === 'left' ? 1 : -1;
    const maxSpeed = this._vehicle.config.driveSpeed ?? 3;
    const gain = this._vehicle.config.driveForceGain ?? 0.001;
    const driveForce = (dir * vx < maxSpeed)
      ? dir * (maxSpeed - dir * vx) * gain
      : 0;

    // Per-tick acceleration from previous frame's velocity
    const prevVx = this._vehicle._dbgPrevVx ?? vx;
    const prevVy = this._vehicle._dbgPrevVy ?? vy;
    this._vehicle._dbgPrevVx = vx;
    this._vehicle._dbgPrevVy = vy;
    const accelX = vx - prevVx;
    const accelY = vy - prevVy;
    const accel  = Math.hypot(accelX, accelY) * Math.sign(accelX * dir);

    // Nearest beam slope angle
    const carX = chassis.position.x, carY = chassis.position.y;
    let slopeDeg = null, closestDist = Infinity;
    for (const b of this._beamConstraints) {
      if (!b.kinematic) continue;
      const ax = b.constraint.bodyA.position.x, ay = b.constraint.bodyA.position.y;
      const bx = b.constraint.bodyB.position.x, by = b.constraint.bodyB.position.y;
      const dx = bx - ax, dy = by - ay;
      const lenSq = dx * dx + dy * dy;
      if (lenSq < 1) continue;
      const t = Math.max(0, Math.min(1, ((carX - ax) * dx + (carY - ay) * dy) / lenSq));
      const dist = Math.hypot(carX - (ax + t * dx), carY - (ay + t * dy));
      if (dist < closestDist) {
        closestDist = dist;
        slopeDeg = Math.atan2(dy, dx) * 180 / Math.PI;
      }
    }

    return { vx, vy, speed, angleDeg, angVelDeg, driveForce, accel, slopeDeg, closestDist };
  },

  getVehicleChassisPosition() {
    return this._vehicle ? this._vehicle.chassis.position : null;
  },

  readStressNormalized(c) {
    const cur = Math.hypot(
      c.bodyA.position.x - c.bodyB.position.x,
      c.bodyA.position.y - c.bodyB.position.y
    );
    if (c.length === 0) {
      const raw = c.stiffness * cur / SNAP_ABS_PX;
      return Math.min(1, Math.max(0, raw / c.material.snapThreshold));
    }
    const denom = Math.max(c.length, MIN_REST_LEN);
    // No stiffness factor: snapThreshold is directly "snap at X% stretch".
    // Including c.stiffness made snap require ~200% stretch — physically impossible.
    const raw = Math.abs(cur - c.length) / denom;
    return Math.min(1, Math.max(0, raw / c.material.snapThreshold));
  },

  readStressSmoothed(c) {
    const raw = this.readStressNormalized(c);
    c._stressHistory.push(raw);
    if (c._stressHistory.length > 5) c._stressHistory.shift();
    let sum = 0;
    for (const s of c._stressHistory) sum += s;
    return sum / c._stressHistory.length;
  },

  // Visual-only strain reader. Returns [0, 1] based on |Δlength|/restLength,
  // saturating at VISUAL_FULL_STRAIN. Distinct from readStressNormalized,
  // which is normalized against material.snapThreshold for the snap mechanic.
  readStrainVisual(c) {
    const cur = Math.hypot(
      c.bodyA.position.x - c.bodyB.position.x,
      c.bodyA.position.y - c.bodyB.position.y
    );
    const rest = Math.max(c.length, MIN_REST_LEN);
    const ratio = Math.abs(cur - rest) / rest;
    return Math.min(1, ratio / VISUAL_FULL_STRAIN);
  },

  setVisualFullStrain(v) { VISUAL_FULL_STRAIN = v; },

  setGravity(y) {
    if (this._scene) this._scene.matter.world.setGravity(0, y);
  },

  // Live-update stiffness and snapThreshold on all existing beam constraints.
  updateBeamMaterial(stiffness, snapThreshold) {
    for (const b of this._beamConstraints) {
      b.constraint.stiffness = stiffness;
      b.material.stiffness = stiffness;
      b.material.snapThreshold = snapThreshold;
    }
  },

  setOnSnap(cb) { this._onSnapCallback = cb; },

  // Called once per tick (from LevelScene.update during test mode).
  evaluateStress(nowMs, timeScale = 1.0) {
    // How long a constraint must stay at full stress before it snaps.
    // Gives the player 2.5 s of visible sag + CRIT overlay before the first break.
    const SNAP_HOLD_MS = 2500;
    const STAGGER_MS = 400; // gap between cascade snaps — long enough to watch each piece fall
    const SETTLE_MS  = 200;

    // 1. READ-ONLY pass — accumulate time-at-crit; queue snap when hold expires
    for (const { constraint } of this._beamConstraints) {
      const s = this.readStressNormalized(constraint);
      if (s >= 1.0) {
        if (constraint._critSinceMs < 0) constraint._critSinceMs = nowMs;
        if (nowMs - constraint._critSinceMs >= SNAP_HOLD_MS && !this._pendingSnaps.includes(constraint)) {
          this._pendingSnaps.push(constraint);
        }
      } else {
        constraint._critSinceMs = -1; // stress recovered — reset timer
      }
    }

    // 2. Sort highest-stress first
    this._pendingSnaps.sort((a, b) =>
      this.readStressNormalized(b) - this.readStressNormalized(a)
    );

    // 3. Process one snap per stagger-tick (scaled by timeScale)
    const stagger = STAGGER_MS / Math.max(timeScale, 0.05);
    if (this._pendingSnaps.length > 0 && nowMs - this._lastStaggerAt >= stagger) {
      const head = this._pendingSnaps.shift();
      this.removeBeam(head);
      this._lastStaggerAt = nowMs;
      this._cascadeActiveUntil = nowMs + SETTLE_MS;
      if (this._onSnapCallback) this._onSnapCallback(head);

      // Re-evaluate neighbours (topological — share an endpoint with head)
      let added = 0;
      for (const { constraint } of this._beamConstraints) {
        if (added >= 5) break; // runaway-cascade guard (spec §3.7 step 4)
        const sharesEndpoint =
          constraint.bodyA === head.bodyA || constraint.bodyA === head.bodyB ||
          constraint.bodyB === head.bodyA || constraint.bodyB === head.bodyB;
        if (!sharesEndpoint) continue;
        const s = this.readStressNormalized(constraint);
        if (s >= 1.0 && !this._pendingSnaps.includes(constraint)) {
          this._pendingSnaps.push(constraint);
          added++;
        }
      }
    }
  },

  isCascadeActive(nowMs) {
    return this._pendingSnaps.length > 0 || nowMs < this._cascadeActiveUntil;
  },

  // Called on Matter 'beforeupdate' — sets kinematic beam bodies to the exact
  // position and angle derived from their joint nodes so the vehicle always
  // rolls on a stable surface regardless of how the bridge flexes.
  _updateKinematicBeams() {
    for (const b of this._beamConstraints) {
      if (!b.kinematic || !b.body) continue;
      const aPos = b.constraint.bodyA.position;
      const bPos = b.constraint.bodyB.position;
      const dx = bPos.x - aPos.x;
      const dy = bPos.y - aPos.y;
      const angle = Math.atan2(dy, dx);
      const currentDist = Math.hypot(dx, dy);
      const midX = (aPos.x + bPos.x) / 2;
      const midY = (aPos.y + bPos.y) / 2;
      const perpDownX = -Math.sin(angle);
      const perpDownY = Math.cos(angle);
      const cx = midX + perpDownX * (30 / 2);
      const cy = midY + perpDownY * (30 / 2);

      // Keep body width = currentDist + 2*BEAM_OVERHANG so the overlap is
      // maintained even when a heavy vehicle stretches the beams beyond their
      // rest length. Without this, the overhang shrinks to a gap and the tank
      // falls through the seam at every mid-joint.
      //
      // Resize by directly moving the left/right vertex X coordinates while
      // the body is temporarily horizontal (angle=0), then let setPosition +
      // setAngle re-orient and update bounds. No external Matter.Body.scale
      // call needed — those require Phaser internals that may not be accessible.
      if (b._scaledLength !== null) {
        const targetLength = currentDist + 2 * BEAM_OVERHANG;
        if (Math.abs(targetLength - b._scaledLength) > 0.5) {
          this._scene.matter.body.setAngle(b.body, 0); // horizontal so world-X = beam axis
          const hw  = targetLength / 2;
          const ocx = b.body.position.x;
          for (const v of b.body.vertices) {
            v.x = v.x < ocx ? ocx - hw : ocx + hw;
          }
          b._scaledLength = targetLength;
        }
      }

      this._scene.matter.body.setPosition(b.body, { x: cx, y: cy });
      this._scene.matter.body.setAngle(b.body, angle);
    }
  },

  // Apply the vehicle's weight as explicit downward forces on the two joint
  // nodes of whichever beam segment the vehicle is currently over. This is
  // what makes the bridge flex and beams stress-test correctly now that beam
  // bodies are static (static bodies don't propagate contact forces to joints).
  applyVehicleLoad() {
    if (!this._vehicle || !this._scene) return;
    const chassis = this._vehicle.chassis;
    const carX = chassis.position.x;
    const carY = chassis.position.y;
    const engine = this._scene.matter.world.engine;
    const weightForce = chassis.mass * engine.gravity.y * (engine.gravity.scale ?? 0.001);

    for (const b of this._beamConstraints) {
      if (!b.kinematic) continue;
      const bodyA = b.constraint.bodyA;
      const bodyB = b.constraint.bodyB;
      const ax = bodyA.position.x, ay = bodyA.position.y;
      const bx = bodyB.position.x, by = bodyB.position.y;
      const dx = bx - ax, dy = by - ay;
      const lenSq = dx * dx + dy * dy;
      if (lenSq < 1) continue;
      // Scalar projection of car position onto beam line → load-split parameter t
      const t = Math.max(0, Math.min(1, ((carX - ax) * dx + (carY - ay) * dy) / lenSq));
      // Only load beams the car is actually over (within half-car-width + overhang)
      const closestX = ax + t * dx;
      const closestY = ay + t * dy;
      const distSq = (carX - closestX) ** 2 + (carY - closestY) ** 2;
      if (distSq > 80 * 80) continue; // 80px proximity threshold
      this._scene.matter.body.applyForce(bodyA, bodyA.position, { x: 0, y: (1 - t) * weightForce });
      this._scene.matter.body.applyForce(bodyB, bodyB.position, { x: 0, y: t * weightForce });
    }
  },

  // Simulate the gravitational weight that road beam bodies would have had when
  // they were dynamic Matter.js bodies (density 0.001, thickness 30). We apply
  // half that simulated weight to each joint node so unsupported road segments
  // visibly sag and fall — restoring the "physical falling" sensation.
  applyBeamWeight() {
    if (!this._scene) return;
    const engine = this._scene.matter.world.engine;
    const gravForce = engine.gravity.y * (engine.gravity.scale ?? 0.001);
    for (const b of this._beamConstraints) {
      if (!b.kinematic) continue;
      const bodyA = b.constraint.bodyA;
      const bodyB = b.constraint.bodyB;
      const dx = bodyB.position.x - bodyA.position.x;
      const dy = bodyB.position.y - bodyA.position.y;
      const bodyLength = Math.hypot(dx, dy) + (b.body ? 2 * BEAM_OVERHANG : 0);
      const beamThickness = b.type === 'road' ? 30 : 4;
      const simulatedMass = 0.001 * bodyLength * beamThickness;
      const halfWeight = 0.5 * simulatedMass * gravForce;
      this._scene.matter.body.applyForce(bodyA, bodyA.position, { x: 0, y: halfWeight });
      this._scene.matter.body.applyForce(bodyB, bodyB.position, { x: 0, y: halfWeight });
    }
  },
};

// Named exports for testability — tests import the SAME formula impls
// that physics uses, not a duplicate. (Plan reviewer P0.)
export function readStressNormalized(constraint) {
  return physics.readStressNormalized(constraint);
}

export function readStressSmoothed(constraint) {
  return physics.readStressSmoothed(constraint);
}

export function readStrainVisual(constraint) {
  return physics.readStrainVisual(constraint);
}

export default physics;
