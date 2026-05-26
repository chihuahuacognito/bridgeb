# Sag System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make unsupported road segments visibly droop and sag over 3–5 seconds before snapping, with unmistakably distinct green/yellow/red stress colours, a snap flash, and a first-break marker.

**Architecture:** Four independent code areas — physics tuning in `leveldata.js` + `physics.js`, bezier curve draw in `redrawBeamBases()`, colour/thickness constants in the VIZ block + `overlayStyleForStrain()` + `redrawStressOverlay()`, and snap effects in the `setOnSnap` callback + a new `redrawSnapMarkers()`. No new files. No changes to physics.js public API.

**Tech Stack:** Phaser 3, Matter.js, Vite, vanilla JS (no test framework — manual acceptance test checklist in Task 5)

---

### Task 1: Physics tuning — leveldata.js and physics.js

**Files:**
- Modify: `src/data/leveldata.js` lines 25–26 and 51–52
- Modify: `src/systems/physics.js` line 99 (density) and line 151 (damping)

This task softens the road spring so joints droop further and more slowly before snapping. Heavier joint density and more damping prevent bounce. Wood/support values are unchanged.

- [ ] **Step 1: Update road material values in `src/data/leveldata.js`**

In L1 (line 25) and DEV_STRESS (line 51), change `road` from:
```js
road: { type: 'road', cost: 2, stiffness: 0.15, snapThreshold: 0.30 },
```
to:
```js
road: { type: 'road', cost: 2, stiffness: 0.08, snapThreshold: 0.50 },
```

Both levels get the same change. Wood lines are untouched.

- [ ] **Step 2: Update joint density in `src/systems/physics.js` line 99**

Change:
```js
density: 0.05,
```
to:
```js
density: 0.10,
```

This is inside `ensureJointNode()`. Heavier joints sag further under their own weight.

- [ ] **Step 3: Update constraint damping in `src/systems/physics.js` line 151**

Change:
```js
const constraint = this._scene.matter.add.constraint(
  bodyA, bodyB, length, material.stiffness, { damping: 0.05 }
);
```
to:
```js
const constraint = this._scene.matter.add.constraint(
  bodyA, bodyB, length, material.stiffness, { damping: 0.08 }
);
```

More damping makes the droop steady rather than bouncy.

- [ ] **Step 4: Commit**

```bash
git add src/data/leveldata.js src/systems/physics.js
git commit -m "feat(physics): sag tuning — softer road springs, heavier joints, more damping"
```

- [ ] **Step 5: Smoke test**

Open `http://localhost:5173`, switch to DEV_STRESS, build a flat road span with no supports, run TEST. The car should cross more slowly and the road should droop noticeably further before snapping compared to before.

---

### Task 2: Bezier sag curve in redrawBeamBases()

**Files:**
- Modify: `src/scenes/LevelScene.js` — add `SAG_DEPTH_FACTOR` constant at top, rewrite `redrawBeamBases()` lines 513–527

Road segments draw as quadratic bezier curves that droop downward in proportion to their visual strain. Wood/support segments remain straight lines. Build mode (`redrawBeams()`) is unchanged — it has no strain data.

- [ ] **Step 1: Add SAG_DEPTH_FACTOR constant at top of LevelScene.js**

After the `const DEBUG_HUD = true;` line (line 11), add:
```js
const SAG_DEPTH_FACTOR = 0.10;
```

- [ ] **Step 2: Rewrite `redrawBeamBases()` to draw bezier curves for road**

Replace the existing `redrawBeamBases()` body (lines 513–527):

