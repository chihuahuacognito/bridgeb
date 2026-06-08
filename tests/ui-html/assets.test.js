import { describe, it, expect, beforeEach } from 'vitest';
import { assets } from '../../src/systems/assets.js';

describe('assets registry', () => {
  beforeEach(() => assets._reset());

  it('has() returns true for unknown keys (assume present by default)', () => {
    expect(assets.has('car')).toBe(true);
  });

  it('markMissing flips has() to false', () => {
    assets.markMissing('car');
    expect(assets.has('car')).toBe(false);
  });

  it('missingList enumerates marked keys', () => {
    assets.markMissing('cliff-left');
    assets.markMissing('cloud-1');
    expect(assets.missingList()).toEqual(expect.arrayContaining(['cliff-left', 'cloud-1']));
  });
});
