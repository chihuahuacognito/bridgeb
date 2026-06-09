const KEY = (levelId) => `bridgebuilder:save:${levelId}`;

export function saveLayout(levelId, joints, beams, vehicle) {
  const data = {
    version: 1,
    levelId,
    savedAt: Date.now(),
    joints: joints
      .filter(j => !j.isAnchor)
      .map(j => ({ id: j.bodyId, x: Math.round(j.x), y: Math.round(j.y) })),
    beams: beams.map(b => ({ a: b.a.bodyId, b: b.b.bodyId, material: b.material.type })),
    vehicle,
  };
  localStorage.setItem(KEY(levelId), JSON.stringify(data));
}

export function loadLayout(levelId) {
  const raw = localStorage.getItem(KEY(levelId));
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function hasSave(levelId) {
  return localStorage.getItem(KEY(levelId)) !== null;
}
