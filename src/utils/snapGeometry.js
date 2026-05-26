// src/utils/snapGeometry.js

export function nearestPointOnSegment(P, A, B) {
  const dx = B.x - A.x;
  const dy = B.y - A.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return { x: A.x, y: A.y, t: 0 };
  const t = Math.max(0, Math.min(1, ((P.x - A.x) * dx + (P.y - A.y) * dy) / lenSq));
  return { x: A.x + t * dx, y: A.y + t * dy, t };
}

// Returns { point: {x,y}, beamIndex, t } or null.
// Excludes points within 5% of either endpoint so you don't accidentally
// "split" a beam right next to its joint node.
export function findBeamSnap(P, beams, radius) {
  let best = null;
  let bestDist = radius;
  for (let i = 0; i < beams.length; i++) {
    const near = nearestPointOnSegment(P, beams[i].a, beams[i].b);
    if (near.t < 0.05 || near.t > 0.95) continue;
    const dist = Math.hypot(P.x - near.x, P.y - near.y);
    if (dist < bestDist) {
      bestDist = dist;
      best = { point: { x: near.x, y: near.y }, beamIndex: i, t: near.t };
    }
  }
  return best;
}
