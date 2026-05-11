// src/systems/juice.js
// Seam-rule note (spec §2 rule 1): juice.js NEVER touches scene.matter.* or
// engine.timing directly. All physics interactions route through physics.js.
import audio from './audio.js';
import physics from './physics.js';

const juice = {
  _scene: null,
  _slowMoActive: false,
  _freezeUntil: 0,

  attach(scene) {
    this._scene = scene;
  },

  detach(_scene) {
    this.reset();
    this._scene = null;
  },

  reset() {
    physics.setTimeScale(1.0);
    this._slowMoActive = false;
    this._freezeUntil = 0;
    audio.duck(false);
  },

  // Called by physics on every snap (first snap kicks slow-mo)
  onSnap(nowMs) {
    if (!this._slowMoActive) {
      this._slowMoActive = true;
      this._freezeUntil = nowMs + 50;             // 50ms freeze-frame
      // After freeze, ramp will run via tick()
    }
    this.shake(0.012, 220);
    audio.playSnap();
  },

  onCollapse() {
    this.shake(0.025, 500);
    audio.playThud();
  },

  shake(intensity, durationMs) {
    if (this._scene) this._scene.cameras.main.shake(durationMs, intensity);
  },

  tick(nowMs, cascadeActive) {
    if (!this._slowMoActive) return;
    if (nowMs < this._freezeUntil) {
      physics.setTimeScale(0);
      // Audio is suspended during freeze (spec §3.6)
      return;
    }
    // After freeze: ramp toward 0.17, hold while cascade-active, ramp back to 1.0
    const target = cascadeActive ? 0.17 : 1.0;
    const current = physics.getTimeScale();
    const lerpRate = target < current ? 0.05 : 0.025; // faster down, slower up
    const next = current + (target - current) * lerpRate;
    physics.setTimeScale(next);

    if (current > 0 && next > 0) audio.duck(next < 0.95);

    if (!cascadeActive && next > 0.99) {
      physics.setTimeScale(1.0);
      this._slowMoActive = false;
      audio.duck(false);
    }
  },
};

export default juice;
