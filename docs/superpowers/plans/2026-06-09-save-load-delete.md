# Save / Load / Right-Click Delete Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Single-slot localStorage save/load per level plus right-click hover-highlight-and-delete for beams and free joints in build mode.

**Architecture:** `saveload.js` is a pure, framework-free module that owns all localStorage I/O. TopBar emits bus events; LevelScene handles them and owns all game-state mutation. Hover highlight piggbacks on the existing per-frame redraw loop via a new `_hoverTarget` field.

**Tech Stack:** Phaser 3, Matter.js (via Phaser), vanilla localStorage, Vitest (tests), event bus (`src/ui-html/bus.js`)

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `src/systems/saveload.js` | Create | `saveLayout` / `loadLayout` / `hasSave` — pure localStorage I/O |
| `tests/saveload.test.js` | Create | Unit tests for serialization round-trip |
| `src/ui-html/components/TopBar.js` | Modify | Enable SAVE/LOAD buttons, emit bus events, handle flash + enabled state |
| `src/ui-html/styles/components.css` | Modify | `.btn--saved` flash style |
| `src/scenes/LevelScene.js` | Modify | Save/load bus handlers, hover hit-test, right-click delete |

---

### Task 1: saveload.js — pure localStorage serialization

**Files:**
- Create: `src/systems/saveload.js`
- Create: `tests/saveload.test.js`

- [ ] **Step 1: Write the failing tests**

Create `tests/saveload.test.js`:

```js
import { describe, it, expect, beforeEach } from 'vitest';
import { saveLayout, loadLayout, hasSave } from '../src/systems/saveload.js';

const ANCHORS = [
  { x: 400, y: 480, isAnchor: true, bodyId: 'anchor_left_0' },
  { x: 880, y: 480, isAnchor: true, bodyId: 'anchor_right_0' },
];
const MID = { x: 640, y: 440, isAnchor: false, bodyId: 'joint_123' };
const MAT_ROAD = { type: 'road', stiffness: 0.6, snapThreshold: 0.065 };
const MAT_BEAM = { type: 'beam', stiffness: 0.4, snapThreshold: 0.08 };

beforeEach(() => localStorage.clear());

describe('hasSave', () => {
  it('returns false when nothing saved', () => {
    expect(hasSave('L1')).toBe(false);
  });
  it('returns true after saveLayout', () => {
    saveLayout('L1', [MID], [], 'car');
    expect(hasSave('L1')).toBe(true);
  });
  it('is per-level', () => {
    saveLayout('L1', [], [], 'car');
    expect(hasSave('DEV_STRESS')).toBe(false);
  });
});

describe('saveLayout / loadLayout round-trip', () => {
  it('returns null when nothing saved', () => {
    expect(loadLayout('L1')).toBeNull();
  });

  it('returns null for malformed JSON', () => {
    localStorage.setItem('bridgebuilder:save:L1', 'not-json{{{');
    expect(loadLayout('L1')).toBeNull();
  });

  it('serializes only non-anchor joints', () => {
    saveLayout('L1', [...ANCHORS, MID], [], 'car');
    const data = loadLayout('L1');
    expect(data.joints).toHaveLength(1);
    expect(data.joints[0]).toEqual({ id: 'joint_123', x: 640, y: 440 });
  });

  it('serializes beams with endpoint bodyIds and material type', () => {
    const beams = [
      { a: ANCHORS[0], b: MID, material: MAT_ROAD, constraint: {} },
      { a: MID, b: ANCHORS[1], material: MAT_BEAM, constraint: {} },
    ];
    saveLayout('L1', [...ANCHORS, MID], beams, 'truck');
    const data = loadLayout('L1');
    expect(data.beams).toEqual([
      { a: 'anchor_left_0', b: 'joint_123', material: 'road' },
      { a: 'joint_123',     b: 'anchor_right_0', material: 'beam' },
    ]);
  });

  it('serializes vehicle and levelId', () => {
    saveLayout('DEV_STRESS', [], [], 'tank');
    const data = loadLayout('DEV_STRESS');
    expect(data.vehicle).toBe('tank');
    expect(data.levelId).toBe('DEV_STRESS');
  });

  it('rounds joint coordinates to integers', () => {
    const fuzzy = { x: 640.7, y: 440.3, isAnchor: false, bodyId: 'j1' };
    saveLayout('L1', [fuzzy], [], 'car');
    const data = loadLayout('L1');
    expect(data.joints[0].x).toBe(641);
    expect(data.joints[0].y).toBe(440);
  });

  it('overwrites previous save for same level', () => {
    saveLayout('L1', [MID], [], 'car');
    saveLayout('L1', [], [], 'truck');
    const data = loadLayout('L1');
    expect(data.joints).toHaveLength(0);
    expect(data.vehicle).toBe('truck');
  });
});
```

