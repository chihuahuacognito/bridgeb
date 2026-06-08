// Renders a clearly-labeled placeholder rectangle for missing world-art assets.
// Spec STYLE_SPEC §7: do not improvise the 3D style; flag missing assets visibly.

export function drawPlaceholder(scene, x, y, w, h, label, depth = -50) {
  const g = scene.add.graphics().setDepth(depth);
  g.fillStyle(0xff00ff, 0.30);
  g.fillRect(x, y, w, h);
  g.lineStyle(2, 0xff00ff, 1);
  g.strokeRect(x, y, w, h);
  const t = scene.add.text(x + w / 2, y + h / 2, `MISSING\n${label}.png`, {
    fontSize: '12px', color: '#ffffff', fontFamily: 'monospace', align: 'center',
    backgroundColor: '#aa0066', padding: { x: 4, y: 2 },
  }).setOrigin(0.5).setDepth(depth + 1);
  return { g, t };
}
