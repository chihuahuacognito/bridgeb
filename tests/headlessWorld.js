// tests/headlessWorld.js
// Headless Matter world helper for Vitest. DO NOT enable sleeping here —
// it kills cascade evaluation in tests (spec §5.1 P0 gotcha).
import Matter from 'matter-js';

export function createHeadlessWorld(opts = {}) {
  const engine = Matter.Engine.create({
    enableSleeping: false,            // explicit — pass-1 QA review P0
    positionIterations: 8,
    velocityIterations: 6,
    constraintIterations: 4,
  });
  engine.gravity.y = opts.gravityY ?? 1.5;
  const world = engine.world;

  // Fixed delta step. Comment: do not "optimise" this to a variable delta —
  // see headlessWorld.js comments in spec §5.1.
  function step(times = 1, deltaMs = 16.666) {
    for (let i = 0; i < times; i++) Matter.Engine.update(engine, deltaMs);
  }

  return { engine, world, step, Matter };
}
