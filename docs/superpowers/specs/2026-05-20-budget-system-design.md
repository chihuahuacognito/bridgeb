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

- **Cost unit**: per segment placed (not per pixel). Simple to reason about: "I have 8 segments left."
- **Cost split**: road = 2, beam = 1. Road is twice as expensive as a beam.
- **Budget for L1**: 24. That allows 12 road segments max, or 24 beams, or any mix. Creates real tension over the 720px gap.
- **DEV_STRESS budget**: 9999 (unchanged — sandbox level).
- **Over-budget behaviour**: block placement when `_budgetRemaining === 0`. Player can still press TEST with whatever they have built. No hard lock on testing.
- **Deletion**: there is no individual segment deletion — only CLEAR (hard reset). Hard reset resets the budget to `level.budget` in full.
- **Hard reset**: resets `_budgetRemaining` to `level.budget`.

## Data layer — `leveldata.js`

Add `cost` to each material definition. Cost travels with the material so levels can tune it independently.

```js
materials: {
  road: { type: 'road', cost: 2, stiffness: 0.15, snapThreshold: 0.30 },
  wood: { type: 'beam', cost: 1, stiffness: 0.15, snapThreshold: 0.25 },
},
```

Tune L1 `budget` from `500` → `24`.

DEV_STRESS `budget` stays `9999`.

## Logic layer — `LevelScene.js`

`_budgetRemaining` initialized in `create()` from `this.level.budget`.

**Placement guard** — before committing a new segment, check:
```js
if (this._budgetRemaining < this.material.cost) return; // block silently
this._budgetRemaining -= this.material.cost;
```

**Hard reset** — in `hardReset()`, after clearing beams:
```js
this._budgetRemaining = this.level.budget;
```

No new system module. All budget logic lives in `LevelScene`.

## UI layer — `LevelScene.js`

Budget counter on the right end of the `y=40` toolbar row.

- Background rectangle at `x=800, y=40`, size `130×40`
- Text: `BUDGET: 24`, `fontSize: 16px`, white, centered on the rectangle
- Updates on every placement and deletion via a `_updateBudgetDisplay()` helper
- When `_budgetRemaining === 0`: text color → red (`#ff4444`), background fill → `0x3a1a1a`
- When `_budgetRemaining > 0`: text color → white (`#ffffff`), background fill → `0x1a3a2a`

## Files touched

- `src/data/leveldata.js` — add `cost` to material definitions, tune L1 budget to 24
- `src/scenes/LevelScene.js` — `_budgetRemaining` init, placement guard, deletion refund, hard reset sync, budget display widget + `_updateBudgetDisplay()`

## Architecture invariants honored

1. **Physics seam** — no changes to `physics.js`. Budget is purely a scene-level concern.
2. **`level.vehicles` always an array** — unchanged.
3. **System lifecycle** — no new system module introduced.

## Testing

Manual verification:
1. L1 loads with BUDGET: 24 displayed in green.
2. Place road segments — counter decrements by 2 each time.
3. Place beam segments — counter decrements by 1 each time.
4. Counter hits 0: turns red, further placement attempts are silently blocked.
5. CLEAR / hard reset: counter resets to 24.
7. DEV_STRESS: budget shows 9999, effectively unlimited.
8. TEST still works at zero budget — vehicle spawns and drives.
