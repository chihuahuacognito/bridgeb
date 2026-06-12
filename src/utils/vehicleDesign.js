// src/utils/vehicleDesign.js
// Resolves the 1-10 design-scale vehicle params for a test run.
// Locked levels (ui.vehicleSelect === false) always use the level's vehicle;
// otherwise the player's selected preset wins. Level `design` overrides
// individual fields on locked levels.
export function resolveVehicleDesign(level, presets, selectedKey) {
  const v = level.vehicles[0];
  const locked = level.ui?.vehicleSelect === false;
  const key = locked ? v.type : selectedKey;
  const preset = presets.find(p => p.key === key) ?? presets[0];
  const base = { weight: preset.weight, speed: preset.speed, acceleration: preset.acceleration };
  return locked ? { ...base, ...(v.design ?? {}) } : base;
}
