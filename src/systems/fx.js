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
