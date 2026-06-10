---
Date: 2026-06-09
Status: Approved
---

# Save / Load / Right-Click Delete — Design Spec

## Overview

Two features:
1. **Single-slot save/load** — instantly persist and restore a bridge layout per level, zero dialogs.
2. **Right-click delete** — hover over any beam or free joint to highlight it red, right-click to delete it. Works in build mode only.

---

## Save / Load

### Storage

- **Backend:** `localStorage`, key `bridgebuilder:save:<levelId>` (e.g. `bridgebuilder:save:L1`).
- **Single slot per level.** SAVE always overwrites. LOAD always restores the last save. No history, no naming.
- Persists across browser sessions.

### Serialization format

```json
{
  "version": 1,
  "levelId": "L1",
  "savedAt": 1718000000000,
  "joints": [
    { "id": "j_1", "x": 640, "y": 400 }
  ],
  "beams": [
    { "a": "anchor_left_0", "b": "j_1", "material": "road" },
    { "a": "j_1", "b": "anchor_right_0", "material": "road" }
  ],
  "vehicle": "truck"
}
```

- `joints`: only **non-anchor** mid-joints. Anchor positions are defined by level data and never change.
- `beams`: each beam stores the `bodyId` of its two endpoints (may be an anchor id or a mid-joint id) and the material type string.
- `vehicle`: the selected vehicle preset key.
- Coordinates rounded to integers to keep the payload compact.

### SAVE flow

1. User clicks SAVE.
2. `saveload.saveLayout(levelId, joints, beams, vehicle)` serializes and writes to localStorage.
3. SAVE button briefly flashes a checkmark (CSS class swap, 800 ms) — no blocking UI.

### LOAD flow

1. User clicks LOAD.
2. `saveload.loadLayout(levelId)` reads and parses from localStorage. Returns `null` if nothing saved.
3. If `null`: LOAD button does nothing (stays greyed out until a save exists).
4. If data found: `LevelScene` calls `hardReset()`, replays joints and beams from the save, restores vehicle selection.
5. Scene lands in **build mode** after load, regardless of what mode it was in.

### LOAD button state

- Disabled (greyed) when no save exists for the current level.
- Enabled as soon as a save is written.

---

## Right-Click Delete

### Scope

- Active in **build mode only**. In test mode, right-click does nothing.
- Targets: **road beams**, **wood beams**, **free mid-joints** (joints with zero beams attached).
- Anchor joints cannot be deleted.

### Hover highlight

- On every `pointermove` in build mode, LevelScene runs a hit-test:
  - Finds the nearest beam within `SNAP_RADIUS` (same radius used for placement snapping).
  - If no beam found, checks for the nearest free mid-joint within `SNAP_RADIUS`.
- The closest candidate is stored as `this._hoverTarget = { type: 'beam'|'joint', index }`.
- `redrawJoints` / `redrawBeamBases` draw the hover target in red (0xff2222) each frame.
- When pointer leaves the snap radius, `_hoverTarget` is cleared and the highlight disappears.

### Right-click delete

- Phaser `pointerdown` callback receives a `pointer` argument; check `pointer.rightButtonDown()` in build mode:
  - If `_hoverTarget.type === 'beam'`: calls `_deleteBeam(index)`.
  - If `_hoverTarget.type === 'joint'`: calls `_deleteJoint(index)`.
- `_deleteBeam(index)`: removes the beam from `this.beams`, calls `physics.removeBeam(constraint)`, clears `_hoverTarget`.
- `_deleteJoint(index)`: removes the joint from `this.joints`, calls `physics.removeJointNode(jointId)`, clears `_hoverTarget`.
- Browser context menu is suppressed on the canvas (`canvas.addEventListener('contextmenu', e => e.preventDefault())`).

### Free joint detection

A joint is "free" if no entry in `this.beams` references its `bodyId` as `a` or `b`. Anchors are never free by definition.

---

## New File

### `src/systems/saveload.js`

Pure functions, no Phaser or physics dependencies:

```js
export function saveLayout(levelId, joints, beams, vehicle) { ... }
export function loadLayout(levelId) { ... }  // returns parsed object or null
export function hasSave(levelId) { ... }     // returns boolean
```

---

## Files Changed

| File | Change |
|------|--------|
| `src/systems/saveload.js` | New — localStorage serialization |
| `src/ui-html/components/TopBar.js` | Wire SAVE/LOAD buttons, add flash feedback |
| `src/scenes/LevelScene.js` | Handle save/load bus events, hover hit-test, right-click delete, suppress context menu |

---

## Out of Scope

- Undo for right-click delete (can be added later; undo stack already exists).
- Multiple save slots.
- Export/import to file.
- Save across levels.
