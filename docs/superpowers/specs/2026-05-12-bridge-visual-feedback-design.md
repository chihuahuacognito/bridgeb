---
Date: 2026-05-12
Content Type: Design Spec
---

# Bridge Visual Feedback — Design Spec

## Problem

The current bridge visualization conflates two unrelated signals on a single stroke:

1. **Material identity** (this is a wood beam).
2. **Stress** (this beam is carrying load, may snap soon).

Both ride on `beamsGraphics`. In test mode, the stroke takes a green→yellow→red gradient driven by `physics.readStressSmoothed()`, replacing the brown plank look entirely. Players read this as "what kind of beam is that?" rather than "how much stress is on the wood beam I built." Material reads as variable; stress reads as not present.

The problem is compounded by tuning. `readStressSmoothed` returns `raw / material.snapThreshold`, so the visual signal is hostage to whatever snap-tuning value is current. When `snapThreshold` was raised from 0.7 → 2.0 to stop benign bridges from disintegrating, the same physical load now reads as half the stress fraction, so beams look perpetually unloaded.

## Goals

1. Beam material identity is unmistakable and stable. A wood plank looks like a wood plank, every frame, in both modes.
2. Stress is visible at the load levels players actually produce, not just at imminent-snap.
3. Joints communicate their structural role (immovable anchor vs. dynamic mid-joint) and the load passing through them.
4. The visual stress signal is decoupled from the snap-tuning knob so future snap-threshold changes don't break the visualization.
5. No new external assets. All draws are programmatic via `Phaser.GameObjects.Graphics`.

## Non-goals

- A second material (cable/suspension) — deferred. Only wood exists in Phase 1.
- Build-mode static-load preview (would require a structural solver). Stress feedback is test-mode only.
- Snap-moment particle splinters. `juice.js` already covers the snap moment with slow-mo, freeze-frame, and camera shake.
- Shader-based effects (Phaser pipelines). Plain `Graphics` calls are sufficient.

## Visual contract

The mapping from game state to pixels — fixed for Phase 1 so players learn the language and it never lies to them.

| Element | Meaning | When it appears |
|---|---|---|
| Brown plank (6px stroke, `0x9b6b3a`) | Wood beam, the only material | Always (build + test) |
| Faint yellow pulse overlay | Beam at moderate load (strain ≥ `STRAIN_MED`) | Test mode |
| Bright orange pulse overlay | Beam at heavy load (strain ≥ `STRAIN_HIGH`) | Test mode |
| Red flash + crack hatching + wobble | Beam imminent — visually maxed out (strain ≥ `STRAIN_CRIT`) | Test mode |
| Red bolted-plate icon | Anchor — never moves | Both modes |
| Brown pin with thin ring | Mid-joint — load passes through, can sag | Both modes |
| Pin glowing orange → red | Mid-joint carrying load (strain ≥ `STRAIN_HIGH` on at least one incident beam); color lerps from orange to red as strain climbs from `STRAIN_HIGH` to `STRAIN_CRIT` | Test mode |
| Yellow snap ring (existing) | Snap-target on hover | Build mode |

"Strain" here is a **visual quantity only**, distinct from the engine's snap stress. Definition in the Load Model section.

## Load model

Add a function to `src/systems/physics.js`:

```js
const VISUAL_FULL_STRAIN = 0.4;

function readStrainVisual(constraint) {
  const cur = Math.hypot(
    constraint.bodyA.position.x - constraint.bodyB.position.x,
    constraint.bodyA.position.y - constraint.bodyB.position.y
  );
  const rest = Math.max(constraint.length, MIN_REST_LEN);
  const ratio = Math.abs(cur - rest) / rest;
  return Math.min(1, ratio / VISUAL_FULL_STRAIN);
}
```

`VISUAL_FULL_STRAIN` is the strain ratio at which the visual signal saturates (returns 1.0). At 0.4, a beam stretched 40% of its rest length is at full visual stress regardless of whether it's about to snap.

The existing `readStressSmoothed` is **unchanged** and continues to drive the snap mechanic. The two signals are independent. This is the architectural decoupling that fixes goal 4.

Visual breakpoints (constants in `LevelScene`):

| Constant | Value | Meaning |
|---|---|---|
| `STRAIN_MED` | 0.20 | Yellow overlay begins |
| `STRAIN_HIGH` | 0.50 | Orange overlay, joint glow lights up |
| `STRAIN_CRIT` | 0.85 | Red flash + crack hatching + wobble (existing) |

Reading: a beam at 8% physical stretch → 0.20 strain visual → starts yellow. At 20% stretch → 0.50 → orange. At 34% stretch → 0.85 → red.

## Rendering architecture

### Graphics objects

Three `Phaser.GameObjects.Graphics` objects in `LevelScene.create()`, drawn in z-order:

| Object | Z-order | Draws | When |
|---|---|---|---|
| `beamsGraphics` | back | Brown plank line | Every frame, both modes |
| `stressGraphics` | mid | Overlay pulse, crack hatching, wobble offset | Test mode only |
| `jointsGraphics` | front | Anchor/joint icons + joint glow | Every frame, both modes |

The existing `beamsGraphics` is repurposed (color shift removed). `stressGraphics` and `jointsGraphics` are new.

### Per-frame draw passes (test mode)

1. **`redrawBeamBases()`** — clear `beamsGraphics`, draw each beam as a 6px brown line from `bodyA.position` to `bodyB.position`. No color shift, ever. In build mode, draw from the design-time `this.beams` array instead — same look.

