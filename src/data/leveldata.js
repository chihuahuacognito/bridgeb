// src/data/leveldata.js
// Per spec §2 rule 3: level.vehicles is ALWAYS an array.
// Spec: docs/superpowers/specs/2026-06-12-level-progression-design.md

const WATER_Y = 660;
const BLOCK_LEN  = { S: 40, M: 80, L: 160, XL: 240 };
const ROAD_COST  = { S: 2,  M: 4,  L: 8,   XL: 12 };
const WOOD_COST  = { S: 1,  M: 2,  L: 4,   XL: 6 };

function roadMat(sizes = ['S', 'M', 'L', 'XL']) {
  return {
    type: 'road', cost: 2, stiffness: 0.08, snapThreshold: 0.025,
    blocks: Object.fromEntries(sizes.map(s => [s, { length: BLOCK_LEN[s], cost: ROAD_COST[s] }])),
  };
}

function woodMat(sizes = ['S', 'M', 'L', 'XL']) {
  return {
    type: 'beam', cost: 1, stiffness: 0.15, snapThreshold: 0.18,
    blocks: Object.fromEntries(sizes.map(s => [s, { length: BLOCK_LEN[s], cost: WOOD_COST[s] }])),
  };
}

// Canyon walls flanking a gap. Edge x positions are where the anchors sit.
function terrainPair(leftEdgeX, rightEdgeX, leftTopY = 360, rightTopY = 360) {
  return {
    left: {
      verts: [
        { x: 0,             y: leftTopY },
        { x: leftEdgeX,     y: leftTopY },
        { x: leftEdgeX,     y: leftTopY + 140 },
        { x: leftEdgeX - 100, y: leftTopY + 200 },
        { x: 0,             y: leftTopY + 200 },
      ],
      physRect: { x: leftEdgeX / 2, y: leftTopY + 100, width: leftEdgeX, height: 200 },
      color: 0x2c3033,
    },
    right: {
      verts: [
        { x: rightEdgeX,       y: rightTopY },
        { x: 1280,             y: rightTopY },
        { x: 1280,             y: rightTopY + 200 },
        { x: rightEdgeX + 100, y: rightTopY + 200 },
        { x: rightEdgeX,       y: rightTopY + 140 },
      ],
      physRect: { x: (1280 + rightEdgeX) / 2, y: rightTopY + 100, width: 1280 - rightEdgeX, height: 200 },
      color: 0x2c3033,
    },
    waterY: WATER_Y,
  };
}

function spanAnchors(leftEdgeX, rightEdgeX, leftTopY = 360, rightTopY = 360) {
  return [
    { id: 'L', x: leftEdgeX,  y: leftTopY,  side: 'left' },
    { id: 'R', x: rightEdgeX, y: rightTopY, side: 'right' },
  ];
}

// Tapered mid-chasm rock pillar with two attachable top anchors.
function pillar(id, cx, topY) {
  return {
    id, sprite: 'rock-pillar',
    verts: [
      { x: cx - 38, y: topY }, { x: cx + 38, y: topY },
      { x: cx + 60, y: 720 },  { x: cx - 60, y: 720 },
    ],
    physRect: { x: cx, y: (topY + 720) / 2, width: 120, height: 720 - topY },
    color: 0x8b6a2e,
    anchors: [
      { id: `${id}_L`, x: cx - 38, y: topY },
      { id: `${id}_R`, x: cx + 38, y: topY },
    ],
  };
}

function level(def) {
  return {
    worldWidth: 1280, worldHeight: 720,
    gravity: { y: 1.5, label: 'Normal' },
    rocks: [],
    ...def,
  };
}

// ── Phase 1 — Tutorials ─────────────────────────────────────────────────────

export const L01 = level({
  id: 'L01', title: 'Make It Reach', phase: 'tutorial',
  span: 1.6, budget: 8,
  terrain: terrainPair(560, 720),
  anchors: spanAnchors(560, 720),
  vehicles: [{ type: 'car', spawnAt: 'left' }],
  materials: { road: roadMat(['L']) },
  ui: { budgetMeter: false, delete: false, vehicleSelect: false, tools: ['road'] },
  tutorial: {
    intro:   { icon: '👆', text: 'Tap between the red dots!' },
    hint:    { icon: '👆', text: 'Tap the gap to place a beam.' },
    success: { text: 'You built a bridge!' },
  },
});

