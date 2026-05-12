---
Date: 2026-05-12
Content Type: Implementation Plan
---

# Bridge Visual Feedback Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current beam-color-shift stress visualization with a BCP-style two-channel system — stable brown wood base + overlay pulse for stress + reactive joint glow — so material identity and stress are read as separate signals.

**Architecture:** Three layered `Phaser.GameObjects.Graphics` objects in z-order: `beamsGraphics` (back, stable brown base), `stressGraphics` (mid, test-mode-only overlay/wobble/cracks), `jointsGraphics` (front, anchor plates + mid-joint pins + load-reactive glow). Stress visual signal is decoupled from snap tuning via a new `readStrainVisual` reader in `physics.js` that normalizes against a fixed `VISUAL_FULL_STRAIN` constant, not `material.snapThreshold`.

**Tech Stack:** Phaser 3 `Graphics`, Matter.js (read-only in this scope), Vitest 1.

**Spec reference:** `docs/superpowers/specs/2026-05-12-bridge-visual-feedback-design.md`.

---

## Task 1: Add `readStrainVisual` to physics.js (TDD)

**Files:**
- Modify: `src/systems/physics.js`
- Create: `tests/strainVisual.test.js`

- [ ] **Step 1.1: Write the failing test**

Create `tests/strainVisual.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { createHeadlessWorld } from './headlessWorld.js';
import { readStrainVisual } from '../src/systems/physics.js';

describe('readStrainVisual', () => {
  it('returns 0 for a beam at rest length', () => {
    const { Matter, world } = createHeadlessWorld({ gravityY: 0 });
    const a = Matter.Bodies.circle(100, 100, 4, { isStatic: true });
    const b = Matter.Bodies.circle(200, 100, 4, { isStatic: true });
    Matter.Composite.add(world, [a, b]);
    const c = Matter.Constraint.create({ bodyA: a, bodyB: b, length: 100, stiffness: 0.75 });
    expect(readStrainVisual(c)).toBeLessThan(0.01);
  });

  it('returns 0.5 at half VISUAL_FULL_STRAIN stretch (20% of rest)', () => {
    // VISUAL_FULL_STRAIN = 0.4. Half = 0.2. 20% of 100 = 20 → bodies 120 apart.
    const { Matter, world } = createHeadlessWorld({ gravityY: 0 });
    const a = Matter.Bodies.circle(100, 100, 4, { isStatic: true });
    const b = Matter.Bodies.circle(220, 100, 4, { isStatic: true });
    Matter.Composite.add(world, [a, b]);
    const c = Matter.Constraint.create({ bodyA: a, bodyB: b, length: 100, stiffness: 0.75 });
    const v = readStrainVisual(c);
    expect(v).toBeGreaterThan(0.49);
    expect(v).toBeLessThan(0.51);
  });

  it('saturates at 1.0 when stretch >= VISUAL_FULL_STRAIN', () => {
    // 50% stretch (150-100 = 50, ratio 0.5) > VISUAL_FULL_STRAIN 0.4 → saturates.
    const { Matter, world } = createHeadlessWorld({ gravityY: 0 });
    const a = Matter.Bodies.circle(100, 100, 4, { isStatic: true });
    const b = Matter.Bodies.circle(250, 100, 4, { isStatic: true });
    Matter.Composite.add(world, [a, b]);
    const c = Matter.Constraint.create({ bodyA: a, bodyB: b, length: 100, stiffness: 0.75 });
    expect(readStrainVisual(c)).toBe(1);
  });

  it('is independent of material.snapThreshold (snap tuning does not change visual)', () => {
    const { Matter, world } = createHeadlessWorld({ gravityY: 0 });
    const a = Matter.Bodies.circle(100, 100, 4, { isStatic: true });
    const b = Matter.Bodies.circle(220, 100, 4, { isStatic: true });
    Matter.Composite.add(world, [a, b]);
    const c = Matter.Constraint.create({ bodyA: a, bodyB: b, length: 100, stiffness: 0.75 });
    c.material = { snapThreshold: 0.7 };
    const v1 = readStrainVisual(c);
    c.material = { snapThreshold: 2.0 };
    const v2 = readStrainVisual(c);
    expect(v1).toBe(v2);
  });
});
```

