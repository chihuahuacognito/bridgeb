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

export const DUST_MIN = 4;    // dust puff particles at landing power 0
export const DUST_MAX = 14;   // dust puff particles at landing power 1
export const SPARK_COUNT = 10; // shards per snap spark (fixed — snaps read uniform)

const DROPLET_KEY = 'fx-droplet';
const SHARD_KEY   = 'fx-shard';

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

// Pure: dust puff count scaled by landing power (mirror emitParams).
export function dustParams(power) {
  const p = clamp01(power);
  const count = Math.round(DUST_MIN + (DUST_MAX - DUST_MIN) * p);
  return { count };
}

const fx = {
  _scene: null,
  _splashEmitter: null,
  _dustEmitter: null,
  _sparkEmitter: null,

  attach(scene) {
    this._scene = scene;
    this._ensureTextures(scene);
    // Order matters: splash, dust, spark (tests index emitters by creation order).
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

    // Dust — low, slow tan puff that drifts up a touch and fades fast.
    this._dustEmitter = scene.add.particles(0, 0, DROPLET_KEY, {
      emitting: false,
      tint: 0xc8b48c,             // tan
      speed: { min: 20, max: 70 },
      angle: { min: 230, max: 310 }, // up-and-out, shallow
      lifespan: { min: 200, max: 450 },
      gravityY: 80,
      scale: { start: 0.7, end: 1.4 }, // puff spreads as it fades
      alpha: { start: 0.7, end: 0 },
      maxParticles: 80,
    }).setDepth(6);

    // Spark — brief, fast yellow-white shards that fall under gravity.
    this._sparkEmitter = scene.add.particles(0, 0, SHARD_KEY, {
      emitting: false,
      tint: 0xfff2a0,             // yellow-white
      speed: { min: 120, max: 280 },
      angle: { min: 0, max: 360 }, // burst in all directions
      lifespan: { min: 180, max: 380 },
      gravityY: 500,
      scale: { start: 1.0, end: 0.2 },
      maxParticles: 80,
    }).setDepth(6);
  },

  detach() {
    this._splashEmitter?.destroy();
    this._dustEmitter?.destroy();
    this._sparkEmitter?.destroy();
    this._splashEmitter = null;
    this._dustEmitter = null;
    this._sparkEmitter = null;
    this._scene = null;
  },

  reset() {
    // Clear in-flight particles so they don't bleed across build<->test transitions.
    this._splashEmitter?.killAll?.();
    this._dustEmitter?.killAll?.();
    this._sparkEmitter?.killAll?.();
  },

  splash(x, y, power) {
    if (!this._scene || !this._splashEmitter) return;
    const { count } = emitParams(power);
    this._splashEmitter.explode(count, x, y);
    this._ripple(x, y, power);
    audio.playSplash();
  },

  dust(x, y, power) {
    if (!this._scene || !this._dustEmitter) return;
    this._dustEmitter.explode(dustParams(power).count, x, y);
  },

  spark(x, y) {
    if (!this._scene || !this._sparkEmitter) return;
    this._sparkEmitter.explode(SPARK_COUNT, x, y);
  },

  _ripple(x, y, power) {
    const s = this._scene;
    const radius = 28 + 36 * (power < 0 ? 0 : power > 1 ? 1 : power);
    const g = s.add.graphics({ x, y }).setDepth(-45); // above water fill(-50), below terrain
    g.lineStyle(2, 0x9fd8ff, 0.85);
    g.strokeCircle(0, 0, radius);
    g.setScale(0.2);
    s.tweens.add({
      targets: g, scale: 1, alpha: 0, duration: 480, ease: 'Cubic.out',
      onComplete: () => g.destroy(),
    });
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
    if (!scene.textures.exists(SHARD_KEY)) {
      // Small white triangle (~6px) for sparks/victory shards.
      const g = scene.add.graphics();
      g.fillStyle(0xffffff, 1);
      g.fillTriangle(3, 0, 6, 6, 0, 6);
      g.generateTexture(SHARD_KEY, 6, 6);
      g.destroy();
    }
  },
};

export default fx;