// NOTE: vehicles[].design is consumed by resolveVehicleDesign() (implemented in a later plan task).
// Until that lands, the field is data-only and has no runtime effect.
export const L02 = level({
  id: 'L02', title: 'Try Again!', phase: 'tutorial',
  span: 3.2, budget: 40,
  terrain: terrainPair(480, 800),
  anchors: spanAnchors(480, 800),
  // Heavier-than-car design weight so a flat 2–3 segment deck is guaranteed to snap.
  vehicles: [{ type: 'car', spawnAt: 'left', design: { weight: 6, speed: 7, acceleration: 5 } }],
  materials: { road: roadMat(['M', 'L']) },
  ui: { budgetMeter: false, delete: false, vehicleSelect: false, tools: ['road'] },
  tutorial: {
    intro:   { icon: '🌉', text: 'Build across — then press TEST.' },
    hint:    { icon: '💪', text: 'It broke! Add more beams and try again.' },
    success: { text: 'Falling down is how we learn!' },
  },
});

export const L03 = level({
  id: 'L03', title: "Builder's Tools", phase: 'tutorial',
  span: 3.2, budget: 60,
  terrain: terrainPair(480, 800),
  anchors: spanAnchors(480, 800),
  vehicles: [{ type: 'car', spawnAt: 'left' }],
  materials: { road: roadMat(), wood: woodMat() },
  ui: { vehicleSelect: false },
  prebuilt: {
    joints: [
      { id: 'p1', x: 560, y: 390 },
      { id: 'p2', x: 700, y: 350 },
    ],
    beams: [
      { a: 'L',  b: 'p1', material: 'road', size: 'M' },
      { a: 'p1', b: 'p2', material: 'road', size: 'L' },
      { a: 'p2', b: 'R',  material: 'road', size: 'M' },
    ],
  },
  tutorial: {
    intro:   { icon: '🗑️', text: 'This bridge is wonky! Use REMOVE, then rebuild it.' },
    hint:    { icon: '🗑️', text: 'Pick REMOVE, tap a crooked beam, then place a better one.' },
    success: { text: 'You fixed it — a real builder!' },
  },
});

// ── Phase 2 — Topic levels ──────────────────────────────────────────────────

export const L04 = level({
  id: 'L04', title: 'Gravity Pulls Down', phase: 'topic',
  span: 4.4, budget: 36,
  terrain: terrainPair(420, 860),
  anchors: spanAnchors(420, 860),
  rocks: [pillar('P1', 640, 530)],
  vehicles: [{ type: 'car', spawnAt: 'left' }],
  materials: { road: roadMat(), wood: woodMat() },
  ui: { vehicleSelect: false },
  tutorial: {
    intro:   { icon: '⬇️', text: 'Gravity pulls everything down. Watch the glow!' },
    hint:    { icon: '🔴', text: 'Red glow = too much force. Build support where it glows.' },
    success: { text: 'You beat gravity!' },
  },
});

export const L05 = level({
  id: 'L05', title: 'Heavier Is Harder', phase: 'topic',
  span: 4.4, budget: 26,
  terrain: terrainPair(420, 860),
  anchors: spanAnchors(420, 860),
  rocks: [pillar('P1', 640, 530)],
  vehicles: [{ type: 'truck', spawnAt: 'left', design: { weight: 6, speed: 4, acceleration: 5 } }],
  materials: { road: roadMat(), wood: woodMat() },
  ui: { vehicleSelect: false },
  tutorial: {
    intro:   { icon: '🚚', text: 'The truck weighs more than the car. What needs to change?' },
    hint:    { icon: '🪨', text: 'The rock in the middle can hold your bridge up.' },
    success: { text: 'Heavy load, strong bridge!' },
  },
});

