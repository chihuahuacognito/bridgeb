// src/utils/vehicleDesign.js
// Resolves the 1-10 design-scale vehicle params for a test run.
// Locked levels (ui.vehicleSelect === false) always use the level's vehicle(s);
// otherwise the player's selected preset wins. Level `design` overrides
// individual fields on locked levels.

function resolveOne(entry, presets, key) {
  const preset = presets.find(p => p.key === key) ?? presets[0];
  const base = { weight: preset.weight, speed: preset.speed, acceleration: preset.acceleration };
  return { ...base, ...(entry?.design ?? {}) };
}

export function resolveVehicleDesign(level, presets, selectedKey) {
  const v = level.vehicles[0];
  const locked = level.ui?.vehicleSelect === false;
  const key = locked ? v.type : selectedKey;
  // Unlocked: ignore any level design override (the player owns the design).
  return locked ? resolveOne(v, presets, key) : resolveOne(null, presets, key);
}

// Multi-vehicle convoy. Locked levels resolve every entry (its own type + design
// override); unlocked levels run a single player-selected vehicle (convoys are a
// locked-level construct). Returns design SCALES — caller maps via vehicleParamsFromDesign.
export function resolveConvoy(level, presets, selectedKey) {
  const locked = level.ui?.vehicleSelect === false;
  if (!locked) {
    const preset = presets.find(p => p.key === selectedKey) ?? presets[0];
    const first = level.vehicles[0] ?? {};
    return [{
      type: preset.key, spawnAt: first.spawnAt ?? 'left',
      ...resolveOne(null, presets, preset.key),
    }];
  }
  return level.vehicles.map(v => ({
    type: v.type, spawnAt: v.spawnAt ?? 'left',
    ...resolveOne(v, presets, v.type),
  }));
}