- [ ] **Step 1.2: Run the test — expect FAIL**

Run: `npx vitest run tests/strainVisual.test.js`
Expected: FAIL — `readStrainVisual` is not exported from `physics.js`.

- [ ] **Step 1.3: Add `VISUAL_FULL_STRAIN` constant and `readStrainVisual` method**

In `src/systems/physics.js`, just below the existing `SNAP_ABS_PX` line (which is near the top of the file, before the `physics` object), add:

```js
// Visual strain saturation point: the stretch ratio at which the visual
// stress signal reads 1.0. Independent of material.snapThreshold so future
// snap tuning doesn't break the visualization.
const VISUAL_FULL_STRAIN = 0.4;
```

Then, inside the `physics` object, after `readStressSmoothed(c)` (around line 322 in the current file), add:

```js
  // Visual-only strain reader. Returns [0, 1] based on |Δlength|/restLength,
  // saturating at VISUAL_FULL_STRAIN. Distinct from readStressNormalized,
  // which is normalized against material.snapThreshold for the snap mechanic.
  readStrainVisual(c) {
    const cur = Math.hypot(
      c.bodyA.position.x - c.bodyB.position.x,
      c.bodyA.position.y - c.bodyB.position.y
    );
    const rest = Math.max(c.length, MIN_REST_LEN);
    const ratio = Math.abs(cur - rest) / rest;
    return Math.min(1, ratio / VISUAL_FULL_STRAIN);
  },
```

- [ ] **Step 1.4: Add named export at the bottom of physics.js**

Just below the existing `export function readStressSmoothed(...)` block (near the end of the file), add:

```js
export function readStrainVisual(constraint) {
  return physics.readStrainVisual(constraint);
}
```

- [ ] **Step 1.5: Run tests — expect PASS**

Run: `npx vitest run tests/strainVisual.test.js`
Expected: PASS, 4 tests.

Then run the full suite: `npx vitest run`
Expected: PASS, 10 tests total (existing 6 + new 4).

- [ ] **Step 1.6: Commit**

```
git add tests/strainVisual.test.js src/systems/physics.js
git commit -m "feat(viz): add readStrainVisual independent of snap threshold"
```

---

## Task 2: Add VIZ constants block to LevelScene

**Files:**
- Modify: `src/scenes/LevelScene.js`

- [ ] **Step 2.1: Add the constants block**

In `src/scenes/LevelScene.js`, just below the imports (after `import cam from '../systems/camera.js';`), add:

```js
const VIZ = {
  // Stress visual thresholds (independent of snap tuning)
  STRAIN_MED:  0.20,
  STRAIN_HIGH: 0.50,
  STRAIN_CRIT: 0.85,

  // Beam base
  BEAM_BASE_COLOR: 0x9b6b3a,
  BEAM_BASE_THICKNESS: 6,

  // Stress overlay (additive on top of base)
  OVERLAY_COLOR_MED:  0xffd24a,
  OVERLAY_COLOR_HIGH: 0xff8a1f,
  OVERLAY_COLOR_CRIT: 0xff2e2e,
  OVERLAY_THICKNESS_BONUS: 3,
  OVERLAY_ALPHA_BASE: 0.35,
  OVERLAY_ALPHA_PULSE: 0.45,
  PULSE_HZ_MED:  2.0,
  PULSE_HZ_HIGH: 4.5,
  PULSE_HZ_CRIT: 8.0,

  // Crack hatching at CRIT
  CRACK_COUNT: 6,
  CRACK_LENGTH: 12,
  CRACK_COLOR: 0x1a0a0a,

  // Joint visuals
  ANCHOR_COLOR: 0xc23030,
  ANCHOR_SIZE: 14,
  JOINT_COLOR: 0x6b4a25,
  JOINT_RADIUS: 5,
  JOINT_RING_COLOR: 0x3a2510,
  JOINT_GLOW_COLOR_HIGH: 0xff8a1f,
  JOINT_GLOW_COLOR_CRIT: 0xff2e2e,
  JOINT_GLOW_RADIUS_MAX: 22,
  JOINT_GLOW_ALPHA_MAX: 0.55,
};
```

