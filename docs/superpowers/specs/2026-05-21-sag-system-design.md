---
Date: 2026-05-21
Content Type: Design Spec
---

# Sag System — Design Spec

## Problem

Unsupported road segments snap too quickly and without visible warning. Kids have no time to understand *why* the bridge failed. The stress overlay colours (yellow → orange → red) are all warm tones that blur together and are hard to distinguish. There is no indication of where the bridge first started failing.

## Goal

Make unsupported road visibly droop and sag over 3–5 seconds before snapping, using a combination of real physics sag and a visual curve exaggeration. Make each stress stage unmistakably distinct with hue-shifted colours. Mark the first break point so kids always know what to fix.

## Scope

Phase 1 only. Applies to road segments. Wood/support segments are structural-only and do not sag visually.

---

## Section 1 — Physics Tuning

Tune road spring and joint values in `leveldata.js` so joints droop further and more slowly before the constraint snaps.

| Parameter | Current | Proposed | Location | Why |
|---|---|---|---|---|
| Road stiffness | 0.15 | 0.08 | `leveldata.js` materials.road.stiffness | Softer springs — joints move further under vehicle load |
| Road snapThreshold | 0.30 | 0.50 | `leveldata.js` materials.road.snapThreshold | More stretch allowed before snap — gives time to see droop |
| Joint density | 0.05 | 0.10 | `physics.js` `ensureJointNode()` — hard-coded, **not in leveldata** | Heavier joints sag further under their own weight |
| Constraint damping | 0.05 | 0.08 | `physics.js` `buildBeam()` — hard-coded, **not in leveldata** | More damped — droops steadily, does not bounce |

Wood/support stiffness and snapThreshold are unchanged. Stiffness and snapThreshold for road apply to both L1 and DEV_STRESS via their material definitions. Joint density and constraint damping are global (physics.js), affecting all levels equally.

The cheat panel already exposes stiffness and snapThreshold sliders. The `roadSnapThreshold` slider is currently capped at 0.50 — the proposed value hits the ceiling exactly. If further tuning above 0.50 is needed, widen the slider range in `_buildCheatGui()`.

---

## Section 2 — Visual Sag Curve

Road segments are drawn as a **quadratic bezier curve** instead of straight lines. The curve droops downward at the midpoint in proportion to the segment's visual strain.

### Formula

```
sagDepth    = readStrainVisual(constraint) × segmentLength × SAG_DEPTH_FACTOR
controlPtX  = midX
controlPtY  = midY + (2 × sagDepth)   // ×2 so the curve passes through midY + sagDepth
```

`SAG_DEPTH_FACTOR = 0.10` — a single constant at the top of `LevelScene.js`.

### Behaviour at a typical 300px segment

| Strain | Visual sag |
|---|---|
| 0.1 | 3px — barely visible |
| 0.5 | 15px — clearly drooping |
| 0.9 | 27px — dramatically sagging, about to snap |

### Build mode vs test mode

- **Build mode:** strain = 0, sagDepth = 0. All segments draw as straight lines. No change to build experience.
- **Test mode:** bezier curve activates as load builds. Physics joint displacement is the bezier endpoints — real sag is already included. The curve adds visual exaggeration on top.

### Implementation

Replace `graphics.lineTo` calls in `redrawBeamBases()` with `graphics.moveTo` + `graphics.quadraticCurveTo` using the control point above. Road segments only — wood/support segments continue as straight lines.

`redrawBeams()` (build mode) is unchanged — it has no strain data and always draws straight lines.

---

## Section 3 — Stress Colours

Replace the current warm-only colour progression (yellow → orange → red) with a hue-shifted progression that reads as three unmistakably different states.

Kids map colours to traffic lights they already know. The progression must follow that mental model exactly: green = fine, yellow = warning, red = danger.

### Colour table

| Stage | Threshold | Current colour | New colour | Stroke bonus |
|---|---|---|---|---|
| SAFE | strain < 0.05 | base colour | base colour (no overlay) | none |
| MED | strain ≥ 0.05 | `0xffd24a` dull yellow | `0x44ff44` bright green | +3px |
| HIGH | strain ≥ 0.20 | `0xff8a1f` orange | `0xffee00` bright yellow | +8px |
| CRIT | strain ≥ 0.50 | `0xff2e2e` red | `0xff1111` red, slow glow | +14px |

