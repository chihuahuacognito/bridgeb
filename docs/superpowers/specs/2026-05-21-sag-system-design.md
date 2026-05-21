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

| Parameter | Current | Proposed | Why |
|---|---|---|---|
| Road stiffness | 0.15 | 0.08 | Softer springs — joints move further under vehicle load |
| Road snapThreshold | 0.30 | 0.50 | More stretch allowed before snap — gives time to see droop |
| Joint density | 0.05 | 0.10 | Heavier joints sag further under their own weight |
| Constraint damping | 0.05 | 0.08 | More damped — droops steadily, does not bounce |

Wood/support values are unchanged. Values apply to both L1 and DEV_STRESS via the material definition in each level object.

The cheat panel already exposes stiffness and snapThreshold sliders so in-browser fine-tuning requires no code changes.

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

### Colour table

| Stage | Threshold | Current colour | New colour | Stroke bonus |
|---|---|---|---|---|
| MED | strain ≥ 0.05 | `0xffd24a` dull yellow | `0x00e5ff` bright cyan | +3px |
| HIGH | strain ≥ 0.20 | `0xff8a1f` orange | `0xffee00` bright yellow | +8px |
| CRIT | strain ≥ 0.50 | `0xff2e2e` red | `0xff1111` red + white pulse | +14px |

At CRIT, the overlay alternates between `0xff1111` and `0xffffff` at 8Hz — an urgent rapid flash the player cannot miss.

### Joint glow

Joint glow colours update to match the new progression:
- MED glow: `0x00e5ff` (cyan)
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
- Drawn on the existing `snapGraphics` layer

The snap midpoint is already available in the `onSnapCallback` — `(bodyA.position + bodyB.position) / 2`. No changes to `physics.js` required.

### First-break marker

A persistent red X drawn at the midpoint of the *first* beam that broke in the current test run:
- Shape: two diagonal lines forming an ×, 20px across, 3px thick
- Colour: `0xff2222`
- Stored as `this._firstBreakPos` in `LevelScene` — set only on the first snap, ignored on subsequent snaps
- Drawn every frame via `redrawSnapMarkers()` called from `update()` during test mode
- Cleared in `hardReset()` and the `toggleTest()` RESET branch

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
| `src/data/leveldata.js` | road stiffness, snapThreshold, joint density, damping values |
| `src/scenes/LevelScene.js` | VIZ colour constants, bezier curve rendering in redrawBeamBases + redrawBeams, redrawSnapMarkers(), firstBreakPos tracking, SAG_DEPTH_FACTOR constant |
| `src/systems/physics.js` | No changes required |

## Architecture Invariants

1. **Physics seam** — no changes to `physics.js`. All visual changes live in `LevelScene`.
2. **Build mode unchanged** — sag curve only activates when strain > 0, which only happens in test mode.
3. **Cheat panel** — stiffness and snapThreshold remain live-tunable via the existing GUI sliders.
