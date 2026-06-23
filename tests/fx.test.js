// tests/fx.test.js
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import audio from '../src/systems/audio.js';
import fx, {
  crossedWaterline, clampPower, emitParams,
  REF_SPLASH_SPEED, SPLASH_MIN_DROPLETS, SPLASH_MAX_DROPLETS,
} from '../src/systems/fx.js';

function mkAudioScene(existingKeys = []) {
  const keys = new Set(existingKeys);
  return {
    cache: { audio: { exists: (k) => keys.has(k) } },
    sound: { add: vi.fn(() => ({ play: vi.fn(), stop: vi.fn() })), play: vi.fn() },
  };
}

describe('audio.playSplash', () => {
  beforeEach(() => audio.detach());

  it('no-ops when the splash key is absent', () => {
    const scene = mkAudioScene([]);          // no 'splash'
    audio.attach(scene);
    audio.playSplash();
    expect(scene.sound.play).not.toHaveBeenCalled();
  });

  it('plays the splash sound when the key exists', () => {
    const scene = mkAudioScene(['splash']);
    audio.attach(scene);
    audio.playSplash();
    expect(scene.sound.play).toHaveBeenCalledWith('splash', expect.objectContaining({ volume: expect.any(Number) }));
  });
});

describe('crossedWaterline', () => {
  it('fires on a downward crossing only', () => {
    expect(crossedWaterline(650, 670, 660)).toBe(true);   // above -> below
    expect(crossedWaterline(670, 650, 660)).toBe(false);  // below -> above (exit)
    expect(crossedWaterline(640, 650, 660)).toBe(false);  // stays above
    expect(crossedWaterline(670, 680, 660)).toBe(false);  // stays below
  });
  it('treats touching the line as crossed', () => {
    expect(crossedWaterline(659, 660, 660)).toBe(true);
  });
});

describe('clampPower', () => {
  it('normalizes speed against the reference and clamps to 0..1', () => {
    expect(clampPower(0, REF_SPLASH_SPEED)).toBe(0);
    expect(clampPower(REF_SPLASH_SPEED, REF_SPLASH_SPEED)).toBe(1);
    expect(clampPower(REF_SPLASH_SPEED * 2, REF_SPLASH_SPEED)).toBe(1);
    expect(clampPower(REF_SPLASH_SPEED / 2, REF_SPLASH_SPEED)).toBeCloseTo(0.5);
  });
  it('returns 0 for a non-positive reference', () => {
    expect(clampPower(5, 0)).toBe(0);
  });
});

describe('emitParams', () => {
  it('scales droplet count from min (power 0) to max (power 1)', () => {
    expect(emitParams(0).count).toBe(SPLASH_MIN_DROPLETS);
    expect(emitParams(1).count).toBe(SPLASH_MAX_DROPLETS);
    const mid = emitParams(0.5).count;
    expect(mid).toBeGreaterThan(SPLASH_MIN_DROPLETS);
    expect(mid).toBeLessThan(SPLASH_MAX_DROPLETS);
  });
  it('clamps out-of-range power', () => {
    expect(emitParams(-1).count).toBe(SPLASH_MIN_DROPLETS);
    expect(emitParams(99).count).toBe(SPLASH_MAX_DROPLETS);
  });
});

function mkGraphics() {
  const g = {
    fillStyle: vi.fn(() => g), fillCircle: vi.fn(() => g), fillTriangle: vi.fn(() => g),
    lineStyle: vi.fn(() => g), strokeCircle: vi.fn(() => g),
    setDepth: vi.fn(() => g), setScale: vi.fn(() => g),
    generateTexture: vi.fn(() => g), destroy: vi.fn(() => g),
  };
  return g;
}
function mkEmitter() {
  return { setDepth: vi.fn(function () { return this; }), explode: vi.fn(), killAll: vi.fn(), destroy: vi.fn() };
}
function mkFxScene() {
  const existing = new Set();
  const scene = {
    _existing: existing,
    textures: { exists: (k) => existing.has(k) },
    add: {
      graphics: vi.fn(() => mkGraphics()),
      particles: vi.fn(() => mkEmitter()),
    },
    tweens: { add: vi.fn((cfg) => { cfg.onComplete?.(); }) },
    cache: { audio: { exists: () => false } },
    sound: { play: vi.fn() },
  };
  // generateTexture should register the key so re-attach is idempotent
  scene.add.graphics = vi.fn(() => {
    const g = mkGraphics();
    g.generateTexture = vi.fn((key) => { existing.add(key); return g; });
    return g;
  });
  return scene;
}

describe('fx lifecycle', () => {
  beforeEach(() => fx.detach());

  it('generates the droplet texture once across repeated attach', () => {
    const scene = mkFxScene();
    fx.attach(scene);
    const callsAfterFirst = scene.add.graphics.mock.calls.length;
    fx.detach();
    fx.attach(scene);                         // textures already exist now
    expect(scene.add.graphics.mock.calls.length).toBe(callsAfterFirst); // no new gen
  });

  it('creates a splash emitter on attach and destroys it on detach', () => {
    const scene = mkFxScene();
    fx.attach(scene);
    expect(scene.add.particles).toHaveBeenCalledTimes(1);
    const emitter = scene.add.particles.mock.results[0].value;
    fx.detach();
    expect(emitter.destroy).toHaveBeenCalled();
  });
});

describe('fx.splash', () => {
  beforeEach(() => fx.detach());

  it('explodes the emitter with a power-scaled count at the given point', () => {
    const scene = mkFxScene();
    fx.attach(scene);
    const emitter = scene.add.particles.mock.results[0].value;
    fx.splash(100, 660, 1);
    expect(emitter.explode).toHaveBeenCalledWith(SPLASH_MAX_DROPLETS, 100, 660);
  });

  it('draws a ripple graphic that tweens then destroys itself', () => {
    const scene = mkFxScene();
    fx.attach(scene);
    const graphicsCallsBefore = scene.add.graphics.mock.calls.length;
    fx.splash(100, 660, 0.5);
    expect(scene.add.graphics.mock.calls.length).toBe(graphicsCallsBefore + 1); // ripple graphic
    expect(scene.tweens.add).toHaveBeenCalled();
    const ripple = scene.add.graphics.mock.results.at(-1).value;
    expect(ripple.destroy).toHaveBeenCalled();   // mkFxScene tween runs onComplete synchronously
  });

  it('plays the splash sound', () => {
    const scene = mkFxScene();
    const playSpy = vi.spyOn(audio, 'playSplash');
    fx.attach(scene);
    fx.splash(100, 660, 0.5);
    expect(playSpy).toHaveBeenCalled();
    playSpy.mockRestore();
  });

  it('is a safe no-op when detached', () => {
    fx.detach();
    expect(() => fx.splash(0, 0, 1)).not.toThrow();
  });
});