- [ ] **Step 2.2: Verify file parses**

Run: `npx vitest run`
Expected: PASS, 10 tests (constants block is module-top, must not break import).

- [ ] **Step 2.3: Commit**

```
git add src/scenes/LevelScene.js
git commit -m "feat(viz): add VIZ constants block to LevelScene"
```

---

## Task 3: Add `stressGraphics` and `jointsGraphics` to scene

**Files:**
- Modify: `src/scenes/LevelScene.js`

- [ ] **Step 3.1: Add the two new Graphics objects to `create()`**

Find the existing line in `create()`:

```js
    this.beamsGraphics = this.add.graphics();
```

Replace with:

```js
    this.beamsGraphics  = this.add.graphics(); // back: brown base
    this.stressGraphics = this.add.graphics(); // mid: stress overlay (test mode only)
    this.jointsGraphics = this.add.graphics(); // front: anchor plates + joint pins + glow
```

- [ ] **Step 3.2: Verify the scene still constructs**

Run: `npx vitest run`
Expected: PASS, 10 tests.

- [ ] **Step 3.3: Commit**

```
git add src/scenes/LevelScene.js
git commit -m "feat(viz): scaffold stress+joints graphics layers"
```

---

## Task 4: Simplify base beam draw — no more color shift

**Files:**
- Modify: `src/scenes/LevelScene.js`

- [ ] **Step 4.1: Update build-mode `redrawBeams` to use VIZ constants**

Find the existing method (around line 174):

```js
  redrawBeams() {
    this.beamsGraphics.clear();
    this.beamsGraphics.lineStyle(6, 0x9b6b3a, 1); // wood brown
    for (const beam of this.beams) {
      this.beamsGraphics.beginPath();
      this.beamsGraphics.moveTo(beam.a.x, beam.a.y);
      this.beamsGraphics.lineTo(beam.b.x, beam.b.y);
      this.beamsGraphics.strokePath();
    }
  }
```

Replace with:

```js
  // Build-mode base draw: brown wood planks from the design-time data.
  redrawBeams() {
    this.beamsGraphics.clear();
    this.beamsGraphics.lineStyle(VIZ.BEAM_BASE_THICKNESS, VIZ.BEAM_BASE_COLOR, 1);
    for (const beam of this.beams) {
      this.beamsGraphics.beginPath();
      this.beamsGraphics.moveTo(beam.a.x, beam.a.y);
      this.beamsGraphics.lineTo(beam.b.x, beam.b.y);
      this.beamsGraphics.strokePath();
    }
  }
```

- [ ] **Step 4.2: Replace test-mode `redrawBeamsFromBodies` with brown-only base**

Find the existing method (around line 185):

```js
  redrawBeamsFromBodies() {
    this.beamsGraphics.clear();
    for (const { constraint } of physics._beamConstraints) {
      const stress = physics.readStressSmoothed(constraint);
      const color = this.stressColor(stress);
      const thickness = 6 + stress * 2;

      let aX = constraint.bodyA.position.x, aY = constraint.bodyA.position.y;
      let bX = constraint.bodyB.position.x, bY = constraint.bodyB.position.y;
      if (stress > 0.85) {
        const t = this.time.now / 1000;
        const freq = 10; // 10 Hz, spec range 8-12
        const amp = 1.5; // px
        const perp = { x: -(bY - aY), y: (bX - aX) };
        const pm = Math.hypot(perp.x, perp.y) || 1;
        perp.x /= pm; perp.y /= pm;
        const wobble = Math.sin(t * 2 * Math.PI * freq) * amp;
        aX += perp.x * wobble; aY += perp.y * wobble;
        bX += perp.x * wobble; bY += perp.y * wobble;
      }

      this.beamsGraphics.lineStyle(thickness, color, 1);
      this.beamsGraphics.beginPath();
      this.beamsGraphics.moveTo(aX, aY);
      this.beamsGraphics.lineTo(bX, bY);
      this.beamsGraphics.strokePath();
      if (stress > 0.5) this.drawStressGlow(constraint, stress, color);
    }
  }
```

