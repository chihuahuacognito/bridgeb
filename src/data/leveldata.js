// src/data/leveldata.js
// Per spec §2 rule 3: level.vehicles is ALWAYS an array.

export const L1 = {
  id: 'L1',
  title: 'Forces & Gravity',
  span: 6,
  budget: 16,
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
  rocks: [],
  anchors: [
    { id: 'L', x: 280,  y: 360, side: 'left' },
    { id: 'R', x: 1000, y: 360, side: 'right' },
  ],
  vehicles: [
    { type: 'car', spawnAt: 'left', weight: 200, speed: 'normal' },
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

export const ALL_LEVELS = { L1, DEV_STRESS };