At CRIT, the overlay uses a slow sine-wave pulse at **2Hz** (not 8Hz — faster rates are a photosensitivity risk for kids). The existing sine-wave alpha pulse in `redrawStressOverlay` already does this — no new mechanism needed, just keep the existing `PULSE_HZ_CRIT` value at 2.0.

### Joint glow

Joint glow colours update to match:
- MED glow: `0x44ff44` (green)
- HIGH glow: `0xffee00` (yellow)
- CRIT glow: `0xff1111` (red)

### Constants updated in `LevelScene.js` VIZ block

The current code uses a single `OVERLAY_THICKNESS_BONUS * strain` formula. Replace with three fixed per-stage values so thickness jumps are immediate and readable:

```js
OVERLAY_COLOR_MED:  0x00e5ff,
OVERLAY_COLOR_HIGH: 0xffee00,
OVERLAY_COLOR_CRIT: 0xff1111,
OVERLAY_THICKNESS_BONUS: 3,   // MED stage
OVERLAY_THICKNESS_HIGH:  8,   // HIGH stage
OVERLAY_THICKNESS_CRIT:  14,  // CRIT stage
```

In `redrawStressOverlay()`, replace `VIZ.BEAM_BASE_THICKNESS + VIZ.OVERLAY_THICKNESS_BONUS * s` with a step lookup: MED → +3, HIGH → +8, CRIT → +14.

---

## Section 4 — Snap Effect

### Flash

On snap, a bright white circle expands and fades at the midpoint of the snapping beam:
- Radius: 0 → 30px over 150ms
- Alpha: 1 → 0 over 150ms
- Colour: white `0xffffff`
- **Must use a dedicated Phaser circle game object with a tween** — NOT drawn on `snapGraphics`. The existing `snapGraphics` layer is cleared on every mouse move in `handleHover()`, which would kill the tween mid-animation. Create a `Phaser.GameObjects.Arc` at spawn time, tween its `alpha` and `scaleX/scaleY`, then destroy it on tween complete.

The snap midpoint is already available in the `onSnapCallback` — `(bodyA.position + bodyB.position) / 2`. No changes to `physics.js` required.

### First-break marker

A persistent red X drawn at the midpoint of the *first* beam that broke in the current test run:
- Shape: two diagonal lines forming an ×, 20px across, 3px thick
- Colour: `0xff2222`
- Stored as `this._firstBreakPos` in `LevelScene` — set only on the first snap, ignored on subsequent snaps
- Drawn every frame via `redrawSnapMarkers()` called from `update()` **after `redrawJoints()`** so it renders on top
- Cleared in three places: `hardReset()`, the `toggleTest()` RESET branch, and **`clearBridgeData()`** — the auto-return path (win/fail) calls `clearBridgeData()` before `toggleTest()`, so without this third clear a stale X marker would persist into the next round

---

## Section 5 — Material Costs & Budget

Already implemented in `leveldata.js`. Confirmed values:

| Level | Budget | Road cost | Support cost | Rationale |
|---|---|---|---|---|
| L1 | 16 | 2 | 1 | Solid bridge costs exactly 16 — budget is always in play |
| DEV_STRESS | 40 | 2 | 1 | Generous for complex test structures, not irrelevant |

The 50% rule: 4 road segments = cost 8 = 50% of L1 budget. The remaining 8 points are where structural decisions happen. No code changes needed.

---

## Files Touched

| File | Changes |
|---|---|
| `src/data/leveldata.js` | road stiffness 0.08, snapThreshold 0.50 |
| `src/scenes/LevelScene.js` | VIZ colour constants, step-based thickness lookup, bezier curve in `redrawBeamBases()`, `redrawSnapMarkers()`, `_firstBreakPos` tracking, SAG_DEPTH_FACTOR constant, flash circle game object, `PULSE_HZ_CRIT` reduced to 2.0 |
| `src/systems/physics.js` | `ensureJointNode()` density 0.10, `buildBeam()` damping 0.08 |

## Architecture Invariants

1. **Physics seam** — no changes to `physics.js`. All visual changes live in `LevelScene`.
2. **Build mode unchanged** — sag curve only activates when strain > 0, which only happens in test mode.
3. **Cheat panel** — stiffness and snapThreshold remain live-tunable via the existing GUI sliders.
