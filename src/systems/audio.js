// src/systems/audio.js
// All sound.add / sound.play calls are guarded by scene.cache.audio.exists(key)
// so missing assets gracefully no-op. Asset sourcing is deferred (spec §3.11);
// audio assets (creak/snap/thud/ambient) are not yet present in the repo.
const audio = {
  _scene: null,
  _ambient: null,
  _creakLoops: new Map(),       // constraint -> Sound

  attach(scene) {
    this._scene = scene;
    if (scene.cache.audio.exists('ambient')) {
      this._ambient = scene.sound.add('ambient', { loop: true, volume: 0.4 });
      this._ambient.play();
    }
  },

  detach(_scene) {
    this.reset();
    this._scene = null;
  },

  reset() {
    if (this._ambient) { this._ambient.stop(); this._ambient = null; }
    for (const s of this._creakLoops.values()) s.stop();
    this._creakLoops.clear();
  },

  playSnap() {
    if (!this._scene || !this._scene.cache.audio.exists('snap')) return;
    const pitch = 1 + (Math.random() - 0.5) * 0.1; // ±5% per spec §3.11
    this._scene.sound.play('snap', { rate: pitch, volume: 0.9 });
  },

  playThud() {
    if (!this._scene || !this._scene.cache.audio.exists('thud')) return;
    this._scene.sound.play('thud', { volume: 0.8 });
  },

  startCreak(constraint, stress) {
    if (!this._scene || !this._scene.cache.audio.exists('creak') || this._creakLoops.has(constraint)) return;
    const loop = this._scene.sound.add('creak', { loop: true, volume: stress * 0.5 });
    loop.play();
    this._creakLoops.set(constraint, loop);
  },

  updateCreak(constraint, stress) {
    const loop = this._creakLoops.get(constraint);
    if (loop) loop.setVolume(stress * 0.5);
  },

  stopCreak(constraint) {
    const loop = this._creakLoops.get(constraint);
    if (loop) { loop.stop(); this._creakLoops.delete(constraint); }
  },

  duck(active) {
    if (this._ambient && this._scene) {
      this._scene.tweens.add({
        targets: this._ambient,
        volume: active ? 0.1 : 0.4,
        duration: 100,
      });
    }
  },
};

export default audio;
