import { describe, it, expect } from 'vitest';
import { createHeadlessWorld } from './headlessWorld.js';
// IMPORT the same function the runtime uses — never duplicate the formula.
// (Plan reviewer P0: a divergent test copy would pass even if physics.js
// was wrong, silently breaking the demo.) physics.readStressNormalized is
// scene-agnostic so it works without physics.attach(scene).
import physics, { readStressNormalized } from '../src/systems/physics.js';

describe('stressReader', () => {
  it('reads zero stress on a beam at rest length', () => {
    const { Matter, world } = createHeadlessWorld({ gravityY: 0 });
    const a = Matter.Bodies.circle(100, 100, 4, { isStatic: true });
    const b = Matter.Bodies.circle(200, 100, 4, { isStatic: true });
    Matter.Composite.add(world, [a, b]);
    const c = Matter.Constraint.create({ bodyA: a, bodyB: b, length: 100, stiffness: 0.75 });
    c.material = { snapThreshold: 0.7 };
    expect(readStressNormalized(c)).toBeLessThan(0.05);
  });

  it('reads near-1 stress when beam stretched to threshold', () => {
    const { Matter, world } = createHeadlessWorld({ gravityY: 0 });
    // Stretched 80px → Δ = 80, denom = 100, stiffness 0.75
    // raw = 0.75 * 80 / 100 = 0.6
    // normalized = 0.6 / 0.7 ≈ 0.857
    const a = Matter.Bodies.circle(100, 100, 4, { isStatic: true });
    const b = Matter.Bodies.circle(280, 100, 4, { isStatic: true });
    Matter.Composite.add(world, [a, b]);
    const c = Matter.Constraint.create({ bodyA: a, bodyB: b, length: 100, stiffness: 0.75 });
    c.material = { snapThreshold: 0.7 };
    const s = readStressNormalized(c);
    expect(s).toBeGreaterThan(0.80);
    expect(s).toBeLessThan(0.90);
  });

  it('clamps to 1 when overstretched', () => {
    const { Matter, world } = createHeadlessWorld({ gravityY: 0 });
    const a = Matter.Bodies.circle(100, 100, 4, { isStatic: true });
    const b = Matter.Bodies.circle(400, 100, 4, { isStatic: true });
    Matter.Composite.add(world, [a, b]);
    const c = Matter.Constraint.create({ bodyA: a, bodyB: b, length: 100, stiffness: 0.75 });
    c.material = { snapThreshold: 0.7 };
    expect(readStressNormalized(c)).toBe(1);
  });
});
