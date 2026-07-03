import { describe, it, expect } from 'vitest';
import {
  MATERIALS, ROAD_MATERIALS, BEAM_MATERIALS,
  resolveMaterial, cloneMaterial, tilePrice, blocksFor,
} from '../src/data/materials.js';

describe('materials registry', () => {
  it('has 3 roads and 3 beams', () => {
    expect(ROAD_MATERIALS.map(m => m.id).sort()).toEqual(['asphalt', 'concrete', 'dirt']);
    expect(BEAM_MATERIALS.map(m => m.id).sort()).toEqual(['rope', 'steel', 'wood']);
  });

  it('every material has required fields and a correct type partition', () => {
    for (const m of Object.values(MATERIALS)) {
      expect(typeof m.id).toBe('string');
      expect(typeof m.name).toBe('string');
      expect(['road', 'beam']).toContain(m.type);
      expect(typeof m.cost).toBe('number');
      expect(typeof m.stiffness).toBe('number');
      expect(typeof m.snapThreshold).toBe('number');
      expect(m.blocks.M).toBeTruthy();
      expect(typeof m.visual.base).toBe('number');
    }
  });

  it('asphalt/wood stay byte-identical to the historical baselines', () => {
    // roundtrip.test.js + the 12 levels depend on these exact numbers.
    expect(MATERIALS.asphalt.stiffness).toBe(0.08);
    expect(MATERIALS.asphalt.snapThreshold).toBe(0.025);
    expect(MATERIALS.asphalt.blocks).toEqual(blocksFor('road'));
    expect(MATERIALS.wood.stiffness).toBe(0.15);
    expect(MATERIALS.wood.snapThreshold).toBe(0.18);
    expect(MATERIALS.wood.blocks).toEqual(blocksFor('beam'));
  });

  it('block-cost tiers ascend cheap -> pricey within each category', () => {
    expect(tilePrice(MATERIALS.dirt)).toBeLessThan(tilePrice(MATERIALS.asphalt));
    expect(tilePrice(MATERIALS.asphalt)).toBeLessThan(tilePrice(MATERIALS.concrete));
    expect(tilePrice(MATERIALS.rope)).toBeLessThan(tilePrice(MATERIALS.wood));
    expect(tilePrice(MATERIALS.wood)).toBeLessThan(tilePrice(MATERIALS.steel));
  });

  it('resolveMaterial maps legacy keys and ids', () => {
    expect(resolveMaterial('road')).toBe(MATERIALS.asphalt);
    expect(resolveMaterial('wood')).toBe(MATERIALS.wood);
    expect(resolveMaterial('concrete')).toBe(MATERIALS.concrete);
    expect(resolveMaterial('nonsense')).toBe(MATERIALS.asphalt); // safe fallback
  });

  it('cloneMaterial does not mutate the registry', () => {
    const c = cloneMaterial(MATERIALS.wood);
    c.stiffness = 999;
    c.blocks.M.cost = 999;
    expect(MATERIALS.wood.stiffness).toBe(0.15);
    expect(MATERIALS.wood.blocks.M.cost).toBe(2);
  });
});
