import { describe, it, expect } from 'vitest';
import { resolveVehicleDesign, resolveConvoy } from '../src/utils/vehicleDesign.js';

const PRESETS = [
  { key: 'car',   weight: 3, speed: 7, acceleration: 5 },
  { key: 'truck', weight: 5, speed: 4, acceleration: 5 },
  { key: 'tank',  weight: 8, speed: 2, acceleration: 5 },
];

describe('resolveVehicleDesign', () => {
  it('uses the player-selected preset when the level does not lock the vehicle', () => {
    const level = { vehicles: [{ type: 'car' }] };
    expect(resolveVehicleDesign(level, PRESETS, 'tank'))
      .toEqual({ weight: 8, speed: 2, acceleration: 5 });
  });

  it('uses the level vehicle type when ui.vehicleSelect is false, ignoring selection', () => {
    const level = { ui: { vehicleSelect: false }, vehicles: [{ type: 'truck' }] };
    expect(resolveVehicleDesign(level, PRESETS, 'car'))
      .toEqual({ weight: 5, speed: 4, acceleration: 5 });
  });

  it('applies the level design override on top of the locked preset', () => {
    const level = {
      ui: { vehicleSelect: false },
      vehicles: [{ type: 'truck', design: { weight: 6 } }],
    };
    expect(resolveVehicleDesign(level, PRESETS, 'car'))
      .toEqual({ weight: 6, speed: 4, acceleration: 5 });
  });

  it('falls back to the first preset for an unknown key', () => {
    const level = { vehicles: [{ type: 'car' }] };
    expect(resolveVehicleDesign(level, PRESETS, 'bogus'))
      .toEqual({ weight: 3, speed: 7, acceleration: 5 });
  });
});

describe('resolveConvoy', () => {
  it('locked level resolves every entry by its own type + design override', () => {
    const level = {
      ui: { vehicleSelect: false },
      vehicles: [
        { type: 'car', spawnAt: 'left' },
        { type: 'truck', spawnAt: 'left', design: { weight: 6 } },
      ],
    };
    const out = resolveConvoy(level, PRESETS, 'tank');   // selectedKey ignored when locked
    expect(out).toHaveLength(2);
    expect(out[0]).toMatchObject({ type: 'car', spawnAt: 'left', weight: 3, speed: 7 });
    expect(out[1]).toMatchObject({ type: 'truck', spawnAt: 'left', weight: 6, speed: 4 });
  });

  it('unlocked level returns a single player-selected vehicle', () => {
    const level = { vehicles: [{ type: 'car', spawnAt: 'left' }] };   // no ui.vehicleSelect:false
    const out = resolveConvoy(level, PRESETS, 'tank');
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ type: 'tank', spawnAt: 'left', weight: 8, speed: 2 });
  });
});
