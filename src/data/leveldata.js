// src/data/leveldata.js
// Per spec §2 rule 3: level.vehicles is ALWAYS an array.

export const L1 = {
  id: 'L1',
  title: 'Forces & Gravity',
  span: 6,                            // metres, used for budget feel
  budget: 500,
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
  materials: {
    wood: { stiffness: 0.9, snapThreshold: 2.0 }, // L1-relaxed (spec §3.5)
  },
};

export const ALL_LEVELS = { L1 };
