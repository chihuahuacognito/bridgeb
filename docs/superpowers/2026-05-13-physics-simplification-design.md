---
Date: 2026-05-13
Content Type: Design Spec — Revised Physics Architecture
Status: Approved for implementation
Supersedes: Relevant vehicle/beam sections of 2026-05-11-bridge-builder-phase-1.md
---

# Bridge Builder — Physics Simplification Design

## Why this document exists

The Phase 1 implementation produced a vehicle system with five interacting physics
objects per vehicle (chassis + 2 wheel bodies + 2 wheel constraints), friction-based
drive, a broken density formula that made the car 10× too light, and wheel collision
filters so permissive that wheels migrated above or below the chassis during
simulation. The stress indicators were invisible as a direct consequence — the car
was lighter than a single joint node and could not meaningfully load the bridge.

The deeper issue is that the interactions between systems were not explicitly defined
before coding. This document does that. Every physics object, every collision rule,
and every per-frame behaviour is stated here as a contract. Implementations must
match this contract. If the contract needs to change, change it here first.

---

## Core principle

**All drama is in the bridge. The vehicle is a load-delivery mechanism.**

The vehicle's only jobs are:
1. Apply weight to the bridge surface.
2. Move from one side to the other at a predictable rate.
3. Fall if the bridge breaks.

Everything else — visible wheel spin, suspension compression, speed variation on
slopes — is cosmetic complexity that adds no educational signal and makes the system
harder to test. BCP itself follows this principle: its vehicles move at constant speed
and have no suspension simulation. The feel comes from the bridge, not the car.

---

## System contracts

### 1. Vehicle

**Physics objects:** ONE rectangle body (the chassis). Nothing else.

**Size:** 80 × 24 px (unchanged).

**Mass:** `density = 0.008` → mass ≈ 15.4 Matter units.
This is approximately 6× a mid-joint node (mass ≈ 2.5), which is enough to visibly
load and deform the bridge without causing catastrophic immediate failure.
The previous formula (`weight / (80 × 24 × 1000)`) gave mass ≈ 0.2 — lighter than
a single joint. That was the root cause of invisible stress indicators.

**Drive:** Each frame during test mode, horizontal velocity is set directly:
```
chassis.velocity.x = DRIVE_SPEED  (+3 px/frame leftward spawn, −3 rightward)
chassis.velocity.y = unchanged     (physics governs vertical — gravity, surface)
```
Do NOT touch angular velocity. The chassis will tilt naturally on sloped beam
surfaces, which is the correct BCP-style behaviour.

**No wheel bodies.** No wheel constraints. No group collision filter.

**Wheels (visual only):** Drawn each frame as two filled circles at fixed offsets
from the chassis centre, rotated by `chassis.angle`. These are pure `Graphics`
calls — no Matter bodies, no position lookup.

| Wheel | Body-local offset |
|---|---|
| Front | dx: +28, dy: +12 |
| Rear  | dx: −28, dy: +12 |

**Collision filter:**
```
category: 0x0001  (VEHICLE)
mask:      0xFFFF & ~0x0002   (everything except JOINT nodes)
group:     none
```

**Trade-off vs GDD §1.1:**
GDD §1.1 requires "suspension visibly compresses on heavy loads." This is traded
away in favour of a stable, testable vehicle. The chassis tilts on angled bridge
surfaces (rigid-body behaviour), which reads visually as rocking. True spring
compression is not present. This decision is final for Phase 1 and the stakeholder
demo. Re-evaluate only if a stakeholder specifically flags it.

---

### 2. Beam bodies (collision surface)

**Physics objects per beam:** one stress constraint + one rectangle body +
(if dynamic) two attach constraints.

**Stress constraint** (joint A → joint B):
- Length = distance between joints at build time.
- Stiffness = `material.stiffness` (see §4).
- Damping = `0.05`.
- Purpose: measures separation to drive stress reading and snap logic.
  Never used for collision.

**Rectangle body** (the surface the vehicle rolls on):
- Width = beam length. Height = **30 px** (dynamic beams), 10 px (static anchor-to-anchor).
- Centre shifted perp-down by `height/2` from the joint-to-joint midpoint so the
  top edge of the rectangle aligns with the joint line.
- `restitution: 0` — no bounce. Bounce allows the vehicle to separate from the
  surface mid-frame and tunnel through on the return.
- `friction: 0.6`.
- `density: 0.001` (dynamic beams only). This gives beam bodies enough mass to
  resist being flung by vehicle impulse without dominating the load path.

**Static beams** (both endpoints are anchors):
- Beam body is `isStatic: true`. No attach constraints needed.
- Collision surface is perfectly rigid — correct for anchor-to-anchor planks.