Replace with:

```js
  // Test-mode base draw: brown wood planks from live physics bodies. Always
  // brown, never color-shifted — stress is its own layer (redrawStressOverlay).
  redrawBeamBases() {
    this.beamsGraphics.clear();
    this.beamsGraphics.lineStyle(VIZ.BEAM_BASE_THICKNESS, VIZ.BEAM_BASE_COLOR, 1);
    for (const { constraint } of physics._beamConstraints) {
      const aX = constraint.bodyA.position.x, aY = constraint.bodyA.position.y;
      const bX = constraint.bodyB.position.x, bY = constraint.bodyB.position.y;
      this.beamsGraphics.beginPath();
      this.beamsGraphics.moveTo(aX, aY);
      this.beamsGraphics.lineTo(bX, bY);
      this.beamsGraphics.strokePath();
    }
  }
```

- [ ] **Step 4.3: Update `update()` to call the new method name**

Find the existing line in `update()` (test-mode branch, around line 305):

```js
      this.redrawBeamsFromBodies();
```

Replace with:

```js
      this.redrawBeamBases();
```

- [ ] **Step 4.4: Run tests, refresh browser, sanity-check**

Run: `npx vitest run`
Expected: PASS, 10 tests.

Manual check: `npm run dev`, build any beam, hit TEST. Beams should be solid brown — no more stress-color rainbow. Stress overlay is missing in this state (that's expected; coming in Task 5).

- [ ] **Step 4.5: Commit**

```
git add src/scenes/LevelScene.js
git commit -m "feat(viz): stable brown base for beams; remove stress color-shift"
```

---

## Task 5: Implement stress overlay layer

**Files:**
- Modify: `src/scenes/LevelScene.js`

- [ ] **Step 5.1: Add the overlay color/Hz/alpha picker helper**

Just above the `redrawBeamBases` method, add:

```js
  // Map strain [0,1] to overlay style based on VIZ thresholds.
  // Returns null if below STRAIN_MED (no overlay).
  overlayStyleForStrain(s) {
    if (s < VIZ.STRAIN_MED) return null;
    let color, hz;
    if (s < VIZ.STRAIN_HIGH) {
      color = VIZ.OVERLAY_COLOR_MED;
      hz = VIZ.PULSE_HZ_MED;
    } else if (s < VIZ.STRAIN_CRIT) {
      color = VIZ.OVERLAY_COLOR_HIGH;
      hz = VIZ.PULSE_HZ_HIGH;
    } else {
      color = VIZ.OVERLAY_COLOR_CRIT;
      hz = VIZ.PULSE_HZ_CRIT;
    }
    return { color, hz };
  }
```

- [ ] **Step 5.2: Add `redrawStressOverlay`**

Below `redrawBeamBases`, add:

```js
  // Test-mode-only stress overlay. Draws on top of the brown base:
  //   - pulsing colored stroke above each loaded beam
  //   - perpendicular wobble offset at CRIT strain
  //   - crack hatches at CRIT strain
  // Returns Map<jointBody, maxStrain> for the joints pass to consume.
  redrawStressOverlay() {
    this.stressGraphics.clear();
    const jointStrain = new Map();
    const t = this.time.now / 1000;

    for (const { constraint } of physics._beamConstraints) {
      const s = physics.readStrainVisual(constraint);

      // Track max strain per joint regardless of whether overlay draws.
      const prevA = jointStrain.get(constraint.bodyA) ?? 0;
      const prevB = jointStrain.get(constraint.bodyB) ?? 0;
      if (s > prevA) jointStrain.set(constraint.bodyA, s);
      if (s > prevB) jointStrain.set(constraint.bodyB, s);

      const style = this.overlayStyleForStrain(s);
      if (!style) continue;

      let aX = constraint.bodyA.position.x, aY = constraint.bodyA.position.y;
      let bX = constraint.bodyB.position.x, bY = constraint.bodyB.position.y;

      // Wobble at CRIT (perpendicular sinusoidal offset on both endpoints).
      if (s >= VIZ.STRAIN_CRIT) {
        const perp = { x: -(bY - aY), y: (bX - aX) };
        const pm = Math.hypot(perp.x, perp.y) || 1;
        perp.x /= pm; perp.y /= pm;
        const wobble = Math.sin(t * 2 * Math.PI * 10) * 1.5;
        aX += perp.x * wobble; aY += perp.y * wobble;
        bX += perp.x * wobble; bY += perp.y * wobble;
      }

      const alpha = VIZ.OVERLAY_ALPHA_BASE
        + VIZ.OVERLAY_ALPHA_PULSE * 0.5 * (1 + Math.sin(2 * Math.PI * style.hz * t));
      const thickness = VIZ.BEAM_BASE_THICKNESS + VIZ.OVERLAY_THICKNESS_BONUS * s;

      this.stressGraphics.lineStyle(thickness, style.color, alpha);
      this.stressGraphics.beginPath();
      this.stressGraphics.moveTo(aX, aY);
      this.stressGraphics.lineTo(bX, bY);
      this.stressGraphics.strokePath();

      // Crack hatching at CRIT.
      if (s >= VIZ.STRAIN_CRIT) this.drawCrackHatches(aX, aY, bX, bY);
    }

    return jointStrain;
  }

  // Short perpendicular hash marks scattered along a beam, evoking cracking
  // wood. Deterministic spacing (not time-jittered) so it reads as fracture,
  // not noise.
  drawCrackHatches(aX, aY, bX, bY) {
    const dx = bX - aX, dy = bY - aY;
    const len = Math.hypot(dx, dy) || 1;
    const ux = dx / len, uy = dy / len;       // along beam
    const px = -uy, py = ux;                  // perpendicular
    const half = VIZ.CRACK_LENGTH / 2;
    this.stressGraphics.lineStyle(1, VIZ.CRACK_COLOR, 0.85);
    for (let i = 0; i < VIZ.CRACK_COUNT; i++) {
      const f = (i + 0.5) / VIZ.CRACK_COUNT;  // 0..1 along beam
      const cx = aX + ux * len * f;
      const cy = aY + uy * len * f;
      this.stressGraphics.beginPath();
      this.stressGraphics.moveTo(cx - px * half, cy - py * half);
      this.stressGraphics.lineTo(cx + px * half, cy + py * half);
      this.stressGraphics.strokePath();
    }
  }
```

- [ ] **Step 5.3: Wire `redrawStressOverlay` into `update()` and capture the map**

Find this block in `update()` (test-mode branch):

```js
      this.redrawBeamBases();
      this.redrawVehicle();
      this.checkWin();
      this.checkFall();
```

Replace with:

```js
      this.redrawBeamBases();
      this._jointStrain = this.redrawStressOverlay();
      this.redrawVehicle();
      this.checkWin();
      this.checkFall();
```

- [ ] **Step 5.4: Clear stress graphics on RESET (build-mode entry)**

Find the build-mode branch of `toggleTest()`:

```js
      this.vehicleGraphics?.clear();
```

Add right after that line:

```js
      this.stressGraphics.clear();
      this._jointStrain = null;
```

- [ ] **Step 5.5: Verify, refresh browser**

Run: `npx vitest run`
Expected: PASS, 10 tests.

Manual check: `npm run dev`, build a multi-joint bridge with a sag, hit TEST. As the car drives onto the bridge, loaded beams pulse yellow/orange. Beams at rest stay plain brown. RESET back to build mode → all overlays clear.

- [ ] **Step 5.6: Commit**

```
git add src/scenes/LevelScene.js
git commit -m "feat(viz): stress overlay layer with pulse + crack hatching"
```

---

## Task 6: Implement joints rendering (anchor plates + mid-joint pins + glow)

**Files:**
- Modify: `src/scenes/LevelScene.js`

- [ ] **Step 6.1: Add `redrawJoints` method**

Below the methods added in Task 5, add:

```js
  // Render anchors as bolted plates (no animation) and mid-joints as pins
  // with optional load-reactive glow. jointStrain is a Map<jointBody, [0,1]>
  // built by redrawStressOverlay; pass an empty Map in build mode.
  redrawJoints(jointStrain) {
    this.jointsGraphics.clear();
    for (const body of physics._nodes.values()) {
      const x = body.position.x;
      const y = body.position.y;

      if (body.label === 'anchor') {
        // Filled square with 4 rivet dots at the corners.
        const half = VIZ.ANCHOR_SIZE / 2;
        this.jointsGraphics.fillStyle(VIZ.ANCHOR_COLOR, 1);
        this.jointsGraphics.fillRect(x - half, y - half, VIZ.ANCHOR_SIZE, VIZ.ANCHOR_SIZE);
        this.jointsGraphics.fillStyle(0x3a0a0a, 1);
        const r = half - 3;
        for (const [dx, dy] of [[-r, -r], [r, -r], [-r, r], [r, r]]) {
          this.jointsGraphics.fillCircle(x + dx, y + dy, 1.5);
        }
        continue;
      }

      // Mid-joint pin: optional glow first (so pin draws on top), then ring,
      // then filled pin.
      const s = jointStrain.get(body) ?? 0;
      if (s >= VIZ.STRAIN_HIGH) {
        const denom = Math.max(VIZ.STRAIN_CRIT - VIZ.STRAIN_HIGH, 0.0001);
        const t = Math.min(1, Math.max(0, (s - VIZ.STRAIN_HIGH) / denom));
        const glowColor = Phaser.Display.Color.Interpolate.ColorWithColor(
          Phaser.Display.Color.IntegerToColor(VIZ.JOINT_GLOW_COLOR_HIGH),
          Phaser.Display.Color.IntegerToColor(VIZ.JOINT_GLOW_COLOR_CRIT),
          100, Math.round(t * 100)
        );
        const glowInt = (glowColor.r << 16) | (glowColor.g << 8) | glowColor.b;
        this.jointsGraphics.fillStyle(glowInt, VIZ.JOINT_GLOW_ALPHA_MAX * s);
        this.jointsGraphics.fillCircle(x, y, VIZ.JOINT_GLOW_RADIUS_MAX * s);
      }
      this.jointsGraphics.lineStyle(1, VIZ.JOINT_RING_COLOR, 1);
      this.jointsGraphics.strokeCircle(x, y, VIZ.JOINT_RADIUS + 1);
      this.jointsGraphics.fillStyle(VIZ.JOINT_COLOR, 1);
      this.jointsGraphics.fillCircle(x, y, VIZ.JOINT_RADIUS);
    }
  }
```

- [ ] **Step 6.2: Wire `redrawJoints` into `update()`**

Find this block in `update()` (test-mode branch, just after Task 5's edit):

```js
      this.redrawBeamBases();
      this._jointStrain = this.redrawStressOverlay();
      this.redrawVehicle();
      this.checkWin();
      this.checkFall();
```

Replace with:

```js
      this.redrawBeamBases();
      this._jointStrain = this.redrawStressOverlay();
      this.redrawJoints(this._jointStrain);
      this.redrawVehicle();
      this.checkWin();
      this.checkFall();
```

- [ ] **Step 6.3: Add a build-mode joint redraw call**

In `handleClick()`, right after the existing `this.redrawBeams();` call (around line 144):

```js
      this.redrawBeams();
      this.redrawJoints(new Map());
```

Also in `create()`, after the existing initial scene setup, add a one-time joint draw so anchors appear even before the player places the first beam. Find this line in `create()` (after `physics.setRunnerEnabled(false);`):

```js
    physics.setRunnerEnabled(false);
```

Add right after it:

```js
    this.redrawJoints(new Map());
```

- [ ] **Step 6.4: Remove the obsolete `drawAnchors` call from `create()`**

Find this line near the top of `create()`:

```js
    this.drawAnchors();
```

Remove it. The new `redrawJoints` call now handles anchor rendering. Leave the `drawAnchors` method body itself in place for now (Task 7 will delete it along with other obsolete code).

- [ ] **Step 6.5: Verify, refresh browser**

Run: `npx vitest run`
Expected: PASS, 10 tests.

Manual check: `npm run dev`. In build mode: anchors are red plates with rivet dots. Place a mid-joint by tapping mid-canyon — a brown pin with a ring appears. Hit TEST with a sagging multi-joint bridge — as the car loads the bridge, the mid-joint glows orange → red.

- [ ] **Step 6.6: Commit**

```
git add src/scenes/LevelScene.js
git commit -m "feat(viz): anchor plates + mid-joint pins with load-reactive glow"
```

---

## Task 7: Remove obsolete code

**Files:**
- Modify: `src/scenes/LevelScene.js`

- [ ] **Step 7.1: Delete `stressColor` method**

Find the method (around line 215):

```js
  stressColor(s) {
    // Green (0x33cc33) → Yellow (0xffcc00) → Red (0xff3333)
    if (s < 0.5) {
      const t = s / 0.5;
      return Phaser.Display.Color.GetColor(
        Math.round(0x33 + (0xff - 0x33) * t),
        Math.round(0xcc + (0xcc - 0xcc) * t),
        Math.round(0x33 + (0x00 - 0x33) * t)
      );
    }
    const t = (s - 0.5) / 0.5;
    return Phaser.Display.Color.GetColor(
      0xff,
      Math.round(0xcc - 0xcc * t * 0.6),
      Math.round(0x00 + (0x33 - 0x00) * t)
    );
  }
```

Delete the entire method.

- [ ] **Step 7.2: Delete `drawStressGlow` method**

Find the method (right after `stressColor`):

```js
  drawStressGlow(c, stress, color) {
    const radius = 10 + stress * 12;
    this.beamsGraphics.fillStyle(color, 0.25 * stress);
    const mx = (c.bodyA.position.x + c.bodyB.position.x) / 2;
    const my = (c.bodyA.position.y + c.bodyB.position.y) / 2;
    this.beamsGraphics.fillCircle(mx, my, radius);
  }
```

Delete the entire method.

- [ ] **Step 7.3: Delete `drawAnchors` method**

Search the file for `drawAnchors` (used to be called from `create()`, but no longer). Delete the entire method definition. If it draws anchors as small circles, the new `redrawJoints` already covers it.

- [ ] **Step 7.4: Verify**

Run: `npx vitest run`
Expected: PASS, 10 tests.

Manual check: `npm run dev`. Build a bridge, run TEST. Everything still renders correctly — base brown beams, stress overlay, anchor plates, mid-joint pins, joint glow. Nothing missing.

- [ ] **Step 7.5: Commit**

```
git add src/scenes/LevelScene.js
git commit -m "chore(viz): remove obsolete stressColor + drawStressGlow + drawAnchors"
```

---

## Task 8: Manual verification gauntlet

**Files:** None modified.

This task is a verification-only run; it has no commit because no code changes.

- [ ] **Step 8.1: Single-beam case (acceptance criterion 1 from spec)**

Run `npm run dev`. Click anchor L, click anchor R. One straight beam appears.

Expected (build mode):
- Brown plank line between the two anchors.
- Anchors are red plates with 4 rivet dots.
- No mid-joints.

Hit TEST.

Expected (test mode):
- Beam stays solid brown for the entire run.
- No stress overlay activates (it's a static plank).
- Anchors stay red plates.
- Car drives across and BRIDGE HOLDS overlay appears.

- [ ] **Step 8.2: Sagging V-bridge case (acceptance criterion 2 from spec)**

In build mode, tap somewhere mid-canyon below the anchor line to create a mid-joint, then connect anchor L → mid-joint → anchor R.

Expected (build mode):
- Brown beams form a V.
- Anchors are red plates; mid-joint is a brown pin with ring.

Hit TEST.

Expected (test mode):
- As car begins driving, beams start showing faint yellow pulse where load is.
- Mid-joint stays plain brown until load on incident beams reaches `STRAIN_HIGH`, then it starts glowing orange.
- If strain crosses `STRAIN_CRIT`, beams turn red, crack hatches appear, joint glow approaches red.
- Camera follows, slow-mo if snaps occur.

- [ ] **Step 8.3: Mode-cycle test (acceptance criterion 3 from spec)**

After running the sagging-V test, hit RESET. Watch the transition.

Expected:
- All overlays clear (no leftover yellow pulse, no joint glow).
- Camera returns to scroll 0,0.
- Beams are brown planks; anchors are red plates; mid-joint is a plain brown pin.
- Player's bridge layout is preserved (manual RESET keeps the design).

Hit TEST a second time.

Expected:
- Test mode replays cleanly; no residue from the previous test.

- [ ] **Step 8.4: Run full Vitest suite (acceptance criterion 4 from spec)**

Run: `npx vitest run`
Expected: PASS, all 10 tests (existing 6 + new 4 from Task 1).

- [ ] **Step 8.5: Update `FEEL_LOG.md`**

Open `FEEL_LOG.md` and add a new section at the bottom:

```markdown
## Session 9 — 2026-05-12

| Pillar | Score 1–5 | Notes |
|---|---|---|
| 1.1 Physics-feel  | [score] | [notes after running gauntlet] |
| 1.2 Visual language | [score] | BCP-style stress overlay + joint glow + anchor plates. Material identity stable. |
| 1.3 Camera        | N/A | unchanged this session |
| 1.4 Audio         | N/A | unchanged this session |
```

Fill in the scores and notes from the manual gauntlet.

- [ ] **Step 8.6: Commit FEEL_LOG update**

```
git add FEEL_LOG.md
git commit -m "chore(session-9): feel-log entry for visual feedback layer"
```

---

## Self-review summary

Spec coverage:
- Visual contract (spec §Visual contract) — Tasks 4, 5, 6 implement each row.
- Load model (spec §Load model) — Task 1 implements `readStrainVisual` + `VISUAL_FULL_STRAIN`, decoupled from `snapThreshold`.
- Rendering architecture (spec §Rendering architecture) — Task 3 scaffolds the three Graphics objects; Tasks 4/5/6 implement the three passes.
- Tuning constants (spec §Tuning numbers) — Task 2.
- Code removed (spec §Code removed) — Task 7.
- Testing (spec §Testing) — Task 8 runs the four acceptance criteria as a manual gauntlet plus full Vitest run.
- Architecture invariants (spec §Architecture invariants honored) — physics seam preserved (Task 1 reads constraint properties only, no `scene.matter.*`); no new system module, so lifecycle contract untouched; `level.vehicles` untouched.

Placeholder scan: no `TODO`, no "fill in details", no "similar to Task N", no missing code blocks. Every code step has runnable content.

Type consistency: method names used consistently — `redrawBeamBases`, `redrawStressOverlay`, `redrawJoints`, `overlayStyleForStrain`, `drawCrackHatches`. The Map name `_jointStrain` is consistent across update() and toggleTest(). VIZ constant names match between the spec and the constants block.
