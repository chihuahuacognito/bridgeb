// tests/roundtrip.test.js
// The seeded gdd/*.csv → generated overrides → mergeLevelKnobs must reproduce the code
// levels exactly. ALL_LEVELS is RAW_LEVELS merged with the committed LEVEL_OVERRIDES, so
// for every CSV-covered level ALL_LEVELS[id] must deep-equal RAW_LEVELS[id].
import { describe, it, expect } from 'vitest';
import { RAW_LEVELS, ALL_LEVELS, LEVEL_ORDER } from '../src/data/leveldata.js';
import { LEVEL_OVERRIDES } from '../src/data/levelOverrides.generated.js';

describe('CSV round-trip (seed reproduces code levels)', () => {
  it('has a generated override row for every ordered level', () => {
    for (const id of LEVEL_ORDER) {
      expect(LEVEL_OVERRIDES[id], `missing override for ${id}`).toBeTruthy();
    }
  });

  it.each(LEVEL_ORDER)('ALL_LEVELS[%s] deep-equals the code default', (id) => {
    expect(ALL_LEVELS[id]).toEqual(RAW_LEVELS[id]);
  });

  it('DEV_STRESS is excluded from overrides and passes through unchanged', () => {
    expect(LEVEL_OVERRIDES.DEV_STRESS).toBeUndefined();
    expect(ALL_LEVELS.DEV_STRESS).toBe(RAW_LEVELS.DEV_STRESS);
  });
});
