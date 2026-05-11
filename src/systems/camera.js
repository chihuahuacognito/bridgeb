// src/systems/camera.js
// NOTE: Phaser's startFollow(target) requires target.x/target.y as top-level
// properties. Matter bodies expose body.position.x/y instead. We can't pass
// a raw Matter body to startFollow — so we accept a getPosition() function
// and update camera scroll manually in tick().
const cam = {
  _scene: null,
  _getPositionFn: null,
  _punchUntil: 0,

  attach(scene) {
    this._scene = scene;
  },

  detach(_scene) {
    this.reset();
    this._scene = null;
  },

  reset() {
    if (this._scene) {
      this._scene.cameras.main.setZoom(1);
      this._scene.cameras.main.stopFollow();
    }
    this._getPositionFn = null;
    this._punchUntil = 0;
  },

  // Pass a function returning {x, y}; called every tick.
  follow(getPositionFn) {
    this._getPositionFn = getPositionFn;
  },

  punchIn(x, y, nowMs) {
    if (!this._scene) return;
    this._punchUntil = nowMs + 300;
    this._scene.cameras.main.zoomTo(1.2, 200);
    this._scene.cameras.main.pan(x, y, 200);
  },

  tick(nowMs) {
    // Lerp camera toward follow target unless a punch-in is owning the camera.
    if (this._getPositionFn && this._punchUntil === 0) {
      const pos = this._getPositionFn();
      if (pos) {
        const c = this._scene.cameras.main;
        const targetX = pos.x - c.width / 2;
        const targetY = pos.y - c.height / 2;
        c.scrollX += (targetX - c.scrollX) * 0.08;
        c.scrollY += (targetY - c.scrollY) * 0.08;
      }
    }
    if (this._punchUntil > 0 && nowMs > this._punchUntil) {
      this._scene.cameras.main.zoomTo(1.0, 400);
      this._punchUntil = 0;
    }
  },
};

export default cam;
