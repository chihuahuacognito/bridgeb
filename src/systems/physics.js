// src/systems/physics.js
// Per spec §2 rule 1: THIS IS THE ONLY FILE THAT CALLS scene.matter.*

const MIN_REST_LEN = 4;
const SNAP_ABS_PX  = 8;

const physics = {
  _scene: null,
  _nodes: new Map(),       // jointId -> Matter.Body (small circle)
  _beamConstraints: [],    // [{ constraint, material }]
  _bodySnapshots: new Map(),

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