export const L06 = level({
  id: 'L06', title: 'The Strongest Shape', phase: 'topic',
  span: 4.8, budget: 38,
  terrain: terrainPair(400, 880),
  anchors: spanAnchors(400, 880),
  vehicles: [{ type: 'car', spawnAt: 'left' }],
  // Anti-bypass: only L-size road (no cheap re-segmenting), wood for diagonals.
  materials: { road: roadMat(['L']), wood: woodMat(['S', 'M', 'L']) },
  ui: { vehicleSelect: false },
  prebuilt: {
    joints: [
      { id: 'd1', x: 560, y: 360 },
      { id: 'd2', x: 720, y: 360 },
    ],
    beams: [
      { a: 'L',  b: 'd1', material: 'road', size: 'L' },
      { a: 'd1', b: 'd2', material: 'road', size: 'L' },
      { a: 'd2', b: 'R',  material: 'road', size: 'L' },
    ],
  },
  tutorial: {
    intro:   { icon: '🔺', text: 'Squares squish. Triangles hold! Add slanted beams.' },
    hint:    { icon: '📐', text: 'Try a slanted beam. What shape does it make?' },
    success: { text: 'Triangles are the strongest shape!' },
  },
});

export const L07 = level({
  id: 'L07', title: 'Triangles Everywhere', phase: 'topic',
  span: 5.6, budget: 60,
  terrain: terrainPair(360, 920),
  anchors: spanAnchors(360, 920),
  rocks: [pillar('P1', 640, 530)],
  vehicles: [{ type: 'car', spawnAt: 'left' }],
  materials: { road: roadMat(), wood: woodMat() },
  tutorial: {
    intro:   { icon: '🔺', text: 'Build a whole bridge of triangles!' },
    hint:    { icon: '🔺', text: 'Zig-zag wood beams between the road make triangles.' },
    success: { text: 'A real truss bridge — engineers do this too!' },
  },
});

export const L08 = level({
  id: 'L08', title: 'Balance the Load', phase: 'topic',
  span: 4.0, budget: 55,
  terrain: terrainPair(440, 840, 400, 320),
  anchors: spanAnchors(440, 840, 400, 320),
  rocks: [pillar('P1', 720, 560)],
  vehicles: [{ type: 'truck', spawnAt: 'left', design: { weight: 6, speed: 4, acceleration: 5 } }],
  materials: { road: roadMat(), wood: woodMat() },
  ui: { vehicleSelect: false },
  tutorial: {
    intro:   { icon: '⚖️', text: 'The middle of the bridge carries the most weight.' },
    hint:    { icon: '⚖️', text: 'Build strongest where the bridge glows the most.' },
    success: { text: 'Perfectly balanced!' },
  },
});

export const L09 = level({
  id: 'L09', title: 'Count Your Coins', phase: 'topic',
  span: 4.0, budget: 22,
  terrain: terrainPair(440, 840),
  anchors: spanAnchors(440, 840),
  vehicles: [{ type: 'car', spawnAt: 'left' }],
  materials: { road: roadMat(), wood: woodMat() },
  tutorial: {
    intro:   { icon: '🪙', text: 'Coins are tight! Wood is cheap, road is strong.' },
    hint:    { icon: '🪙', text: 'Big blocks cost more. Where is a small one enough?' },
    success: { text: 'Smart spending — engineering is about trade-offs!' },
  },
});

// ── Phase 3 — Challenge levels ──────────────────────────────────────────────

export const L10 = level({
  id: 'L10', title: 'The Long Crossing', phase: 'challenge',
  span: 7.6, budget: 80,
  terrain: terrainPair(260, 1020),
  anchors: spanAnchors(260, 1020),
  rocks: [pillar('P1', 640, 530)],
  vehicles: [{ type: 'truck', spawnAt: 'left' }],
  materials: { road: roadMat(), wood: woodMat() },
  tutorial: {
    hint:    { icon: '🔺', text: 'Triangles plus the rock pillar — use everything you know.' },
    success: { text: 'The longest crossing yet!' },
  },
});