```js
// Current (to remove):
  redrawBeamBases() {
    this.beamsGraphics.clear();
    for (const { constraint, type } of physics._beamConstraints) {
      const isRoad = type === 'road';
      this.beamsGraphics.lineStyle(
        isRoad ? VIZ.ROAD_THICKNESS : VIZ.BEAM_THICKNESS,
        isRoad ? VIZ.ROAD_COLOR     : VIZ.BEAM_COLOR, 1);
      const aX = constraint.bodyA.position.x, aY = constraint.bodyA.position.y;
      const bX = constraint.bodyB.position.x, bY = constraint.bodyB.position.y;
      this.beamsGraphics.beginPath();
      this.beamsGraphics.moveTo(aX, aY);
      this.beamsGraphics.lineTo(bX, bY);
      this.beamsGraphics.strokePath();
    }
  }
```

with:

```js
  redrawBeamBases() {
    this.beamsGraphics.clear();
    for (const { constraint, type } of physics._beamConstraints) {
      const isRoad = type === 'road';
      this.beamsGraphics.lineStyle(
        isRoad ? VIZ.ROAD_THICKNESS : VIZ.BEAM_THICKNESS,
        isRoad ? VIZ.ROAD_COLOR     : VIZ.BEAM_COLOR, 1);
      const aX = constraint.bodyA.position.x, aY = constraint.bodyA.position.y;
      const bX = constraint.bodyB.position.x, bY = constraint.bodyB.position.y;
      const midX = (aX + bX) / 2;
      const midY = (aY + bY) / 2;
      this.beamsGraphics.beginPath();
      this.beamsGraphics.moveTo(aX, aY);
      if (isRoad) {
        const segLen = Math.hypot(bX - aX, bY - aY);
        const strain = physics.readStrainVisual(constraint);
        const sagDepth = strain * segLen * SAG_DEPTH_FACTOR;
        // Control point is ×2 sagDepth so the curve passes through midY+sagDepth
        this.beamsGraphics.quadraticCurveTo(midX, midY + sagDepth * 2, bX, bY);
      } else {
        this.beamsGraphics.lineTo(bX, bY);
      }
      this.beamsGraphics.strokePath();
    }
  }
```

- [ ] **Step 3: Commit**

```bash
git add src/scenes/LevelScene.js
git commit -m "feat(viz): bezier sag curve on road segments — droops proportional to strain"
```

- [ ] **Step 4: Smoke test**

Run TEST on a flat unsupported road. As the car loads the span, the road base line should visibly curve downward at the midpoint. At low strain it should be subtle; at high strain (near snap) it should droop dramatically. Build mode segments should still draw straight.

---

### Task 3: Stress colour overhaul — VIZ constants + overlayStyleForStrain + redrawStressOverlay

**Files:**
- Modify: `src/scenes/LevelScene.js` — VIZ block (lines 13–61), `overlayStyleForStrain()` (lines 496–510), `redrawStressOverlay()` line 566, `redrawJoints()` (around line 622)

Replace the warm-only yellow → orange → red progression with a traffic-light green → yellow → red progression. Step-based thickness (3/8/14px bonus) replaces the continuous `BONUS * strain` formula. CRIT pulse drops from 8Hz to 2Hz to avoid photosensitivity risk.

- [ ] **Step 1: Update VIZ constants**

In the VIZ block, make these changes:

```js
// Stress overlay — BEFORE (lines 31–39):
  OVERLAY_COLOR_MED:  0xffd24a,
  OVERLAY_COLOR_HIGH: 0xff8a1f,
  OVERLAY_COLOR_CRIT: 0xff2e2e,
  OVERLAY_THICKNESS_BONUS: 6,
  OVERLAY_ALPHA_BASE: 0.50,
  OVERLAY_ALPHA_PULSE: 0.45,
  PULSE_HZ_MED:  2.0,
  PULSE_HZ_HIGH: 4.5,
  PULSE_HZ_CRIT: 8.0,

// AFTER:
  OVERLAY_COLOR_MED:  0x44ff44,   // bright green — traffic light
  OVERLAY_COLOR_HIGH: 0xffee00,   // bright yellow
  OVERLAY_COLOR_CRIT: 0xff1111,   // red
  OVERLAY_THICKNESS_BONUS: 3,     // MED stage bonus (px)
  OVERLAY_THICKNESS_HIGH:  8,     // HIGH stage bonus (px)
  OVERLAY_THICKNESS_CRIT:  14,    // CRIT stage bonus (px)
  OVERLAY_ALPHA_BASE: 0.50,
  OVERLAY_ALPHA_PULSE: 0.45,
  PULSE_HZ_MED:  2.0,
  PULSE_HZ_HIGH: 4.5,
  PULSE_HZ_CRIT: 2.0,             // was 8.0 — photosensitivity safe
```