**Dynamic beams** (at least one endpoint is a mid-joint):
- Beam body is dynamic.
- Two stiff attach constraints (stiffness 1.0, length 0) pin the top corners of the
  rectangle to the joint bodies. This makes the rectangle track joint movement.
- `collisionFilter: { category: 0x0004, mask: 0x0001, group: -1 }`.
  Category BEAM, collides with VEHICLE only, group −1 prevents beam-on-beam collision.

**Why not manually sync beam positions each frame:**
Manually setting `Body.setPosition` each frame would require making beam bodies
kinematic, which breaks force transfer — the vehicle's weight would not reach the
joints and the bridge would not deform under load. The attach-constraint approach
keeps beam bodies dynamic so vehicle weight propagates through them to the joints,
causing visible sag and stress. The price is constraint-lag under extreme flex; the
30 px thickness absorbs this.

---

### 3. Joint nodes

**Physics objects:** small circle body, radius 4 px.

**Anchors:** `isStatic: true`. Never move. Serve as fixed endpoints for constraints.

**Mid-joints:** dynamic, `density: 0.05` → mass ≈ 2.5 units. High enough to resist
being yanked by vehicle impulse; low enough to sag visibly under load.

**Collision filter:** `{ category: 0x0002, mask: 0x0000 }` — collide with nothing.
Joints are invisible to collision. They exist only as constraint endpoints.

---

### 4. Collision filter matrix

The full interaction table. A tick means collision occurs; a dash means it does not.

| | Vehicle chassis | Beam body | Joint node | Canyon wall |
|---|---|---|---|---|
| **Vehicle chassis** | — | ✅ vehicle rolls on bridge | — | ✅ vehicle spawns on wall |
| **Beam body** | ✅ | — (group −1) | — | — |
| **Joint node** | — | — | — | — |
| **Canyon wall** | ✅ | — | — | — |

Every cell is explicit. There are no accidental collisions.

---

### 5. Materials

| Material | Stiffness | snapThreshold | Notes |
|---|---|---|---|
| Wood (L1) | 0.9 | 0.5 | Stiff enough to hold under moderate load; snaps at ~55% actual stretch — reachable with the correct car mass, giving full visual stress range before snap |
| Wood (L2 — wider span) | TBD | TBD | Tune at L2 implementation time |
| Steel cable | TBD | TBD | Phase 2 |

**snapThreshold rule:** must satisfy `snapThreshold / stiffness > VISUAL_FULL_STRAIN`
so the full yellow→orange→red visual progression is always visible before a beam
snaps. With stiffness 0.9 and `VISUAL_FULL_STRAIN = 0.08`, any `snapThreshold > 0.072`
satisfies this. 0.5 is the recommended starting value.

---

### 6. Stress visualisation

The two-channel system (stable brown base + overlay pulse) is already implemented
correctly via the Visual Feedback plan (2026-05-12). The constants below are the
working values calibrated for the corrected vehicle mass. They differ from the
original spec (which was calibrated for the wrong mass) and should not be reverted
without a feel-check.

```js
VISUAL_FULL_STRAIN:   0.08   // 8% actual stretch = full visual signal
STRAIN_MED:           0.05   // yellow overlay begins
STRAIN_HIGH:          0.20   // orange overlay, joint glow
STRAIN_CRIT:          0.50   // red flash, crack hatching, wobble
```

If after the vehicle mass fix the stress indicators fire too aggressively (yellow on
every beam immediately), raise `STRAIN_MED` toward `0.10`. If indicators are still
invisible after the fix, lower `VISUAL_FULL_STRAIN` toward `0.05`.
Adjust by feel-check, not by calculation.

---

### 7. Per-frame behaviour (test mode)

The order matters. Each step depends on positions settled by the previous step.

1. `physics.tickWatchdog()` — NaN guard, soft-restart if bodies explode.
2. `physics.driveVehicle()` — set chassis X velocity. Y left to physics.
3. `physics.evaluateStress(now, timeScale)` — read stress, queue snaps, process one
   snap per stagger tick.
4. `juice.tick(now, cascadeActive)` — slow-mo lerp, freeze-frame management.
5. `cam.tick(now)` — camera follow and punch-in release.
6. `this.updateCreakAudio()` — start/stop creak loops per constraint stress.
7. `this.redrawBeamBases()` — clear and redraw brown plank layer.
8. `this._jointStrain = this.redrawStressOverlay()` — clear and redraw stress layer,
   build joint strain map.
9. `this.redrawJoints(this._jointStrain)` — clear and redraw joints layer with glow.
10. `this.redrawVehicle()` — draw chassis rectangle + visual wheel circles.
11. `this.checkWin()` — chassis X ≥ right anchor X → win.
12. `this.checkFall()` — chassis Y > worldHeight + 40 → fail.