export const L11 = level({
  id: 'L11', title: 'Heavy Hauler', phase: 'challenge',
  span: 4.8, budget: 60,
  terrain: terrainPair(400, 880),
  anchors: spanAnchors(400, 880),
  vehicles: [{ type: 'tank', spawnAt: 'left', design: { weight: 8, speed: 2, acceleration: 5 } }],
  materials: { road: roadMat(), wood: woodMat() },
  ui: { vehicleSelect: false },
  tutorial: {
    hint:    { icon: '💪', text: 'The tank is the heaviest load there is. Strong beams everywhere it rolls.' },
    success: { text: 'Even the tank made it!' },
  },
});

export const L12 = level({
  id: 'L12', title: 'Master Builder', phase: 'challenge',
  span: 8.0, budget: 90,
  terrain: terrainPair(240, 1040, 380, 300),
  anchors: spanAnchors(240, 1040, 380, 300),
  rocks: [pillar('P1', 520, 560), pillar('P2', 800, 480)],
  vehicles: [{ type: 'truck', spawnAt: 'left', design: { weight: 7, speed: 4, acceleration: 5 } }],
  materials: { road: roadMat(), wood: woodMat() },
  ui: { vehicleSelect: false },
  tutorial: {
    hint:    { icon: '🏆', text: 'Two rocks, two heights — step your bridge across them.' },
    success: { text: 'Master Builder! Can you do it with coins to spare?' },
  },
});

// ── Dev ─────────────────────────────────────────────────────────────────────

export const DEV_STRESS = {
  id: 'DEV_STRESS',
  title: 'Dev — Stress Test',
  span: 6,
  budget: 400,
  worldWidth: 1280,
  worldHeight: 720,
  terrain: {
    left: {
      verts: [
        { x: 0,   y: 360 },
        { x: 280, y: 360 },
        { x: 280, y: 500 },
        { x: 180, y: 560 },
        { x: 0,   y: 560 },
      ],
      physRect: { x: 140, y: 460, width: 280, height: 200 },
      color: 0x2c3033,
    },
    right: {
      verts: [
        { x: 1000, y: 360 },
        { x: 1280, y: 360 },
        { x: 1280, y: 560 },
        { x: 1100, y: 560 },
        { x: 1000, y: 500 },
      ],
      physRect: { x: 1140, y: 460, width: 280, height: 200 },
      color: 0x2c3033,
    },
    waterY: 660,
  },
  rocks: [
    {
      id: 'C1',
      sprite: 'rock-pillar',
      // Tapered pillar: narrow at top, wider at base (submerged below waterY 660)
      verts: [
        { x: 612, y: 530 },
        { x: 688, y: 530 },
        { x: 710, y: 720 },
        { x: 590, y: 720 },
      ],
      physRect: { x: 650, y: 625, width: 120, height: 190 },
      color: 0x8b6a2e,
      anchors: [
        { id: 'C1_L', x: 612, y: 530 },
        { id: 'C1_R', x: 688, y: 530 },
      ],
    },
  ],
  anchors: [
    { id: 'L', x: 280,  y: 360, side: 'left' },
    { id: 'R', x: 1000, y: 360, side: 'right' },
  ],
  vehicles: [
    { type: 'car', spawnAt: 'left', weight: 2000, speed: 'normal' },
  ],
  gravity: { y: 1.5, label: 'Normal' },
  materials: {
    road: {
      type: 'road', cost: 2, stiffness: 0.08, snapThreshold: 0.025,
      blocks: { S: { length: 40, cost: 2 }, M: { length: 80, cost: 4 }, L: { length: 160, cost: 8 }, XL: { length: 240, cost: 12 } },
    },
    wood: {
      type: 'beam', cost: 1, stiffness: 0.15, snapThreshold: 0.18,
      blocks: { S: { length: 40, cost: 1 }, M: { length: 80, cost: 2 }, L: { length: 160, cost: 4 }, XL: { length: 240, cost: 6 } },
    },
  },
};

export const LEVEL_ORDER = ['L01','L02','L03','L04','L05','L06','L07','L08','L09','L10','L11','L12'];

export const ALL_LEVELS = { L01, L02, L03, L04, L05, L06, L07, L08, L09, L10, L11, L12, DEV_STRESS };

export function menuEntries(allLevels, order) {
  return order.map(id => ({
    id,
    title: allLevels[id].title,
    phase: allLevels[id].phase,
  }));
}
