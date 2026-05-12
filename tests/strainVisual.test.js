import { describe, it, expect } from 'vitest';
import { createHeadlessWorld } from './headlessWorld.js';
import { readStrainVisual } from '../src/systems/physics.js';

describe('readStrainVisual', () => {
  it('returns 0 for a beam at rest length', () => {
    const { Matter, world } = createHeadlessWorld({ gravityY: 0 });
    const a = Matter.Bodies.circle(100, 100, 4, { isStatic: true });
    const b = Matter.Bodies.circle(200, 100, 4, { isStatic: true });
    Matter.Composite.add(world, [a, b]);
    const c = Matter.Constraint.create({ bodyA: a, bodyB: b, length: 100, stiffness: 0.75 });
    expect(readStrainVisual(c)).toBeLessThan(0.01);
  });

  it('returns 0.5 at half VISUAL_FULL_STRAIN stretch (20% of rest)', () => {
    // VISUAL_FULL_STRAIN = 0.4. Half = 0.2. 20% of 100 = 20 → bodies 120 apart.
    const { Matter, world } = createHeadlessWorld({ gravityY: 0 });
    const a = Matter.Bodies.circle(100, 100, 4, { isStatic: true });
    const b = Matter.Bodies.circle(220, 100, 4, { isStatic: true });
    Matter.Composite.add(world, [a, b]);
    const c = Matter.Constraint.create({ bodyA: a, bodyB: b, length: 100, stiffness: 0.75 });
    const v = readStrainVisual(c);
    expect(v).toBeGreaterThan(0.49);
    expect(v).toBeLessThan(0.51);
  });

  it('saturates at 1.0 when stretch >= VISUAL_FULL_STRAIN', () => {
    // 50% stretch (150-100 = 50, ratio 0.5) > VISUAL_FULL_STRAIN 0.4 → saturates.
    const { Matter, world } = createHeadlessWorld({ gravityY: 0 });
    const a = Matter.Bodies.circle(100, 100, 4, { isStatic: true });
    const b = Matter.Bodies.circle(250, 100, 4, { isStatic: true });
    Matter.Composite.add(world, [a, b]);
    const c = Matter.Constraint.create({ bodyA: a, bodyB: b, length: 100, stiffness: 0.75 });
    expect(readStrainVisual(c)).toBe(1);
  });

  it('is independent of material.snapThreshold (snap tuning does not change visual)', () => {
    const { Matter, world } = createHeadlessWorld({ gravityY: 0 });
    const a = Matter.Bodies.circle(100, 100, 4, { isStatic: true });
    const b = Matter.Bodies.circle(220, 100, 4, { isStatic: true });
    Matter.Composite.add(world, [a, b]);
    const c = Matter.Constraint.create({ bodyA: a, bodyB: b, length: 100, stiffness: 0.75 });
    c.material = { snapThreshold: 0.7 };
    const v1 = readStrainVisual(c);
    c.material = { snapThreshold: 2.0 };
    const v2 = readStrainVisual(c);
    expect(v1).toBe(v2);
  });
});
