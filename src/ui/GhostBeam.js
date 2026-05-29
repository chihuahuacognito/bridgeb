// src/ui/GhostBeam.js
// Renders a ghost preview when the player is placing a block.
//
// Two placement modes:
//   CURSOR-TARGET  — cursor is hovering near an existing joint (other than the
//                    anchor). Ghost connects anchor → that joint directly,
//                    bypassing blockLength and angle-snap. Both endpoints glow.
//   EXTEND         — cursor is in open space. Ghost extends blockLength from
//                    anchor in the nearest constrained angle direction. Far end
//                    snaps to existing joints within FAR_SNAP_RADIUS.

const CONSTRAINED_DEG = [0, 30, 45, 60, 90, 120, 135, 150, 180, 210, 225, 240, 270, 300, 315, 330];
const ANCHOR_VALID_RADIUS  = 220; // px — ghost turns red beyond this from any joint
const CURSOR_TARGET_RADIUS =  60; // px — hovering this close to a 2nd joint locks the far end
const SIZE_LABELS = { 40: 'S', 80: 'M', 160: 'L', 240: 'XL' };

function snapAngle(rawDeg) {
  const norm = ((rawDeg % 360) + 360) % 360;
  let best = CONSTRAINED_DEG[0], bestDelta = Infinity;
  for (const a of CONSTRAINED_DEG) {
    const delta = Math.abs(((norm - a + 540) % 360) - 180);
    if (delta < bestDelta) { bestDelta = delta; best = a; }
  }
  return best;
}

export class GhostBeam {
  constructor(scene) {
    this._scene    = scene;
    this._gfx      = scene.add.graphics().setDepth(20);
    this._tooltipBg = scene.add.rectangle(0, 0, 160, 22, 0x000000, 0.70)
      .setScrollFactor(0).setDepth(22).setVisible(false);
    this._tooltip  = scene.add.text(0, 0, '', {
      fontSize: '11px', color: '#aabbcc', fontFamily: 'monospace',
    }).setScrollFactor(0).setDepth(23).setVisible(false);
    this._active   = false;
    this._last     = null;   // last computed placement result
  }

  show() { this._active = true; }

  hide() {
    this._active = false;
    this._gfx.clear();
    this._tooltipBg.setVisible(false);
    this._tooltip.setVisible(false);
    this._last = null;
  }