Also update the joint glow colours (lines 52–53) and add MED glow:

```js
// BEFORE:
  JOINT_GLOW_COLOR_HIGH: 0xff8a1f,
  JOINT_GLOW_COLOR_CRIT: 0xff2e2e,

// AFTER:
  JOINT_GLOW_COLOR_MED:  0x44ff44,
  JOINT_GLOW_COLOR_HIGH: 0xffee00,
  JOINT_GLOW_COLOR_CRIT: 0xff1111,
```

- [ ] **Step 2: Update `overlayStyleForStrain()` to include thickness**

Replace the existing `overlayStyleForStrain()` (lines 496–510):

```js
  overlayStyleForStrain(s) {
    if (s < VIZ.STRAIN_MED) return null;
    let color, hz, thickness;
    if (s < VIZ.STRAIN_HIGH) {
      color = VIZ.OVERLAY_COLOR_MED;
      hz = VIZ.PULSE_HZ_MED;
      thickness = VIZ.BEAM_BASE_THICKNESS + VIZ.OVERLAY_THICKNESS_BONUS;
    } else if (s < VIZ.STRAIN_CRIT) {
      color = VIZ.OVERLAY_COLOR_HIGH;
      hz = VIZ.PULSE_HZ_HIGH;
      thickness = VIZ.BEAM_BASE_THICKNESS + VIZ.OVERLAY_THICKNESS_HIGH;
    } else {
      color = VIZ.OVERLAY_COLOR_CRIT;
      hz = VIZ.PULSE_HZ_CRIT;
      thickness = VIZ.BEAM_BASE_THICKNESS + VIZ.OVERLAY_THICKNESS_CRIT;
    }
    return { color, hz, thickness };
  }
```

- [ ] **Step 3: Use step thickness in `redrawStressOverlay()`**

In `redrawStressOverlay()`, find line 566:
```js
      const thickness = VIZ.BEAM_BASE_THICKNESS + VIZ.OVERLAY_THICKNESS_BONUS * s;
```
Replace with:
```js
      const thickness = style.thickness;
```

(`style` is already assigned from `overlayStyleForStrain(s)` on the line above.)

- [ ] **Step 4: Add MED glow to `redrawJoints()`**

Currently glow only draws when `s >= VIZ.STRAIN_HIGH` (line 623). The MED stage now needs a green glow. Also update the color interpolation to go from MED→HIGH→CRIT.

Replace the glow block in `redrawJoints()`:

```js
// BEFORE (lines 622–634):
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

// AFTER:
      const s = jointStrain.get(body) ?? 0;
      if (s >= VIZ.STRAIN_MED) {
        let glowInt;
        if (s < VIZ.STRAIN_HIGH) {
          glowInt = VIZ.JOINT_GLOW_COLOR_MED;
        } else if (s < VIZ.STRAIN_CRIT) {
          const denom = Math.max(VIZ.STRAIN_CRIT - VIZ.STRAIN_HIGH, 0.0001);
          const t = Math.min(1, Math.max(0, (s - VIZ.STRAIN_HIGH) / denom));
          const gc = Phaser.Display.Color.Interpolate.ColorWithColor(
            Phaser.Display.Color.IntegerToColor(VIZ.JOINT_GLOW_COLOR_HIGH),
            Phaser.Display.Color.IntegerToColor(VIZ.JOINT_GLOW_COLOR_CRIT),
            100, Math.round(t * 100)
          );
          glowInt = (gc.r << 16) | (gc.g << 8) | gc.b;
        } else {
          glowInt = VIZ.JOINT_GLOW_COLOR_CRIT;
        }
        this.jointsGraphics.fillStyle(glowInt, VIZ.JOINT_GLOW_ALPHA_MAX * s);
        this.jointsGraphics.fillCircle(x, y, VIZ.JOINT_GLOW_RADIUS_MAX * s);
      }
```

