// src/systems/physics.js
// Per spec §2 rule 1: THIS IS THE ONLY FILE THAT CALLS scene.matter.*

const MIN_REST_LEN = 4;
const SNAP_ABS_PX  = 8;

const physics = {
  _scene: null,
  _nodes: new Map(),       // jointId -> Matter.Body (small circle)
  _beamConstraints: [],    // [{ constraint, material }]
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
        ...this._beamConstraints.map(b => b.constraint),
      ];
      if (this._vehicle) {
        toRemove.push(this._vehicle.chassis, ...this._vehicle.wheels);
      }
      this._scene.matter.world.remove(toRemove);
    }
    this._nodes.clear();
    this._beamConstraints.length = 0;
    this._bodySnapshots.clear();
    this._vehicle = null;
    this._pendingSnaps = this._pendingSnaps || [];
    this._pendingSnaps.length = 0;
    this._lastStaggerAt = 0;
    this._cascadeActiveUntil = 0;
  },

  // Build a small circle "joint node" body. Returns the body.
  ensureJointNode(jointId, x, y, isAnchor) {
    if (this._nodes.has(jointId)) return this._nodes.get(jointId);
    const body = this._scene.matter.add.circle(x, y, 4, {
      isStatic: !!isAnchor,
      label: isAnchor ? 'anchor' : 'joint',
      collisionFilter: { category: 0x0002, mask: 0x0000 }, // BRIDGE category, no collisions with vehicle yet
      render: { fillStyle: isAnchor ? '#ff3b3b' : '#9b6b3a' },
    });
    this._nodes.set(jointId, body);
    return body;
  },

  // Build a beam constraint between two joint bodies. Returns the constraint.
  buildBeam(bodyA, bodyB, material) {
    const dx = bodyA.position.x - bodyB.position.x;
    const dy = bodyA.position.y - bodyB.position.y;
    const length = Math.hypot(dx, dy);

    const constraint = this._scene.matter.add.constraint(bodyA, bodyB, length, material.stiffness, {
      damping: 0.05,
    });
    // Stash material + history on the constraint for stress reading.
    constraint.material = material;
    constraint._stressHistory = [];
    this._beamConstraints.push({ constraint, material });
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
      this._scene.matter.world.remove(constraint);
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

  spawnVehicle(config) {
    if (!this._scene) return null;
    const { spawnAt, weight } = config;
    const spawnX = spawnAt === 'left' ? 200 : 1080;
    const spawnY = 340;

    // Chassis
    const chassis = this._scene.matter.add.rectangle(spawnX, spawnY, 80, 24, {
      label: 'vehicle-chassis',
      collisionFilter: { category: 0x0001, mask: 0xFFFF & ~0x0002 }, // collide with all but BRIDGE
      density: weight / (80 * 24 * 100), // tune by feel; spec §7.3 deferred
    });

    // Two wheels with low-stiffness suspension constraints (spec §3.1, §7.3)
    const wheelOffsets = [{ dx: -28, dy: 14 }, { dx: 28, dy: 14 }];
    const wheels = [];
    for (const off of wheelOffsets) {
      const wheel = this._scene.matter.add.circle(spawnX + off.dx, spawnY + off.dy, 12, {
        label: 'vehicle-wheel',
        friction: 0.95,
        density: 0.05,
      });
      this._scene.matter.add.constraint(chassis, wheel,
        Math.hypot(off.dx, off.dy), 0.5, { damping: 0.2 }); // stiffness 0.5 per spec §7.3
      wheels.push(wheel);
    }

    this._vehicle = { chassis, wheels, config };
    return this._vehicle;
  },

  driveVehicle() {
    if (!this._vehicle) return;
    const force = this._vehicle.config.spawnAt === 'left' ? 0.02 : -0.02;
    this._scene.matter.body.applyForce(
      this._vehicle.chassis,
      this._vehicle.chassis.position,
      { x: force, y: 0 }
    );
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

export default physics;
