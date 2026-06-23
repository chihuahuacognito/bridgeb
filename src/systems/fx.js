// src/systems/fx.js
// Seam note (Physics Iron Law): fx.js NEVER calls scene.matter.*. It only creates
// and draws scene RENDERING objects (particle emitters, graphics, tweens) — the same
// latitude juice.js has for scene.cameras. Physics-derived triggers arrive via
// callbacks surfaced by physics.js; fx never reads the physics world directly.
import audio from './audio.js';

// --- Tuning constants (initial values; tune in-app per docs/AI_CODING_GUIDE.md) ---
export const REF_SPLASH_SPEED    = 0.6;  // px/ms downward speed that reads as a full-power splash
export const SPLASH_MIN_DROPLETS = 14;   // droplets at power 0
export const SPLASH_MAX_DROPLETS = 40;   // droplets at power 1
export const SPLASH_MAX_PER_FRAME = 4;   // cascade throttle (enforced at the call site)

export const DUST_MIN = 8;     // dust puff particles at landing power 0
export const DUST_MAX = 24;    // dust puff particles at landing power 1
export const SPARK_COUNT = 18; // shards per snap spark (fixed — snaps read uniform)
export const SQUASH_MAX = 0.45;  // max squash/stretch fraction at landing power 1
export const VICTORY_COUNT = 44; // shards in the victory fountain

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

// Pure: squash-and-stretch multipliers for a given impact power. Squashes
// vertically (sy<1) and stretches horizontally (sx>1) to conserve apparent volume.
export function squashParams(power) {
  const k = SQUASH_MAX * clamp01(power);
  return { sx: 1 + k, sy: 1 - k };
}