- [ ] **Step 5: Commit**

```bash
git add src/scenes/LevelScene.js
git commit -m "feat(viz): traffic-light stress colours — green/yellow/red with step thickness"
```

- [ ] **Step 6: Smoke test**

Run TEST. At low load the overlay should show **green** on the beam. As the car reaches midspan it should shift to **yellow**. Near snap it should shift to **red** with a slow pulse (not strobing). The three states should be unmistakably distinct — not variants of orange.

---

### Task 4: Snap flash + first-break marker

**Files:**
- Modify: `src/scenes/LevelScene.js` — `init()` (add `_firstBreakPos`), `setOnSnap` callback in `create()` (lines 115–123), `update()` (call `redrawSnapMarkers`), `hardReset()`, `toggleTest()` RESET branch, `clearBridgeData()`, new `redrawSnapMarkers()` method

On every snap: a bright white expanding circle fades at the midpoint (150ms). On the *first* snap only: a persistent red X marks the location through the rest of the test run. The Arc is a dedicated Phaser game object — NOT drawn on `snapGraphics` which is cleared every mouse move.

- [ ] **Step 1: Add `_firstBreakPos` to `init()`**

In `init()` where other state is initialised, add:
```js
this._firstBreakPos = null;
```

- [ ] **Step 2: Expand the `setOnSnap` callback in `create()` to spawn flash + record first break**

The existing callback at lines 115–123 receives `c` (the snapped constraint). The midpoint `mx, my` is already computed there. Expand it:

```js
    physics.setOnSnap((c) => {
      juice.onSnap(this.time.now);
      const mx = (c.bodyA.position.x + c.bodyB.position.x) / 2;
      const my = (c.bodyA.position.y + c.bodyB.position.y) / 2;
      cam.punchIn(mx, my, this.time.now);
      audio.stopCreak(c);

      // First-break marker — set only once per test run.
      if (!this._firstBreakPos) this._firstBreakPos = { x: mx, y: my };

      // Snap flash: dedicated Arc so it survives handleHover clearing snapGraphics.
      const flash = this.add.arc(mx, my, 1, 0, 360, false, 0xffffff, 1);
      flash.setDepth(20);
      this.tweens.add({
        targets: flash,
        scaleX: 30,
        scaleY: 30,
        alpha: 0,
        duration: 150,
        ease: 'Linear',
        onComplete: () => flash.destroy(),
      });

      this.onBeamSnapped();
    });
```

(The arc starts at radius 1 and scales to ×30, reaching ~30px radius. Alpha fades from 1 to 0.)

- [ ] **Step 3: Add `redrawSnapMarkers()` method**

Add this method after `redrawJoints()`:

```js
  // Draws a persistent red X at the first snap location for the current test run.
  // Called every frame from update() after redrawJoints().
  redrawSnapMarkers() {
    this.snapGraphics.clear();
    if (!this._firstBreakPos) return;
    const { x, y } = this._firstBreakPos;
    const half = 10; // X arm half-length → 20px total
    this.snapGraphics.lineStyle(3, 0xff2222, 1);
    this.snapGraphics.beginPath();
    this.snapGraphics.moveTo(x - half, y - half);
    this.snapGraphics.lineTo(x + half, y + half);
    this.snapGraphics.strokePath();
    this.snapGraphics.beginPath();
    this.snapGraphics.moveTo(x + half, y - half);
    this.snapGraphics.lineTo(x - half, y + half);
    this.snapGraphics.strokePath();
  }
```