- [ ] **Step 2: Run tests — confirm they fail**

```bash
npm test -- tests/saveload.test.js
```
Expected: FAIL — `saveLayout` not defined.

- [ ] **Step 3: Create `src/systems/saveload.js`**

```js
const KEY = (levelId) => `bridgebuilder:save:${levelId}`;

export function saveLayout(levelId, joints, beams, vehicle) {
  const data = {
    version: 1,
    levelId,
    savedAt: Date.now(),
    joints: joints
      .filter(j => !j.isAnchor)
      .map(j => ({ id: j.bodyId, x: Math.round(j.x), y: Math.round(j.y) })),
    beams: beams.map(b => ({ a: b.a.bodyId, b: b.b.bodyId, material: b.material.type })),
    vehicle,
  };
  localStorage.setItem(KEY(levelId), JSON.stringify(data));
}

export function loadLayout(levelId) {
  const raw = localStorage.getItem(KEY(levelId));
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function hasSave(levelId) {
  return localStorage.getItem(KEY(levelId)) !== null;
}
```

- [ ] **Step 4: Run tests — confirm they pass**

```bash
npm test -- tests/saveload.test.js
```
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add src/systems/saveload.js tests/saveload.test.js
git commit -m "feat(save): saveload.js — localStorage serialization with tests"
```

---

### Task 2: TopBar — enable SAVE/LOAD buttons with flash feedback

**Files:**
- Modify: `src/ui-html/components/TopBar.js`
- Modify: `src/ui-html/styles/components.css`

- [ ] **Step 1: Add `.btn--saved` flash style to components.css**

Open `src/ui-html/styles/components.css` and append at the end:

```css
.btn--saved {
  background: #22c55e !important;
  color: #fff !important;
  transition: background 0.1s;
}
```

- [ ] **Step 2: Rewrite TopBar.js to wire SAVE/LOAD**

Replace the existing SAVE/LOAD lines (currently `disabled: true`) with active buttons that keep references so they can be updated:

```js
import { bus } from '../bus.js';
import { Logo } from './Logo.js';
import { IconButton } from './IconButton.js';
import { CtaButton } from './CtaButton.js';
import { BudgetChip } from './BudgetChip.js';
import * as I from '../icons/index.js';

