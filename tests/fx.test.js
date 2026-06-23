// tests/fx.test.js
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import audio from '../src/systems/audio.js';

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
