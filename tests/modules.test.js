import { describe, it, expect } from 'vitest';
import {
  APPS, MODULES, MODULE_ORDER, moduleForLevel, LEVEL_ORDER, ALL_LEVELS,
} from '../src/data/leveldata.js';

describe('APPS', () => {
  it('has three apps with exactly one unlocked, and it is bridge', () => {
    expect(APPS).toHaveLength(3);
    const unlocked = APPS.filter((a) => !a.locked);
    expect(unlocked).toHaveLength(1);
    expect(unlocked[0].id).toBe('bridge');
  });
});

describe('MODULES', () => {
  it('every MODULE_ORDER id exists and each module has exactly 4 levels', () => {
    for (const id of MODULE_ORDER) {
      expect(MODULES[id]).toBeTruthy();
      expect(MODULES[id].levelIds).toHaveLength(4);
    }
  });

  it('every module level id exists in ALL_LEVELS', () => {
    for (const id of MODULE_ORDER) {
      for (const lid of MODULES[id].levelIds) expect(ALL_LEVELS[lid]).toBeTruthy();
    }
  });

  it('no level appears in two modules and none is duplicated within a module', () => {
    const seen = new Set();
    for (const id of MODULE_ORDER) {
      const ids = MODULES[id].levelIds;
      expect(new Set(ids).size).toBe(ids.length); // no dup within module
      for (const lid of ids) {
        expect(seen.has(lid)).toBe(false);        // no dup across modules
        seen.add(lid);
      }
    }
  });

  it('concatenated module levels (in MODULE_ORDER) equal LEVEL_ORDER', () => {
    const concat = MODULE_ORDER.flatMap((id) => MODULES[id].levelIds);
    expect(concat).toEqual(LEVEL_ORDER);
  });
});

describe('moduleForLevel', () => {
  it('maps each level to the module that contains it', () => {
    for (const id of MODULE_ORDER) {
      for (const lid of MODULES[id].levelIds) expect(moduleForLevel(lid)).toBe(id);
    }
  });

  it('returns null for DEV_STRESS and unknown ids', () => {
    expect(moduleForLevel('DEV_STRESS')).toBe(null);
    expect(moduleForLevel('NOPE')).toBe(null);
  });
});