export function mountTopBar(root) {
  root.appendChild(Logo());

  root.appendChild(IconButton({
    icon: I.undo(), label: 'UNDO',
    onClick: () => bus.emit('undo'),
  }));
  root.appendChild(IconButton({
    icon: I.redo(), label: 'REDO', disabled: true,
  }));
  root.appendChild(IconButton({
    icon: I.clear(), label: 'CLEAR', accent: 'red',
    onClick: () => bus.emit('clear'),
  }));

  const cta = CtaButton({
    label: 'TEST',
    size: 'large',
    onClick: () => bus.emit('mode:toggle'),
  });
  root.appendChild(cta);

  root.appendChild(BudgetChip());

  const saveBtn = IconButton({
    icon: I.save(), label: 'SAVE',
    onClick: () => bus.emit('layout:save'),
  });
  root.appendChild(saveBtn);

  const loadBtn = IconButton({
    icon: I.load(), label: 'LOAD', disabled: true,
    onClick: () => bus.emit('layout:load'),
  });
  root.appendChild(loadBtn);

  root.appendChild(IconButton({ icon: I.settings(), label: 'SETTINGS', disabled: true }));
  root.appendChild(IconButton({ icon: I.help(),     label: 'HELP',     disabled: true }));

  bus.on('mode:changed', (mode) => {
    cta.setLabel(mode === 'test' ? 'RESET SIM' : 'TEST');
  });

  bus.on('layout:saved', () => {
    saveBtn.classList.add('btn--saved');
    setTimeout(() => saveBtn.classList.remove('btn--saved'), 800);
    loadBtn.removeAttribute('aria-disabled');
  });

  bus.on('layout:load-available', (available) => {
    if (available) {
      loadBtn.removeAttribute('aria-disabled');
    } else {
      loadBtn.setAttribute('aria-disabled', 'true');
    }
  });
}
```

- [ ] **Step 3: Run existing TopBar tests to confirm no regressions**

```bash
npm test -- tests/ui-html/
```
Expected: all PASS.

- [ ] **Step 4: Commit**

```bash
git add src/ui-html/components/TopBar.js src/ui-html/styles/components.css
git commit -m "feat(save): wire SAVE/LOAD buttons in TopBar with flash feedback"
```

---

### Task 3: LevelScene — save and load handlers

**Files:**
- Modify: `src/scenes/LevelScene.js`

- [ ] **Step 1: Import saveload in LevelScene**

At the top of `src/scenes/LevelScene.js`, add after the existing imports:

```js
import { saveLayout, loadLayout, hasSave } from '../systems/saveload.js';
```

- [ ] **Step 2: Register bus handlers for layout:save and layout:load**

In `create()`, inside the `this._busHandlers = { ... }` block (around line 225), add two entries:

```js
layoutSave: () => this._handleSave(),
layoutLoad: () => this._handleLoad(),
```

Then after the existing `bus.on(...)` lines (around line 240), add:

```js
bus.on('layout:save', this._busHandlers.layoutSave);
bus.on('layout:load', this._busHandlers.layoutLoad);
```

Then after the initial `bus.emit(...)` block (around line 246), add:

```js
bus.emit('layout:load-available', hasSave(this.levelId));
```

- [ ] **Step 3: Add `_handleSave()`, `_handleLoad()`, `_loadFromSave()` to LevelScene**

Add these three methods before the closing `}` of the class (after `redrawVehicle`):

```js
_handleSave() {
  saveLayout(this.levelId, this.joints, this.beams, this._vehiclePreset);
  bus.emit('layout:saved');
}

_handleLoad() {
  const data = loadLayout(this.levelId);
  if (!data) return;
  this._loadFromSave(data);
}