Nothing in this list requires wheel body positions. Removing wheels does not touch
any step here.

---

### 8. Educational module compatibility

Every module's learning signal depends on BRIDGE behaviour, not vehicle mechanics.
The simplified vehicle is compatible with all five.

| Level | Concept | What vehicle must do | Compatible? |
|---|---|---|---|
| L1 — Forces & Gravity | Weight pulls down, bridges resist | Apply ~15 mass-units of downward force while crossing | ✅ |
| L2 — Geometry & Triangles | Triangles don't deform, rectangles do | Same load, different bridge geometry | ✅ |
| L3 — Tension & Compression | Cables pull, beams push | Same load; material choice determines which stress type fires | ✅ |
| L4 — Balance & Centre of Mass | Position of load on bridge matters | Vehicle can be paused at midpoint via `timeScale = 0` during test | ✅ |
| L5 — Budget Optimisation | Cost vs strength trade-off | Consistent load across all bridge attempts | ✅ |

None of the modules require wheel friction, suspension, or multi-body vehicle
dynamics. The educational signal in every case is: does the bridge hold this weight
crossing this span?

---

### 9. What is NOT in scope for Phase 1

These items are deferred. Do not implement them ahead of their phase.

| Item | Why deferred |
|---|---|
| Audio assets (creak/snap/thud/ambient) | `audio.js` is stubbed correctly; assets are a Phase 2 task. BootScene must call `load.audio()` once assets exist. |
| Vehicle speed variation on slopes | Constant X velocity override is the spec. Slope-based speed is cosmetic. |
| Visible wheel rotation | Wheels are circles. Rotation is not drawn. |
| Suspension spring | Traded away (see §1 trade-off). |
| Cable material (one-way tension) | Phase 2. |
| Multi-vehicle (L5 convoy) | Phase 2. |
| Sandbox editor | Phase 4. |

---

### 10. BootScene / level access

**Production:** BootScene boots directly into L1. No level picker.

**Development:** The level picker currently in BootScene is a dev tool. It should
be gated behind a dev flag or a query parameter (`?dev=1` → show picker), not
present in the default build.

**L2 (stress test):** The L2 entry in `leveldata.js` (heavy car, soft beams) is a
physics diagnostic tool, not a content level. It does not correspond to the GDD's
L2 (Geometry & Triangles), which is a Phase 2 deliverable. Rename it to `DEV_STRESS`
or similar to avoid confusion when the real L2 is implemented.

---

### 11. Files changed by this simplification

| File | Change |
|---|---|
| `src/systems/physics.js` | `spawnVehicle`: remove wheel body/constraint creation. `driveVehicle`: replace angular velocity with `setVelocity`. `removeVehicle`/`freezeVehicle`: chassis only (already correct once wheels gone). Fix density. |
| `src/scenes/LevelScene.js` | `redrawVehicle`: remove `v.wheels` loop; draw two fixed-offset circles. `create()`: move `vehicleGraphics` init here (currently leaks a new Graphics object per test run). |
| `src/data/leveldata.js` | L1: `snapThreshold` 2.0 → 0.5. Rename `L2` key to `DEV_STRESS`. |
| `src/scenes/BootScene.js` | Gate level picker behind dev flag or revert to direct L1 boot. |

No changes to `juice.js`, `camera.js`, `audio.js`, `physics.js` stress/cascade logic,
or the visual feedback system.

---

### 12. Contradictions resolved by this document

The following contradictions identified across the existing docs are resolved here:

| Contradiction | Resolution |
|---|---|
| GDD §1.1 "suspension visibly compresses" vs rigid wheel pins | Suspension removed. Chassis tilts naturally on slopes. Decision is final for Phase 1. |
| Phase 1 plan density `/100` vs implemented `/1000` | Density is now specified directly: `0.008`. The weight-based formula is retired. |
| Phase 1 plan wheel stiffness `0.5` vs implemented `1.0` | Wheel bodies removed entirely. No stiffness to specify. |
| GDD wood stiffness `~0.7` vs implemented `0.9` | `0.9` is retained. The GDD value was a suggestion; `0.9` passes feel-check. |
| Phase 1 plan `snapThreshold: 0.7` vs implemented `2.0` | `0.5` adopted. Satisfies the visual-before-snap rule (§5). |
| Visual Feedback spec `STRAIN_MED: 0.20` vs current `0.05` | Current values (`0.05/0.20/0.50`) are retained. They are calibrated for the corrected vehicle mass. The spec values were calibrated for the wrong mass. |
