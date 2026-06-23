// src/systems/fx.js
// Seam note (Physics Iron Law): fx.js NEVER calls scene.matter.*. It only creates
// and draws scene RENDERING objects (particle emitters, graphics, tweens) — the same
// latitude juice.js has for scene.cameras. Physics-derived triggers arrive via
// callbacks surfaced by physics.js; fx never reads the physics world directly.
import audio from './audio.js';

// --- Tuning constants (initial values; tune in-app per docs/AI_CODING_GUIDE.md) ---
export const REF_SPLASH_SPEED    = 0.6;  // px/ms downward speed that reads as a full-power splash
export const SPLASH_MIN_DROPLETS = 8;    // droplets at power 0
export const SPLASH_MAX_DROPLETS = 24;   // droplets at power 1
export const SPLASH_MAX_PER_FRAME = 4;   // cascade throttle (enforced at the call site)

const DROPLET_KEY = 'fx-droplet';

const clamp01 = (n) => (n < 0 ? 0 : n > 1 ? 1 : n);

// Pure: did an entity cross the waterline going DOWN between two frames?
export function crossedWaterline(prevY, currY, waterY) {
  return prevY < waterY && currY >= waterY;
}

// Pure: normalize a downward speed to 0..1 against a reference.
export function clampPower(speed, reference) {
  if (reference <= 0) return 0;
  return clamp01(speed / reference);
}

// Pure: emit parameters scaled by power. Count drives explode(); speed/lifespan are
// baked into the emitter config at attach time, so only count varies per call.
export function emitParams(power) {
  const p = clamp01(power);
  const count = Math.round(SPLASH_MIN_DROPLETS + (SPLASH_MAX_DROPLETS - SPLASH_MIN_DROPLETS) * p);
  return { count };
}

const fx = {
  _scene: null,
  _splashEmitter: null,

  attach(scene) {
    this._scene = scene;
    this._ensureTextures(scene);
    this._splashEmitter = scene.add.particles(0, 0, DROPLET_KEY, {
      emitting: false,            // we fire bursts manually via explode()
      tint: 0x4aa3ff,             // blue (WebGL only; ignored on Canvas fallback)
      speed: { min: 60, max: 200 },
      angle: { min: 200, max: 340 }, // up-and-out cone
      lifespan: { min: 350, max: 700 },
      gravityY: 600,
      scale: { start: 0.9, end: 0.1 },
      maxParticles: 120,          // hard cap so cascades can't unbound particle count
    }).setDepth(6);               // above debris(5) and vehicle(2)
  },

  detach() {
    this._splashEmitter?.destroy();
    this._splashEmitter = null;
    this._scene = null;
  },

  reset() {
    // Clear in-flight particles so they don't bleed across build<->test transitions.
    this._splashEmitter?.killAll?.();
  },

  _ensureTextures(scene) {
    if (!scene.textures.exists(DROPLET_KEY)) {
      // Graphics has no radial gradient — fake a soft dot with concentric alpha rings.
      const g = scene.add.graphics();
      g.fillStyle(0xffffff, 0.35); g.fillCircle(8, 8, 8);
      g.fillStyle(0xffffff, 0.60); g.fillCircle(8, 8, 5);
      g.fillStyle(0xffffff, 1.00); g.fillCircle(8, 8, 3);
      g.generateTexture(DROPLET_KEY, 16, 16);
      g.destroy();
    }
  },
};

export default fx;