_loadFromSave(data) {
  // hardReset clears to anchors-only, exits test mode, wipes physics.
  this.hardReset();

  // Build a lookup of all joint objects (anchors already in this.joints after hardReset).
  const jointMap = new Map(this.joints.map(j => [j.bodyId, j]));

  // Restore saved mid-joints.
  for (const saved of data.joints) {
    const entry = { x: saved.x, y: saved.y, isAnchor: false, bodyId: saved.id };
    this.joints.push(entry);
    jointMap.set(saved.id, entry);
  }

  // Restore saved beams.
  for (const savedBeam of data.beams) {
    const jA = jointMap.get(savedBeam.a);
    const jB = jointMap.get(savedBeam.b);
    if (!jA || !jB) continue;
    const material = savedBeam.material === 'road'
      ? this.level.materials.road
      : this.level.materials.wood;
    this.beams.push({ a: jA, b: jB, material, constraint: null });
  }

  // Rebuild physics from the restored this.joints + this.beams.
  this.rebuildBridge();

  // Restore vehicle selection.
  if (data.vehicle) this._selectVehicle(data.vehicle);

  this.redrawBeams();
  this.redrawJoints(new Map());
}
```

- [ ] **Step 4: Manual smoke test**

```bash
npm run dev
```
1. Place a few road beams between the anchors.
2. Click SAVE — button should flash green briefly.
3. Click CLEAR — bridge disappears.
4. Click LOAD — bridge reappears exactly as saved.
5. Reload the page entirely — click LOAD — bridge still restores (persisted across sessions).
6. LOAD button should be grey on first load of a fresh level with no save.

- [ ] **Step 5: Commit**

```bash
git add src/scenes/LevelScene.js
git commit -m "feat(save): LevelScene save/load handlers with rebuildBridge restore"
```

---

### Task 4: Hover highlight for right-click delete

**Files:**
- Modify: `src/scenes/LevelScene.js`

- [ ] **Step 1: Initialise `_hoverTarget` in `create()`**

In `create()`, alongside `this._vehicleSprite = null` (around line 145), add:

```js
this._hoverTarget = null;
```

- [ ] **Step 2: Add `_findHoverTarget(worldX, worldY)` method**

Add this method alongside the other private helpers:

```js
_findHoverTarget(worldX, worldY) {
  let best = null;
  let bestDist = this.SNAP_RADIUS;

  for (let i = 0; i < this.beams.length; i++) {
    const b = this.beams[i];
    const pt = nearestPointOnSegment({ x: worldX, y: worldY }, b.a, b.b);
    const dist = Math.hypot(pt.x - worldX, pt.y - worldY);
    if (dist < bestDist) {
      bestDist = dist;
      best = { type: 'beam', index: i };
    }
  }

  if (!best) {
    for (let i = 0; i < this.joints.length; i++) {
      const j = this.joints[i];
      if (j.isAnchor) continue;
      const isFree = !this.beams.some(b => b.a.bodyId === j.bodyId || b.b.bodyId === j.bodyId);
      if (!isFree) continue;
      const dist = Math.hypot(j.x - worldX, j.y - worldY);
      if (dist < bestDist) {
        bestDist = dist;
        best = { type: 'joint', index: i };
      }
    }
  }

  return best;
}
```

Note: `nearestPointOnSegment` is exported from `../utils/snapGeometry.js` but LevelScene currently only imports `findBeamSnap`. Update the import at the top of LevelScene.js:

```js
import { findBeamSnap, nearestPointOnSegment } from '../utils/snapGeometry.js';
```

- [ ] **Step 3: Update `handleHover` to set `_hoverTarget`**

`handleHover` starts with `if (this.mode !== 'build') return;`. Change that early-return to also clear the hover target:

```js
handleHover(pointer) {
  if (this.mode !== 'build') {
    this._hoverTarget = null;
    return;
  }

  if (isOverHtmlChrome(pointer)) {
    this._hoverTarget = null;
    // ... rest of existing isOverHtmlChrome block unchanged
```

Then at the end of `handleHover`, just before the closing `}`, add:

```js
this._hoverTarget = this._findHoverTarget(pointer.worldX, pointer.worldY);
```

- [ ] **Step 4: Draw hover highlight in `redrawBeams()`**

`redrawBeams()` currently iterates `this.beams` and draws each one. After the loop, add a highlight pass:

```js
redrawBeams() {
  this.beamsGraphics.clear();
  for (const beam of this.beams) {
    const isRoad = beam.material?.type === 'road';
    this.beamsGraphics.lineStyle(
      isRoad ? VIZ.ROAD_THICKNESS : VIZ.BEAM_THICKNESS,
      isRoad ? VIZ.ROAD_COLOR     : VIZ.BEAM_COLOR, 1);
    this.beamsGraphics.beginPath();
    this.beamsGraphics.moveTo(beam.a.x, beam.a.y);
    this.beamsGraphics.lineTo(beam.b.x, beam.b.y);
    this.beamsGraphics.strokePath();
  }
  // Hover highlight: redraw target beam in red on top.
  if (this._hoverTarget?.type === 'beam') {
    const hb = this.beams[this._hoverTarget.index];
    if (hb) {
      this.beamsGraphics.lineStyle(4, 0xff2222, 1);
      this.beamsGraphics.beginPath();
      this.beamsGraphics.moveTo(hb.a.x, hb.a.y);
      this.beamsGraphics.lineTo(hb.b.x, hb.b.y);
      this.beamsGraphics.strokePath();
    }
  }
}
```

- [ ] **Step 5: Draw hover highlight in `redrawJoints()`**

`redrawJoints` draws from `physics._nodes`. For a hovered free joint, draw a red ring after the normal loop. Find the end of `redrawJoints` (after all the existing `for (const body of physics._nodes.values())` loop) and append:

```js
if (this._hoverTarget?.type === 'joint') {
  const hj = this.joints[this._hoverTarget.index];
  if (hj) {
    this.jointsGraphics.lineStyle(3, 0xff2222, 1);
    this.jointsGraphics.strokeCircle(hj.x, hj.y, VIZ.JOINT_RADIUS + 4);
  }
}
```

`VIZ.JOINT_RADIUS` is defined at the top of LevelScene (`JOINT_RADIUS: 7`) and used throughout `redrawJoints`.

- [ ] **Step 6: Manual test hover highlight**

```bash
npm run dev
```
- Place two or three road beams.
- Hover over the middle of a beam — it should turn red.
- Hover away — red disappears.
- Place a loose joint (start a beam, press Escape or don't connect), hover over it — red ring appears.
- Hover over an anchor — no red ring (anchors are excluded).

- [ ] **Step 7: Commit**

```bash
git add src/scenes/LevelScene.js
git commit -m "feat(delete): hover highlight for beam/free-joint delete targets"
```

---

### Task 5: Right-click delete + context menu suppression

**Files:**
- Modify: `src/scenes/LevelScene.js`

- [ ] **Step 1: Suppress browser context menu on the canvas**

In `create()`, after `physics.attach(this)`, add:

```js
this.sys.game.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
```

- [ ] **Step 2: Add right-click handler to `pointerdown`**

`create()` has:
```js
this.input.on('pointerdown', (pointer) => this.handleClick(pointer));
```

Change it to:
```js
this.input.on('pointerdown', (pointer) => {
  if (pointer.rightButtonDown()) {
    this._handleRightClickDelete(pointer);
  } else {
    this.handleClick(pointer);
  }
});
```

- [ ] **Step 3: Add `_deleteBeam`, `_deleteJoint`, `_handleRightClickDelete` methods**

```js
_handleRightClickDelete(pointer) {
  if (this.mode !== 'build') return;
  // Recompute at click time in case hover state is stale.
  const target = this._findHoverTarget(pointer.worldX, pointer.worldY);
  if (!target) return;
  if (target.type === 'beam') {
    this._deleteBeam(target.index);
  } else if (target.type === 'joint') {
    this._deleteJoint(target.index);
  }
  this._hoverTarget = null;
}

_deleteBeam(index) {
  const beam = this.beams[index];
  if (!beam) return;
  physics.removeBeam(beam.constraint);
  this.beams.splice(index, 1);
  this._hoverTarget = null;
  this.redrawBeams();
  this.redrawJoints(new Map());
}

_deleteJoint(index) {
  const joint = this.joints[index];
  if (!joint || joint.isAnchor) return;
  physics.removeJointNode(joint.bodyId);
  this.joints.splice(index, 1);
  this._hoverTarget = null;
  this.redrawBeams();
  this.redrawJoints(new Map());
}
```

- [ ] **Step 4: Manual test right-click delete**

```bash
npm run dev
```
1. Place several beams.
2. Hover over a beam (turns red), right-click — beam disappears.
3. Right-click on empty space — nothing happens.
4. Place a beam from anchor A to anchor B, then a second from anchor B to anchor C. Remove the second beam. Anchor B should still be visible (it's an anchor, not a free joint).
5. Add a mid-joint by starting a beam from an anchor, clicking to place a mid-joint, then pressing Escape (or clicking away) before finishing the second beam. Hover over the orphaned mid-joint (red ring), right-click — joint disappears.
6. Enter test mode, right-click on a beam — nothing should happen.
7. No browser context menu should appear anywhere on the canvas.

- [ ] **Step 5: Commit**

```bash
git add src/scenes/LevelScene.js
git commit -m "feat(delete): right-click delete for beams and free joints in build mode"
```
