// tests/fx.test.js
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import audio from '../src/systems/audio.js';
import fx, {
  crossedWaterline, clampPower, emitParams, dustParams,
  REF_SPLASH_SPEED, SPLASH_MIN_DROPLETS, SPLASH_MAX_DROPLETS,
  DUST_MIN, DUST_MAX, SPARK_COUNT,
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

  it('creates splash, dust and spark emitters on attach and destroys them on detach', () => {
    const scene = mkFxScene();
    fx.attach(scene);
    expect(scene.add.particles).toHaveBeenCalledTimes(3); // splash, dust, spark
    const emitters = scene.add.particles.mock.results.map((r) => r.value);
    fx.detach();
    for (const e of emitters) expect(e.destroy).toHaveBeenCalled();
  });
});

describe('dustParams', () => {
  it('scales puff count from min (power 0) to max (power 1)', () => {
    expect(dustParams(0).count).toBe(DUST_MIN);
    expect(dustParams(1).count).toBe(DUST_MAX);
    const mid = dustParams(0.5).count;
    expect(mid).toBeGreaterThan(DUST_MIN);
    expect(mid).toBeLessThan(DUST_MAX);
  });
  it('clamps out-of-range power', () => {
    expect(dustParams(-1).count).toBe(DUST_MIN);
    expect(dustParams(99).count).toBe(DUST_MAX);
  });
});

describe('fx.dust', () => {
  beforeEach(() => fx.detach());

  it('explodes the dust emitter with a power-scaled count at the point', () => {
    const scene = mkFxScene();
    fx.attach(scene);
    const dustEmitter = scene.add.particles.mock.results[1].value; // splash[0], dust[1], spark[2]
    fx.dust(100, 540, 1);
    expect(dustEmitter.explode).toHaveBeenCalledWith(DUST_MAX, 100, 540);
  });

  it('is a safe no-op when detached', () => {
    fx.detach();
    expect(() => fx.dust(0, 0, 1)).not.toThrow();
  });
});

describe('fx.spark', () => {
  beforeEach(() => fx.detach());

  it('explodes the spark emitter with a fixed count at the snap midpoint', () => {
    const scene = mkFxScene();
    fx.attach(scene);
    const sparkEmitter = scene.add.particles.mock.results[2].value;
    fx.spark(300, 200);
    expect(sparkEmitter.explode).toHaveBeenCalledWith(SPARK_COUNT, 300, 200);
  });

  it('is a safe no-op when detached', () => {
    fx.detach();
    expect(() => fx.spark(0, 0)).not.toThrow();
  });
});

describe('fx.reset clears all emitters', () => {
  beforeEach(() => fx.detach());
  it('killAll on splash, dust and spark', () => {
    const scene = mkFxScene();
    fx.attach(scene);
    const emitters = scene.add.particles.mock.results.map((r) => r.value);
    fx.reset();
    for (const e of emitters) expect(e.killAll).toHaveBeenCalled();
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
