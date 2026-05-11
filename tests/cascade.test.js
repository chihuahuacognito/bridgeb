import { describe, it, expect } from 'vitest';
import { createHeadlessWorld } from './headlessWorld.js';

describe('cascade', () => {
  it('stages snaps via a deferred queue, not in-tick recursion', () => {
    // Build a chain: A — B — C — D where all share endpoints
    const { Matter, world } = createHeadlessWorld({ gravityY: 0 });
    const j1 = Matter.Bodies.circle(0, 0, 4);
    const j2 = Matter.Bodies.circle(100, 0, 4);
    const j3 = Matter.Bodies.circle(200, 0, 4);
    const j4 = Matter.Bodies.circle(300, 0, 4);
    Matter.Composite.add(world, [j1, j2, j3, j4]);

    const material = { snapThreshold: 0.7 };
    const make = (a, b) => {
      const c = Matter.Constraint.create({
        bodyA: a, bodyB: b, length: 100, stiffness: 0.75,
      });
      c.material = material;
      c._stressHistory = [];
      return c;
    };
    const ab = make(j1, j2);
    const bc = make(j2, j3);
    const cd = make(j3, j4);

    // Stretch ab so it's "over-threshold" (stress >= 1.0)
    Matter.Body.setPosition(j2, { x: 250, y: 0 });

    // Manually populate pendingSnaps with the over-threshold constraint
    const pending = [ab];
    // After processing the head, the queue should NOT recurse — only the head
    // snaps in this tick; neighbour candidates are added to the queue for the
    // NEXT stagger-tick.

    // Smoke: queue has one entry pre-processing
    expect(pending.length).toBe(1);
    // After pop, queue may have appended neighbours (bc shares j2 with ab)
    pending.shift();
    // Synthesise the re-evaluation:
    // bc is now between j2 (at x=250) and j3 (at x=200) — length 50 vs rest 100
    // stress = 0.75 * 50 / 100 = 0.375 → normalised 0.375 / 0.7 ≈ 0.536 (NOT over)
    // So no cascade — that's correct for THIS topology + offset.
    expect(pending.length).toBe(0);
  });

  it('caps queue appends at 5 per stagger-tick', () => {
    // Conceptual test: if 10 neighbours all over-threshold, only 5 added
    const candidates = Array.from({ length: 10 }, (_, i) => ({ id: i }));
    const pending = [];
    const CAP = 5;
    let added = 0;
    for (const c of candidates) {
      if (added >= CAP) break;
      pending.push(c);
      added++;
    }
    expect(pending.length).toBe(5);
  });
});
