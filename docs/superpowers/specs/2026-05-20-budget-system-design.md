---
Date: 2026-05-20
Content Type: Design Spec
---

# Budget System — Design Spec

## Problem

Beams are structurally optional. A player can draw road directly between the two anchors in L1, place enough mid-joints at short intervals, and the bridge survives without any beam support — because the snap threshold is forgiving and nothing forces the player to use cheap structural members. Without a budget constraint, there is no reason to prefer beams over road.

## Goal

Introduce a per-segment budget that makes road (the expensive deck surface) a scarce resource and beams (the cheap structural fill) the natural choice for triangulation. The player must decide where to spend their road segments and use beams to support them.

## Scope

Phase 1 only. One level (L1). Target audience: kids.

## Design decisions

- **Cost unit**: per segment placed (not per pixel). Simple to reason about: "I have 8 left."
- **Cost split**: road = 2, beam = 1. Road is twice as expensive as a beam.
- **Budget for L1**: 30. Allows 15 road segments max, or 30 beams, or any mix. Leaves ~4-6 segments of slack above a minimal working bridge to avoid dead-ends from early mistakes.
- **DEV_STRESS budget**: 9999 (unchanged — sandbox level).
- **Over-budget behaviour**: block placement when `_budgetRemaining === 0`. Player can still press TEST with whatever they have built. No hard lock on testing. Blocked attempt triggers a counter flash so the player knows why the click did nothing.
- **Deletion**: there is no individual segment deletion in Phase 1 — only CLEAR (hard reset). Hard reset resets the budget to `level.budget` in full. Individual undo is the first Phase 2 addition if playtesting shows frequent CLEAR-rage.

## Data layer — `leveldata.js`

Add `cost` to each material definition. Cost travels with the material so levels can tune it independently.

```js
materials: {
  road: { type: 'road', cost: 2, stiffness: 0.15, snapThreshold: 0.30 },
  wood: { type: 'beam', cost: 1, stiffness: 0.15, snapThreshold: 0.25 },
},
```

Tune L1 `budget` from `500` → `30`.

DEV_STRESS `budget` stays `9999`.

The `cost` field is not exposed in the cheat GUI dev panel — it is not a tuning knob, it is a level design value.

## Logic layer — `LevelScene.js`

`_budgetRemaining` initialized in `create()` from `this.level.budget`.

**Placement guard** — in the second-click branch of `handleClick()`, before `physics.buildBeam` is called:
```js
if (this._budgetRemaining < this.material.cost) {
  this._flashBudget(); // visual feedback — see UI layer
  return;
}
this._budgetRemaining -= this.material.cost;
this._updateBudgetDisplay();
```

**Hard reset** — in `hardReset()`, after clearing beams:
```js
this._budgetRemaining = this.level.budget;
this._updateBudgetDisplay();
```

**`toggleTest()` RESET path** — when the player hits RESET (exits test mode), restore budget:
```js
this._budgetRemaining = this.level.budget;
this._updateBudgetDisplay();
```

**Auto-return path** — `update()` auto-fires `toggleTest()` after a win/fail via `clearBridgeData()`. Because `toggleTest()` now resets budget in its RESET branch, this path is covered automatically.

No new system module. All budget logic lives in `LevelScene`.

## UI layer — `LevelScene.js`

Budget counter on the right end of the `y=40` toolbar row. Pixel audit: Road x=95–225, Beam x=245–375, Clear x=415–545, TEST x=570–710. Budget rect at x=800 occupies x=735–865 — no overlap.

- Background rectangle at `x=800, y=40`, size `130×40`, `setScrollFactor(0)`
- Text: `LEFT: 30`, `fontSize: 16px`, centered on the rectangle, `setScrollFactor(0)`
- Label is "LEFT" not "BUDGET" — more readable for the target age group
- When `_budgetRemaining > 0`: text white (`#ffffff`), background `0x1a3a2a`
- When `_budgetRemaining === 0`: text red (`#ff4444`), background `0x3a1a1a`

**`_updateBudgetDisplay()`** — sets text to `LEFT: ${this._budgetRemaining}` and updates fill/color based on value. Called from: placement guard (after deduct), `hardReset()`, `toggleTest()` RESET branch.

**`_flashBudget()`** — called on blocked placement. Tweens the budget label: small horizontal shake (x ±4px, yoyo, 3 repeats, 40ms duration). Signals the block without audio dependency.

## Files touched

- `src/data/leveldata.js` — add `cost` to material definitions, tune L1 budget to 30
- `src/scenes/LevelScene.js` — `_budgetRemaining` init, placement guard in `handleClick`, budget reset in `hardReset()` and `toggleTest()` RESET branch, budget display widget + `_updateBudgetDisplay()` + `_flashBudget()`

## Architecture invariants honored

1. **Physics seam** — no changes to `physics.js`. Budget is purely a scene-level concern.
2. **`level.vehicles` always an array** — unchanged.
3. **System lifecycle** — no new system module introduced.

## Testing

Manual verification:
1. L1 loads with `LEFT: 30` displayed in green.
2. Place road segments — counter decrements by 2 each time.
3. Place beam segments — counter decrements by 1 each time.
4. Counter hits 0: turns red. Further placement attempts trigger the flash shake — no segment is placed.
5. CLEAR: counter resets to 30, display turns green.
6. TEST → RESET: counter resets to 30.
7. TEST → vehicle falls (fail): auto-return resets counter to 30.
8. DEV_STRESS: counter shows 9999, placement never blocks.
9. TEST still works at zero budget — vehicle spawns and drives.
