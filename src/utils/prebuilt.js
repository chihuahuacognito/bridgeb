// src/utils/prebuilt.js
// Pure expansion of a level's `prebuilt` block into scene-shaped joints/beams
// plus a single total cost (deducted from the budget at runtime).
import { resolveMaterial } from '../data/materials.js';

export function expandPrebuilt(level) {
  const pb = level.prebuilt;
  if (!pb) return { joints: [], beams: [], cost: 0 };

  const joints = pb.joints.map(j => ({ x: j.x, y: j.y, isAnchor: false, bodyId: j.id }));

  let cost = 0;
  const beams = pb.beams.map(b => {
    // Prefer the level's tuned material object (keyed 'road'/'wood'); fall back
    // to the shared registry (also handles material ids and legacy keys).
    const mat = level.materials?.[b.material] ?? resolveMaterial(b.material);
    const c = mat.blocks?.[b.size]?.cost ?? mat.cost;
    cost += c;
    return { a: b.a, b: b.b, material: mat, cost: c };
  });

  return { joints, beams, cost };
}