Note: `snapGraphics` is cleared at the top of `redrawSnapMarkers()` each frame, which is fine — `handleHover()` also clears it, but that only runs on pointer move, and the X is redrawn every tick anyway.

- [ ] **Step 4: Call `redrawSnapMarkers()` from `update()`**

In `update()`, the test-mode draw sequence is:
```js
      this.redrawBeamBases();
      this._jointStrain = this.redrawStressOverlay();
      this.redrawJoints(this._jointStrain);
      this.redrawVehicle();
```

Add `redrawSnapMarkers()` after `redrawJoints()`:
```js
      this.redrawBeamBases();
      this._jointStrain = this.redrawStressOverlay();
      this.redrawJoints(this._jointStrain);
      this.redrawSnapMarkers();
      this.redrawVehicle();
```

- [ ] **Step 5: Clear `_firstBreakPos` in all three reset paths**

**hardReset()** — after `this._jointStrain = null;` (line ~451):
```js
    this._firstBreakPos = null;
```

**toggleTest()** RESET branch — after `this._jointStrain = null;` (line ~716):
```js
      this._firstBreakPos = null;
```

**clearBridgeData()** — add at the end of the method body (line ~751):
```js
    this._firstBreakPos = null;
```

This third clear is critical: the auto-return path calls `clearBridgeData()` before `toggleTest()`, so without it a stale X would persist into the next round.

- [ ] **Step 6: Commit**

```bash
git add src/scenes/LevelScene.js
git commit -m "feat(viz): snap flash Arc + first-break X marker — persists until reset"
```

- [ ] **Step 7: Smoke test**

Run TEST on a flat road. On snap: a white circle should briefly expand and fade at the break point. The first break location should show a red X for the rest of that test run. Press RESET — X disappears. Run TEST again, build to failure — new X appears at the new break point. Win a run — X disappears on auto-return.

---

### Task 5: Acceptance test checklist

Manual verification in the browser. No automated test framework in this project.

- [ ] **Physics feel**
  - [ ] Flat road in DEV_STRESS droops visibly under the heavy car (not instant snap)
  - [ ] Droop takes 3–5 seconds to progress from loaded to snap
  - [ ] Road does not bounce — drops steadily (damping working)
  - [ ] Wood/support segments behave the same as before (stiffness/threshold unchanged)

- [ ] **Bezier sag curve**
  - [ ] Road segments curve downward during test (not straight lines)
  - [ ] Build-mode road segments are straight lines
  - [ ] Wood/support segments are straight lines in both modes
  - [ ] Curve is barely visible at low strain, dramatic near snap

- [ ] **Stress colours**
  - [ ] At low load: beam shows **green** overlay (not yellow/orange)
  - [ ] At medium load: beam shifts to **yellow** overlay
  - [ ] Near snap: beam shows **red** overlay with slow pulse (not strobing)
  - [ ] Green/yellow/red are unmistakably distinct (not variants of orange)
  - [ ] Joint glow matches beam colour stage (green/yellow/red)
  - [ ] CRIT pulse feels slow and ominous, not epilepsy-triggering

- [ ] **Snap flash**
  - [ ] White circle appears at snap location and fades in ~150ms
  - [ ] Flash is visible even while mouse is moving over the canvas
  - [ ] Flash does not flicker or get cut short

- [ ] **First-break marker**
  - [ ] Red X appears at first snap point after collapse
  - [ ] X does NOT appear at subsequent snap points (only first)
  - [ ] X is drawn on top of beams and joints
  - [ ] X disappears when pressing RESET (manual)
  - [ ] X disappears after auto-return from win
  - [ ] X disappears after auto-return from fail
  - [ ] Hard Reset (trash button) also clears X

- [ ] **Budget / cheat panel**
  - [ ] L1 budget starts at 16
  - [ ] DEV_STRESS budget starts at 40
  - [ ] Road snap threshold slider in cheat panel still works (cap is 0.50 — proposed value is at the ceiling; confirm no over-range issue)