  // Call each frame on pointermove. cursorWorld = { x, y } in world coords.
  update(cursorWorld, joints, blockLength, snapRadius, material) {
    this._gfx.clear();
    if (!this._active) { this._tooltipBg.setVisible(false); this._tooltip.setVisible(false); return; }
    if (!joints.length) { return; }

    // ── 1. Anchor: nearest joint to cursor ────────────────────────────────────
    let anchorJoint = null, bestDist = Infinity;
    for (const j of joints) {
      const d = Math.hypot(j.x - cursorWorld.x, j.y - cursorWorld.y);
      if (d < bestDist) { bestDist = d; anchorJoint = j; }
    }
    const isValid = bestDist <= ANCHOR_VALID_RADIUS;

    // ── 2. Cursor-target: is cursor hovering near a DIFFERENT joint? ──────────
    // If so, go directly from anchor → that joint (no blockLength, no angle snap).
    // This is how diagonal bracing connects two existing joints: hover near the
    // destination joint to lock the far end onto it.
    let cursorTarget = null;
    let bestCursorTargetDist = CURSOR_TARGET_RADIUS;
    for (const j of joints) {
      if (j === anchorJoint) continue;
      const d = Math.hypot(j.x - cursorWorld.x, j.y - cursorWorld.y);
      if (d < bestCursorTargetDist) { bestCursorTargetDist = d; cursorTarget = j; }
    }

    // ── 3. Compute far endpoint ───────────────────────────────────────────────
    let farX, farY, farJoint, angleDeg, isCursorTargetMode;

    if (cursorTarget) {
      // CURSOR-TARGET MODE: connect anchor → cursor-targeted joint directly
      isCursorTargetMode = true;
      farX     = cursorTarget.x;
      farY     = cursorTarget.y;
      farJoint = cursorTarget;
      angleDeg = Math.atan2(farY - anchorJoint.y, farX - anchorJoint.x) * 180 / Math.PI;
    } else {
      // EXTEND MODE: blockLength + angle-snap + far-end snap
      isCursorTargetMode = false;
      const dx = cursorWorld.x - anchorJoint.x;
      const dy = cursorWorld.y - anchorJoint.y;
      const hasDir = Math.hypot(dx, dy) > 4;
      const rawDeg = hasDir ? Math.atan2(dy, dx) * 180 / Math.PI : (this._last?.angleDeg ?? 0);
      angleDeg = snapAngle(rawDeg);
      const angleRad = angleDeg * Math.PI / 180;

      farX = anchorJoint.x + Math.cos(angleRad) * blockLength;
      farY = anchorJoint.y + Math.sin(angleRad) * blockLength;

      // Generous far-end snap: find nearest joint within FAR_SNAP_RADIUS of the
      // computed endpoint. Larger than SNAP_RADIUS so diagonal targets are reachable.
      farJoint = null;
      const FAR_SNAP_RADIUS = Math.max(snapRadius * 4, 80);
      let bestFarDist = FAR_SNAP_RADIUS;
      for (const j of joints) {
        if (j === anchorJoint) continue;
        const d = Math.hypot(j.x - farX, j.y - farY);
        if (d < bestFarDist) { bestFarDist = d; farJoint = j; }
      }
      if (farJoint) { farX = farJoint.x; farY = farJoint.y; }
    }

    this._last = {
      anchorJoint,
      farEnd: { x: farX, y: farY, bodyId: farJoint?.bodyId },
      farJoint,
      angleDeg,
      isValid,
    };

    // ── 4. Draw ───────────────────────────────────────────────────────────────
    const isRoad    = material?.type === 'road';
    const baseColor = isRoad ? 0x888888 : 0xd48a0c;
    const thickness = isRoad ? 8 : 5;
    const alpha     = isValid ? 0.65 : 0.30;
    const edgeColor = isValid ? 0x55aaff : 0xff4444;

    // Beam body
    this._gfx.lineStyle(thickness, baseColor, alpha);
    this._gfx.beginPath();
    this._gfx.moveTo(anchorJoint.x, anchorJoint.y);
    this._gfx.lineTo(farX, farY);
    this._gfx.strokePath();

    // Edge outline — brighter teal in cursor-target mode to signal the snap
    const lineEdgeColor = isCursorTargetMode ? 0x44ffcc : edgeColor;
    this._gfx.lineStyle(1.5, lineEdgeColor, isValid ? 0.55 : 0.45);
    this._gfx.beginPath();
    this._gfx.moveTo(anchorJoint.x, anchorJoint.y);
    this._gfx.lineTo(farX, farY);
    this._gfx.strokePath();

    // Anchor endpoint
    this._gfx.fillStyle(edgeColor, isValid ? 0.85 : 0.55);
    this._gfx.fillCircle(anchorJoint.x, anchorJoint.y, 7);
    if (isCursorTargetMode) {
      // Extra ring on anchor too in cursor-target mode — shows "this end is also locked"
      this._gfx.lineStyle(2, 0x44ffcc, 0.6);
      this._gfx.strokeCircle(anchorJoint.x, anchorJoint.y, 13);
    }

    // Far endpoint
    if (farJoint) {
      // Snapping to existing joint: bright green with double ring
      this._gfx.fillStyle(0x44ff88, 0.85);
      this._gfx.fillCircle(farX, farY, 8);
      this._gfx.lineStyle(2.5, 0x88ffcc, 1);
      this._gfx.strokeCircle(farX, farY, 13);
      this._gfx.lineStyle(1.5, 0x88ffcc, 0.5);
      this._gfx.strokeCircle(farX, farY, 20);
    } else {
      this._gfx.fillStyle(0xffffff, 0.55);
      this._gfx.fillCircle(farX, farY, 5);
    }

    // ── 5. Tooltip in screen coords ───────────────────────────────────────────
    const cam = this._scene.cameras.main;
    const sx  = (farX - cam.scrollX) * cam.zoom + 14;
    const sy  = (farY - cam.scrollY) * cam.zoom - 16;
    const szLabel = SIZE_LABELS[blockLength] ?? `${blockLength}px`;
    const matName = isRoad ? 'Road' : 'Beam';
    const modeTag = isCursorTargetMode ? 'SNAP' : `${Math.round(angleDeg)}°`;
    const text = `${szLabel} ${matName}  ${modeTag}`;
    this._tooltip.setText(text).setPosition(sx + 6, sy).setVisible(true);
    this._tooltipBg.setSize(text.length * 7 + 12, 20).setPosition(sx + text.length * 3.5 + 6, sy + 10).setVisible(true);
  }

  // Returns placement data if the current ghost is in a valid state, else null.
  getPlacement() {
    if (!this._last?.isValid) return null;
    return this._last;
  }

  destroy() {
    this._gfx.destroy();
    this._tooltipBg.destroy();
    this._tooltip.destroy();
  }
}
