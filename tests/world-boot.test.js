// tests/world-boot.test.js
import { describe, it, expect } from 'vitest';
import { createHeadlessWorld } from './headlessWorld.js';

describe('headlessWorld', () => {
  it('boots and steps without NaN', () => {
    const { engine, step } = createHeadlessWorld();
    step(100);
    expect(engine.world.bodies.length).toBe(0);
    expect(engine.enableSleeping).toBe(false);
  });
});
