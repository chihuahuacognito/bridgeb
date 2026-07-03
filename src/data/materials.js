// src/data/materials.js
// Single source of truth for buildable materials. `type` is the drivability
// discriminator: 'road' = drivable deck (gets a collision body); 'beam' =
// structural brace (no collision body). Registry objects are IMMUTABLE — call
// cloneMaterial() before mutating (per-level tuning override or cheat panel).
//
// INVARIANT: `asphalt` and `wood` must stay byte-identical to the old
// roadMat()/woodMat() output (stiffness/snapThreshold + ROAD_COST/WOOD_COST
// block tables) so the 12 existing levels and roundtrip.test.js are unchanged.

const BLOCK_LEN = { S: 40, M: 80, L: 160, XL: 240 };

// Per-material block cost tables. Asphalt/Wood are the historical baselines.
const ROAD_COST     = { S: 2, M: 4,  L: 8,  XL: 12 }; // asphalt (baseline)
const WOOD_COST     = { S: 1, M: 2,  L: 4,  XL: 6  }; // wood (baseline)
const DIRT_COST     = { S: 1, M: 2,  L: 4,  XL: 6  }; // cheaper road
const CONCRETE_COST = { S: 3, M: 6,  L: 12, XL: 18 }; // pricier road
const ROPE_COST     = { S: 1, M: 1,  L: 2,  XL: 3  }; // cheapest beam
const STEEL_COST    = { S: 2, M: 4,  L: 8,  XL: 12 }; // pricier beam

function blocks(costTable, sizes = ['S', 'M', 'L', 'XL']) {
  return Object.fromEntries(sizes.map(s => [s, { length: BLOCK_LEN[s], cost: costTable[s] }]));
}

// Exported so leveldata.js roadMat/woodMat can rebuild baseline tables with a
// size subset (back-compat with per-level road_sizes/wood_sizes).
export function blocksFor(type, sizes = ['S', 'M', 'L', 'XL']) {
  return blocks(type === 'road' ? ROAD_COST : WOOD_COST, sizes);
}

// Representative unit price shown on a submenu tile (the common M block).
export function tilePrice(m) {
  return m.blocks?.M?.cost ?? m.cost;
}

export const MATERIALS = {
  dirt: {
    id: 'dirt', name: 'Dirt', type: 'road', cost: 1, stiffness: 0.05, snapThreshold: 0.018,
    blocks: blocks(DIRT_COST),
    visual: { base: 0x8a6a3e, edgeTop: 0x9c7a4a, edgeBottom: 0x6b4f2c, motif: 'speckle', centerLine: false },
  },
  asphalt: {
    id: 'asphalt', name: 'Asphalt', type: 'road', cost: 2, stiffness: 0.08, snapThreshold: 0.025,
    blocks: blocks(ROAD_COST),
    visual: { base: 0x3b4047, edgeTop: 0x4c535b, edgeBottom: 0x23262a, motif: 'speckle', centerLine: true },
  },
  concrete: {
    id: 'concrete', name: 'Concrete', type: 'road', cost: 3, stiffness: 0.14, snapThreshold: 0.05,
    blocks: blocks(CONCRETE_COST),
    visual: { base: 0xb8bcc2, edgeTop: 0xcfd3d8, edgeBottom: 0x95999f, motif: 'speckle', centerLine: true },
  },
  rope: {
    id: 'rope', name: 'Rope', type: 'beam', cost: 1, stiffness: 0.06, snapThreshold: 0.30, thickness: 3,
    blocks: blocks(ROPE_COST),
    visual: { base: 0xc8a86a, edgeTop: 0xdcc088, edgeBottom: 0xa5824a, motif: 'twist' },
  },
  wood: {
    id: 'wood', name: 'Wood', type: 'beam', cost: 1, stiffness: 0.15, snapThreshold: 0.18,
    blocks: blocks(WOOD_COST),
    visual: { base: 0xa9772f, edgeTop: 0xc08f44, edgeBottom: 0x835a20, motif: 'grain' },
  },
  steel: {
    id: 'steel', name: 'Steel', type: 'beam', cost: 3, stiffness: 0.30, snapThreshold: 0.22, thickness: 6,
    blocks: blocks(STEEL_COST),
    visual: { base: 0x8a94a3, edgeTop: 0xc2ccd8, edgeBottom: 0x5f6875, motif: 'sheen' },
  },
};

export const ROAD_MATERIALS = Object.values(MATERIALS).filter(m => m.type === 'road');
export const BEAM_MATERIALS = Object.values(MATERIALS).filter(m => m.type === 'beam');

// Map a stored/legacy material key to a registry entry.
// Legacy saves & prebuilt use 'road'/'wood'; new data uses ids.
const LEGACY = { road: 'asphalt', wood: 'wood', beam: 'wood' };
export function resolveMaterial(idOrLegacy) {
  return MATERIALS[idOrLegacy] ?? MATERIALS[LEGACY[idOrLegacy]] ?? MATERIALS.asphalt;
}

// Shallow clone with copied blocks/visual — for any per-beam or cheat-panel
// mutation, so the shared registry entry is never written through.
export function cloneMaterial(m) {
  const blocksCopy = Object.fromEntries(
    Object.entries(m.blocks).map(([k, v]) => [k, { ...v }]),
  );
  return { ...m, blocks: blocksCopy, visual: { ...m.visual } };
}
