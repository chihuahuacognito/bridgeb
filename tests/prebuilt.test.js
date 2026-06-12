import { describe, it, expect } from 'vitest';
import { expandPrebuilt } from '../src/utils/prebuilt.js';
import { ALL_LEVELS } from '../src/data/leveldata.js';

describe('expandPrebuilt', () => {
  it('returns empty result for a level without prebuilt', () => {
    expect(expandPrebuilt(ALL_LEVELS.L01)).toEqual({ joints: [], beams: [], cost: 0 });
  });

  it('expands L03 joints with isAnchor=false and bodyId=id', () => {
    const { joints } = expandPrebuilt(ALL_LEVELS.L03);
    expect(joints).toEqual([
      { x: 560, y: 390, isAnchor: false, bodyId: 'p1' },
      { x: 700, y: 350, isAnchor: false, bodyId: 'p2' },
    ]);
  });

  it('expands beams with resolved material object and per-beam cost', () => {
    const l = ALL_LEVELS.L03;
    const { beams, cost } = expandPrebuilt(l);
    expect(beams).toHaveLength(3);
    expect(beams[0]).toEqual({
      a: 'L', b: 'p1',
      material: l.materials.road,
      cost: l.materials.road.blocks.M.cost,
    });
    const expected = l.prebuilt.beams
      .reduce((s, b) => s + l.materials.road.blocks[b.size].cost, 0);
    expect(cost).toBe(expected);
  });
});