2. **`redrawStressOverlay()`** — clear `stressGraphics`, and for each beam constraint:
   - Read `s = physics.readStrainVisual(c)`.
   - If `s < STRAIN_MED`, skip.
   - Pick `OVERLAY_COLOR_MED | HIGH | CRIT` based on which breakpoint `s` has crossed.
   - Compute pulse alpha: `OVERLAY_ALPHA_BASE + OVERLAY_ALPHA_PULSE * 0.5 * (1 + sin(2π × hz × t))` where `hz` ramps `MED → HIGH → CRIT` (2.0 → 4.5 → 8.0).
   - Thickness: `BEAM_BASE_THICKNESS + OVERLAY_THICKNESS_BONUS × s`.
   - Draw an overlay line on top of the base with the chosen color, alpha, thickness.
   - If `s ≥ STRAIN_CRIT`, additionally draw the existing wobble offset (already implemented in `redrawBeamsFromBodies`) and `CRACK_COUNT` short hatch strokes perpendicular to the beam at random offsets along its length.
   - As the overlay pass walks beams, build `jointStrain = Map<jointBody, maxStrainSoFar>`. For each beam endpoint `bodyA`/`bodyB`, update `jointStrain.get(b) = max(prev, s)`.

3. **`redrawJoints(jointStrain)`** — clear `jointsGraphics`. For each joint in `physics._nodes`:
   - If `isAnchor` (label `'anchor'`): draw a 14×14 red bolted-plate icon — filled square with four small dark rivets at the corners. Static, no animation.
   - Else (mid-joint, label `'joint'`): draw a filled circle radius `JOINT_RADIUS` in `JOINT_COLOR`, with a 1px ring outline in `JOINT_RING_COLOR` at `JOINT_RADIUS + 1`. Read `s = jointStrain.get(body) ?? 0`. If `s ≥ STRAIN_HIGH`, draw a glow underneath the pin: filled circle, color = `lerp(JOINT_GLOW_COLOR_HIGH, JOINT_GLOW_COLOR_CRIT, t)` where `t = clamp((s − STRAIN_HIGH) / (STRAIN_CRIT − STRAIN_HIGH), 0, 1)`, radius = `JOINT_GLOW_RADIUS_MAX × s`, alpha = `JOINT_GLOW_ALPHA_MAX × s`. Glow draws first so the pin sits on top.

### Build mode

- `beamsGraphics` and `jointsGraphics` draw every frame.
- `stressGraphics` is cleared and not redrawn — no stress in build mode.
- `redrawJoints` is called with an empty `Map` so the `s ≥ STRAIN_HIGH` branch short-circuits and joints render plain.

### Build-mode handlers

The existing build-mode beam draw lives in `redrawBeams()` (line 174–183 of `LevelScene.js`). It draws from `this.beams` (design-time data). It's preserved verbatim — same look in build mode and test mode for the base layer.

The existing anchor draw in `drawAnchors()` is removed; the joints pass owns all joint rendering now.

### Files touched

- `src/systems/physics.js` — add `readStrainVisual(constraint)` and the `VISUAL_FULL_STRAIN` constant. Existing snap path untouched.
- `src/scenes/LevelScene.js` — split `redrawBeamsFromBodies` into the three passes above. Add `stressGraphics` and `jointsGraphics` to `create()`. Replace `drawAnchors()` with the joints pass. Add `VIZ` constants block.

### Code removed

- The `stressColor(s)` lerp function on the base beam — color is constant brown.
- `drawStressGlow()` — beam-midpoint glow blob, replaced by joint glow which is structurally more meaningful (it's the load-bearing node that's glowing, not a halfway point of empty space).

## Tuning numbers

One constants block at the top of `LevelScene` so tuning is one-stop:

```js
const VIZ = {
  // Stress thresholds (visual only; independent of snap)
  STRAIN_MED:  0.20,
  STRAIN_HIGH: 0.50,
  STRAIN_CRIT: 0.85,

  // Beam base
  BEAM_BASE_COLOR: 0x9b6b3a,
  BEAM_BASE_THICKNESS: 6,

  // Stress overlay
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

The pulse-Hz ramp (2 → 8 Hz) is the BCP-style "creaking faster as it nears failure" cue. Pulse Hz at `STRAIN_CRIT` is bounded by 8 Hz to stay well below the photosensitivity threshold (~3 flashes/second on full-screen content; an overlay segment is small enough that 8 Hz is safe).

## Architecture invariants honored

From the Phase 1 plan, three invariants must hold across every session boundary:

1. **Physics seam** — only `physics.js` calls `scene.matter.*`. New code: `readStrainVisual` lives in `physics.js`; it reads `constraint` properties only (no matter calls). ✓
2. **System lifecycle** — every system module exports `attach` / `detach` / `reset`. No new system module is added by this change. ✓
3. **`level.vehicles` always an array** — unchanged. ✓

## Testing

Manual verification only — visual output isn't unit-testable in the headless harness. Acceptance criteria:

1. Build a single anchor-to-anchor beam. In build mode it's brown plank. Hit TEST. Beam stays brown plank for the entire run — no green/yellow/red on the base.
2. Build a downward-V bridge with one mid-joint. Hit TEST. As the car traverses the bridge:
   - The loaded beams pulse yellow → orange → red depending on strain.
   - The mid-joint glows yellow → orange → red with the highest-stress incident beam.
   - The anchors stay red plates, no animation.
3. Reset. Both modes return to the plain brown look with no overlay residue.
4. Vitest suite (`npm test`) still passes — physics math is unchanged from the snap path.

## Out of scope

- Multiple materials.
- Build-mode static load preview.
- Snap-moment particle splinters.
- Shader-based pulse/glow.
- Audio cues for the new visual breakpoints. (Existing `audio.startCreak` already fires at `stress > 0.85`; that hooks the snap path, not the new visual path.)
