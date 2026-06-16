// src/utils/prebuilt.js
// Pure expansion of a level's `prebuilt` block into scene-shaped joints/beams
// plus per-material cost (deducted from the split budget at runtime).
export function expandPrebuilt(level) {
  const pb = level.prebuilt;
  if (!pb) return { joints: [], beams: [], cost: { road: 0, wood: 0 } };

  const joints = pb.joints.map(j => ({ x: j.x, y: j.y, isAnchor: false, bodyId: j.id }));

  const cost = { road: 0, wood: 0 };
  const beams = pb.beams.map(b => {
    const matKey = b.material === 'road' ? 'road' : 'wood';
    const mat = level.materials[matKey];
    const c = mat.blocks?.[b.size]?.cost ?? mat.cost;
    cost[matKey] += c;
    return { a: b.a, b: b.b, material: mat, cost: c };
  });

  return { joints, beams, cost };
}
