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

// Visual strain saturation point: the stretch ratio at which the visual
// stress signal reads 1.0. Independent of material.snapThreshold so future
// snap tuning doesn't break the visualization.
const VISUAL_FULL_STRAIN = 0.4;

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
  },

  detach(_scene) {
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
        toRemove.push(b.constraint, b.body);
        if (b.attachA) toRemove.push(b.attachA);
        if (b.attachB) toRemove.push(b.attachB);
      }
      if (this._vehicle) {
        toRemove.push(this._vehicle.chassis, ...this._vehicle.wheels);
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
      density: 0.05,
      collisionFilter: { category: 0x0002, mask: 0x0000 }, // BRIDGE category, no collisions with vehicle yet
      render: { fillStyle: isAnchor ? '#ff3b3b' : '#9b6b3a' },
    });
    this._nodes.set(jointId, body);
    return body;
  },

  // Create static collision bodies for canyon walls. Called once from LevelScene
  // after physics.attach. Idempotent: clears existing canyon bodies first.
  buildCanyon(canyonData) {
    if (!this._scene) return;
    // If called twice, clear previous walls first.
    if (this._canyonBodies.length > 0) {
      this._scene.matter.world.remove(this._canyonBodies);
      this._canyonBodies.length = 0;
    }
    const { leftWall, rightWall } = canyonData;
    for (const wall of [leftWall, rightWall]) {
      const body = this._scene.matter.add.rectangle(
        wall.x, wall.y, wall.width, wall.height,
        {
          isStatic: true,
          label: 'canyon-wall',
          friction: 0.6,
          collisionFilter: { category: 0x0008, mask: 0xFFFF },
        }
      );
      this._canyonBodies.push(body);
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
      bodyA, bodyB, length, material.stiffness, { damping: 0.05 }
    );
    constraint.material = material;
    constraint._stressHistory = [];

    // (2) Collision body. Static plank if anchor-to-anchor (cheapest, perfect
    // collision surface, zero pushback). Otherwise dynamic with stiff pins.
    //
    // The body is shifted perpendicular-down by thickness/2 so its TOP edge
    // (not its centerline) lies along the joint-to-joint line. Without this,
    // the beam protrudes T/2 above the anchor and the vehicle wheels hit a
    // curb when transitioning wall → beam.
    //   perp-down direction (in screen coords, +y is down): (-sin θ, cos θ)
    const thickness = bothStatic ? 10 : 12;
    const perpDownX = -Math.sin(angle);
    const perpDownY = Math.cos(angle);
    const beamCenterX = midX + perpDownX * (thickness / 2);
    const beamCenterY = midY + perpDownY * (thickness / 2);

    const beamBody = this._scene.matter.add.rectangle(beamCenterX, beamCenterY, length, thickness, {
      label: 'beam',
      angle,
      isStatic: bothStatic,
      friction: 0.6,
      density: bothStatic ? undefined : 0.001,
      collisionFilter: { category: 0x0004, mask: 0x0001, group: -1 },
    });

    let attachA = null, attachB = null;
    if (!bothStatic) {
      // Dynamic beam: pin both ends to their joints. Attach at the TOP
      // corners of the rectangle (body-local y = -thickness/2) so the
      // joints sit at the deck surface, not the deck centerline.
      attachA = this._scene.matter.add.constraint(beamBody, bodyA, 0, 1.0, {
        pointA: { x: -length / 2, y: -thickness / 2 },
      });
      attachB = this._scene.matter.add.constraint(beamBody, bodyB, 0, 1.0, {
        pointA: { x: length / 2, y: -thickness / 2 },
      });
    }

    this._beamConstraints.push({ constraint, material, body: beamBody, attachA, attachB });
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
    if (idx >= 0) {
      const b = this._beamConstraints[idx];
      const toRemove = [b.constraint, b.body];
      if (b.attachA) toRemove.push(b.attachA);
      if (b.attachB) toRemove.push(b.attachB);
      this._scene.matter.world.remove(toRemove);
      this._beamConstraints.splice(idx, 1);
    }
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

  // Freeze the vehicle in place by making all its bodies static. Stops
  // gravity, drift, suspension oscillation, and any rotation. Used after
  // win/fail so the car holds its result-frame pose during the overlay.
  freezeVehicle() {
    if (!this._scene || !this._vehicle) return;
    const Matter = this._scene.matter;
    const v = this._vehicle;
    for (const body of [v.chassis, ...v.wheels]) {
      Matter.body.setStatic(body, true);
    }
  },

  // Remove the vehicle from the world. Used when test mode ends so the next
  // test cycle starts with a fresh spawn instead of leaking old chassis/wheels.
  removeVehicle() {
    if (!this._scene || !this._vehicle) return;
    const v = this._vehicle;
    this._scene.matter.world.remove([v.chassis, ...v.wheels]);
    this._vehicle = null;
  },

  spawnVehicle(config) {
    if (!this._scene) return null;
    const { spawnAt, weight } = config;
    // Spawn at the horizontal center of the spawn-side canyon wall so the
    // chassis (width 80) sits fully on the wall (width 80). spawnY is high
    // enough that wheel bottoms (y + 14 + 12 = y + 26) start above the wall
    // top y=360 rather than embedded in it.
    const spawnX = spawnAt === 'left' ? 240 : 1040;
    const spawnY = 320;

    // Chassis. Tuning follows the canonical matter-js car example
    // (examples/car.js): low density, free rotation. group: -2 puts chassis
    // and wheels in a shared negative group so they never collide with each
    // other — wheel bodies (dy=14, r=12) overlap the chassis bottom, and
    // without the shared group the rigid wheel pins would fight Matter's
    // penetration resolution every frame.
    const chassis = this._scene.matter.add.rectangle(spawnX, spawnY, 80, 24, {
      label: 'vehicle-chassis',
      collisionFilter: { category: 0x0001, mask: 0xFFFF & ~0x0002, group: -2 },
      density: weight / (80 * 24 * 1000), // matches reference density (~0.0002)
    });

    // Two wheels rigidly pinned to chassis-local offsets (length 0,
    // stiffness 1.0 = canonical matter-js car-axle pattern). Wheels still
    // spin freely around their own centers; the pin only constrains
    // position, not rotation. Friction 0.8 matches the reference.
    const wheelOffsets = [{ dx: -28, dy: 14 }, { dx: 28, dy: 14 }];
    const wheels = [];
    for (const off of wheelOffsets) {
      const wheel = this._scene.matter.add.circle(spawnX + off.dx, spawnY + off.dy, 12, {
        label: 'vehicle-wheel',
        friction: 0.8,
        density: 0.05,
        collisionFilter: { group: -2 },
      });
      this._scene.matter.add.constraint(chassis, wheel, 0, 1.0, {
        pointA: { x: off.dx, y: off.dy },
      });
      wheels.push(wheel);
    }

    this._vehicle = { chassis, wheels, config };
    return this._vehicle;
  },

  // Drive by spinning the wheels (the canonical matter-js car pattern). The
  // wheels grip the ground via friction; the chassis follows. Applying force
  // to the chassis center directly does NOT work — high wheel friction holds
  // the chassis in place against any reasonable drive force.
  //   ω = 0.15 rad/tick on wheel radius 12 → ~108 px/s surface speed at 60fps.
  driveVehicle() {
    if (!this._vehicle) return;
    const omega = this._vehicle.config.spawnAt === 'left' ? 0.15 : -0.15;
    const Matter = this._scene.matter;
    for (const wheel of this._vehicle.wheels) {
      Matter.body.setAngularVelocity(wheel, omega);
    }
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
    const raw = c.stiffness * Math.abs(cur - c.length) / denom;
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

  setOnSnap(cb) { this._onSnapCallback = cb; },

  // Called once per tick (from LevelScene.update during test mode).
  evaluateStress(nowMs, timeScale = 1.0) {
    const STAGGER_MS = 100;
    const SETTLE_MS  = 200;

    // 1. READ-ONLY pass — collect candidates
    for (const { constraint } of this._beamConstraints) {
      const s = this.readStressSmoothed(constraint);
      if (s >= 1.0 && !this._pendingSnaps.includes(constraint)) {
        this._pendingSnaps.push(constraint);
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
