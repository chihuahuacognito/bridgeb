// src/utils/prebuilt.js
// Pure expansion of a level's `prebuilt` block into scene-shaped joints/beams
// plus the total cost (deducted from the level budget at runtime).
export function expandPrebuilt(level) {
  const pb = level.prebuilt;
  if (!pb) return { joints: [], beams: [], cost: 0 };

  const joints = pb.joints.map(j => ({ x: j.x, y: j.y, isAnchor: false, bodyId: j.id }));

  let cost = 0;
  const beams = pb.beams.map(b => {
    const mat = level.materials[b.material === 'road' ? 'road' : 'wood'];
    const c = mat.blocks?.[b.size]?.cost ?? mat.cost;
    cost += c;
    return { a: b.a, b: b.b, material: mat, cost: c };
  });

  return { joints, beams, cost };
}