const fx = {
  _scene: null,
  _splashEmitter: null,
  _dustEmitter: null,
  _sparkEmitter: null,
  _victoryEmitter: null,
  _squash: { sx: 1, sy: 1 },  // consumed by LevelScene.redrawVehicle every frame

  attach(scene) {
    this._scene = scene;
    this._ensureTextures(scene);
    // Order matters: splash, dust, spark, victory (tests index by creation order).
    // Emissive bursts use ADD blending so bright cores pop against the busy water
    // background instead of washing out (alpha-blended pale blue was near-invisible).
    this._splashEmitter = scene.add.particles(0, 0, DROPLET_KEY, {
      emitting: false,            // we fire bursts manually via explode()
      blendMode: 'ADD',
      tint: [0xffffff, 0x9fe4ff, 0x4aa3ff], // white core → cyan → blue
      speed: { min: 140, max: 380 },
      angle: { min: 200, max: 340 }, // up-and-out cone
      lifespan: { min: 450, max: 900 },
      gravityY: 700,
      scale: { start: 1.7, end: 0.0 }, // big, sharp shrink
      maxParticles: 200,          // hard cap so cascades can't unbound particle count
    }).setDepth(6);               // above debris(5) and vehicle(2)

    // Dust — billowing tan/cream puff. Alpha-blended (dust is opaque, not emissive)
    // but lighter and much bigger so it reads as a real impact cloud.
    this._dustEmitter = scene.add.particles(0, 0, DROPLET_KEY, {
      emitting: false,
      tint: [0xf3ead2, 0xd9c19a], // cream → tan
      speed: { min: 40, max: 130 },
      angle: { min: 225, max: 315 }, // up-and-out, shallow
      lifespan: { min: 300, max: 650 },
      gravityY: 60,
      scale: { start: 0.9, end: 2.6 }, // puff billows out as it fades
      alpha: { start: 0.85, end: 0 },
      maxParticles: 120,
    }).setDepth(6);

    // Spark — brief, fast, bright white-gold shards in all directions.
    this._sparkEmitter = scene.add.particles(0, 0, SHARD_KEY, {
      emitting: false,
      blendMode: 'ADD',
      tint: [0xffffff, 0xfff2a0, 0xffb24a], // white → gold → orange
      speed: { min: 220, max: 520 },
      angle: { min: 0, max: 360 }, // burst in all directions
      lifespan: { min: 220, max: 480 },
      gravityY: 600,
      scale: { start: 1.9, end: 0.0 },
      maxParticles: 140,
    }).setDepth(6);

    // Victory — big celebratory upward confetti fountain that arcs back down.
    this._victoryEmitter = scene.add.particles(0, 0, SHARD_KEY, {
      emitting: false,
      blendMode: 'ADD',
      tint: [0xffffff, 0xfff2a0, 0x9fd8ff, 0xff9ec2, 0x9bff9e], // gold/blue/pink/green
      speed: { min: 260, max: 560 },
      angle: { min: 245, max: 295 },         // upward cone
      lifespan: { min: 700, max: 1300 },
      gravityY: 650,
      scale: { start: 2.2, end: 0.0 },
      rotate: { min: 0, max: 360 },
      maxParticles: 200,
    }).setDepth(6);
  },

  detach() {
    this._splashEmitter?.destroy();
    this._dustEmitter?.destroy();
    this._sparkEmitter?.destroy();
    this._victoryEmitter?.destroy();
    this._splashEmitter = null;
    this._dustEmitter = null;
    this._sparkEmitter = null;
    this._victoryEmitter = null;
    this._squash = { sx: 1, sy: 1 };
    this._scene = null;
  },

  reset() {
    // Clear in-flight particles so they don't bleed across build<->test transitions.
    this._splashEmitter?.killAll?.();
    this._dustEmitter?.killAll?.();
    this._sparkEmitter?.killAll?.();
    this._victoryEmitter?.killAll?.();
    this._squash.sx = 1;
    this._squash.sy = 1;
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

  victory(x, y) {
    if (!this._scene || !this._victoryEmitter) return;
    this._victoryEmitter.explode(VICTORY_COUNT, x, y);
  },

  // Trigger a squash-and-stretch: snap to the squashed multiplier, then tween
  // back to neutral. redrawVehicle reads getSquash() every frame and applies it
  // (a sprite-scale tween would be stomped by redraw's setDisplaySize).
  squash(power) {
    if (!this._scene) return;
    const { sx, sy } = squashParams(power);
    this._squash.sx = sx;
    this._squash.sy = sy;
    this._scene.tweens.add({
      targets: this._squash, sx: 1, sy: 1, duration: 200, ease: 'Back.out',
    });
  },

  getSquash() { return this._squash; },

  _ripple(x, y, power) {
    const s = this._scene;
    const p = power < 0 ? 0 : power > 1 ? 1 : power;
    const radius = 40 + 60 * p;
    // Depth 6 (with the spray) so the bright ring reads over the water instead of
    // being half-hidden behind terrain; two concentric rings sell the expansion.
    const g = s.add.graphics({ x, y }).setDepth(6);
    g.lineStyle(4, 0xffffff, 0.95);
    g.strokeCircle(0, 0, radius);
    g.lineStyle(3, 0x9fe4ff, 0.7);
    g.strokeCircle(0, 0, radius * 0.6);
    g.setScale(0.15);
    s.tweens.add({
      targets: g, scale: 1.3, alpha: 0, duration: 520, ease: 'Cubic.out',
      onComplete: () => g.destroy(),
    });
  },

  _ensureTextures(scene) {
    if (!scene.textures.exists(DROPLET_KEY)) {
      // Graphics has no radial gradient — fake a soft dot with concentric alpha
      // rings around a bright solid core (the core is what reads under ADD blend).
      const g = scene.add.graphics();
      g.fillStyle(0xffffff, 0.25); g.fillCircle(12, 12, 12);
      g.fillStyle(0xffffff, 0.50); g.fillCircle(12, 12, 8);
      g.fillStyle(0xffffff, 0.85); g.fillCircle(12, 12, 5);
      g.fillStyle(0xffffff, 1.00); g.fillCircle(12, 12, 3);
      g.generateTexture(DROPLET_KEY, 24, 24);
      g.destroy();
    }
    if (!scene.textures.exists(SHARD_KEY)) {
      // Bright white shard (~10px) for sparks/victory. Solid so ADD blend pops it.
      const g = scene.add.graphics();
      g.fillStyle(0xffffff, 1);
      g.fillTriangle(5, 0, 10, 10, 0, 10);
      g.generateTexture(SHARD_KEY, 10, 10);
      g.destroy();
    }
  },
};

export default fx;
