// tests/convoy.test.js
import { describe, it, expect } from 'vitest';
import { makeConvoyController } from '../src/systems/convoy.js';

const opts = { count: 3, gapMs: 1000, checkpointX: 1000, worldHeight: 720 };

describe('makeConvoyController spawn cadence', () => {
  it('spawns vehicle 0 immediately on the first tick', () => {
    const c = makeConvoyController(opts);
    const r = c.tick(5000, []);
    expect(r.toSpawn).toEqual([{ index: 0 }]);
  });

  it('does not spawn vehicle 1 until a full gap has elapsed', () => {
    const c = makeConvoyController(opts);
    c.tick(5000, []);                       // t0 -> spawn 0
    expect(c.tick(5500, []).toSpawn).toEqual([]);   // +500ms, too early
    expect(c.tick(6000, []).toSpawn).toEqual([{ index: 1 }]); // +1000ms
  });

  it('spawns multiple at once if the loop fell behind', () => {
    const c = makeConvoyController(opts);
    c.tick(0, []);                          // spawn 0 at t0
    const r = c.tick(2500, []);             // 2.5 gaps later -> 1 and 2
    expect(r.toSpawn).toEqual([{ index: 1 }, { index: 2 }]);
  });
});

describe('makeConvoyController win/fail', () => {
  it('wins only after all spawned AND all crossed', () => {
    const c = makeConvoyController(opts);
    c.tick(0, []);
    c.tick(3000, []);                        // all 3 spawned by now
    const notYet = c.tick(3000, [
      { id: 0, x: 1000, y: 300, crossed: true },
      { id: 1, x: 500,  y: 300, crossed: false },
      { id: 2, x: 200,  y: 300, crossed: false },
    ]);
    expect(notYet.won).toBe(false);
    expect(notYet.crossedCount).toBe(1);
    const done = c.tick(3000, [
      { id: 0, x: 1200, y: 300, crossed: true },
      { id: 1, x: 1100, y: 300, crossed: true },
      { id: 2, x: 1000, y: 300, crossed: false }, // x>=checkpointX counts as crossed
    ]);
    expect(done.won).toBe(true);
    expect(done.crossedCount).toBe(3);
  });

  it('fails the instant any vehicle drops below the world', () => {
    const c = makeConvoyController(opts);
    c.tick(0, []);
    const r = c.tick(100, [{ id: 0, x: 300, y: 720 + 41, crossed: false }]);
    expect(r.failed).toBe(true);
    expect(r.won).toBe(false);
  });

  it('treats a length-1 convoy like a single vehicle', () => {
    const c = makeConvoyController({ ...opts, count: 1 });
    expect(c.tick(0, []).toSpawn).toEqual([{ index: 0 }]);
    expect(c.tick(50, [{ id: 0, x: 1000, y: 300, crossed: true }]).won).toBe(true);
  });
});
