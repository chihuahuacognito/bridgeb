// src/data/leveldata.js
// Per spec §2 rule 3: level.vehicles is ALWAYS an array.

export const L1 = {
  id: 'L1',
  title: 'Forces & Gravity',
  span: 6,
  budget: 16,
  worldWidth: 1280,
  worldHeight: 720,
  canyon: {
    leftWall:  { x: 240,  y: 480, width: 80,  height: 240 },
    rightWall: { x: 1040, y: 480, width: 80,  height: 240 },
    waterY: 660,
  },
  anchors: [
    { id: 'L', x: 280,  y: 360, side: 'left' },
    { id: 'R', x: 1000, y: 360, side: 'right' },
  ],
  vehicles: [
    { type: 'car', spawnAt: 'left', weight: 200, speed: 'normal' },
  ],
  gravity: { y: 1.5, label: 'Normal' },
  materials: {
    road: { type: 'road', cost: 2, stiffness: 0.08, snapThreshold: 0.50 },
    wood: { type: 'beam', cost: 1, stiffness: 0.15, snapThreshold: 0.25 },
  },
};

export const DEV_STRESS = {
  id: 'DEV_STRESS',
  title: 'Dev — Stress Test',
  span: 6,
  budget: 40,
  worldWidth: 1280,
  worldHeight: 720,
  canyon: {
    leftWall:  { x: 240,  y: 480, width: 80,  height: 240 },
    rightWall: { x: 1040, y: 480, width: 80,  height: 240 },
    waterY: 660,
  },
  anchors: [
    { id: 'L', x: 280,  y: 360, side: 'left' },
    { id: 'R', x: 1000, y: 360, side: 'right' },
  ],
  vehicles: [
    { type: 'car', spawnAt: 'left', weight: 2000, speed: 'normal' },
  ],
  gravity: { y: 1.5, label: 'Normal' },
  materials: {
    road: { type: 'road', cost: 2, stiffness: 0.08, snapThreshold: 0.50 },
    wood: { type: 'beam', cost: 1, stiffness: 0.15, snapThreshold: 0.25 },
  },
};

export const ALL_LEVELS = { L1, DEV_STRESS };
