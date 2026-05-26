import { describe, it, expect } from 'vitest';
import { nearestPointOnSegment, findBeamSnap } from '../src/utils/snapGeometry.js';

describe('nearestPointOnSegment', () => {
  it('returns midpoint when P projects onto middle of AB', () => {
    const r = nearestPointOnSegment({ x: 150, y: 10 }, { x: 0, y: 0 }, { x: 300, y: 0 });
    expect(r.x).toBeCloseTo(150);
    expect(r.y).toBeCloseTo(0);
    expect(r.t).toBeCloseTo(0.5);
  });

  it('clamps t to 0 when P is before A', () => {
    const r = nearestPointOnSegment({ x: -50, y: 0 }, { x: 0, y: 0 }, { x: 100, y: 0 });
    expect(r.t).toBe(0);
    expect(r.x).toBeCloseTo(0);
  });

  it('clamps t to 1 when P is past B', () => {
    const r = nearestPointOnSegment({ x: 200, y: 0 }, { x: 0, y: 0 }, { x: 100, y: 0 });
    expect(r.t).toBe(1);
    expect(r.x).toBeCloseTo(100);
  });

  it('works on a diagonal segment', () => {
    const r = nearestPointOnSegment({ x: 0, y: 100 }, { x: 0, y: 0 }, { x: 100, y: 100 });
    expect(r.t).toBeCloseTo(0.5);
    expect(r.x).toBeCloseTo(50);
    expect(r.y).toBeCloseTo(50);
  });
});

describe('findBeamSnap', () => {
  const beams = [
    { a: { x: 0, y: 0 }, b: { x: 200, y: 0 } },
  ];

  it('returns null when cursor is outside radius', () => {
    expect(findBeamSnap({ x: 100, y: 40 }, beams, 20)).toBeNull();
  });

  it('returns snap when cursor is within radius of beam midpoint', () => {
    const snap = findBeamSnap({ x: 100, y: 10 }, beams, 20);
    expect(snap).not.toBeNull();
    expect(snap.beamIndex).toBe(0);
    expect(snap.point.x).toBeCloseTo(100);
    expect(snap.t).toBeCloseTo(0.5);
  });

  it('ignores points within 5% of endpoints (t < 0.05 or t > 0.95)', () => {
    expect(findBeamSnap({ x: 2, y: 5 }, beams, 20)).toBeNull();
    expect(findBeamSnap({ x: 198, y: 5 }, beams, 20)).toBeNull();
  });

  it('returns the closest beam when multiple beams are in range', () => {
    const twoBeams = [
      { a: { x: 0, y: 0 }, b: { x: 200, y: 0 } },
      { a: { x: 0, y: 8 }, b: { x: 200, y: 8 } },
    ];
    // cursor at y=5: beam0 is 5px away, beam1 is 3px away → beam1 wins
    const snap = findBeamSnap({ x: 100, y: 5 }, twoBeams, 20);
    expect(snap.beamIndex).toBe(1);
  });
});
