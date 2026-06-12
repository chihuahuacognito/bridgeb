import { describe, it, expect } from 'vitest';
import { L04, DEV_STRESS } from '../src/data/leveldata.js';

describe('leveldata terrain schema', () => {
  it('L04 has terrain.left and terrain.right with verts and physRect', () => {
    expect(L04.terrain.left.verts).toBeInstanceOf(Array);
    expect(L04.terrain.left.verts.length).toBeGreaterThan(2);
    expect(L04.terrain.left.physRect).toMatchObject({ x: expect.any(Number), y: expect.any(Number), width: expect.any(Number), height: expect.any(Number) });
    expect(L04.terrain.right.verts).toBeInstanceOf(Array);
    expect(L04.terrain.waterY).toBeGreaterThan(0);
  });

  it('L04 has a rocks array (may be empty)', () => {
    expect(Array.isArray(L04.rocks)).toBe(true);
  });

  it('DEV_STRESS rock C1 has id, verts, physRect, color, and anchors', () => {
    const rock = DEV_STRESS.rocks[0];
    expect(rock.id).toBe('C1');
    expect(rock.verts).toBeInstanceOf(Array);
    expect(rock.verts.length).toBeGreaterThan(2);
    expect(rock.physRect).toMatchObject({ x: expect.any(Number), y: expect.any(Number), width: expect.any(Number), height: expect.any(Number) });
    expect(rock.color).toBeDefined();
    expect(Array.isArray(rock.anchors)).toBe(true);
    expect(rock.anchors.length).toBeGreaterThan(0);
  });
});
