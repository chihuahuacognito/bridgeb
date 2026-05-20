# Budget System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire up a per-segment budget so road costs 2 and beam costs 1, placement blocks at zero, and the counter resets on CLEAR and RESET.

**Architecture:** Cost lives in the material definition in `leveldata.js`. All budget state (`_budgetRemaining`) and display logic live in `LevelScene`. No new modules. The placement guard sits at the top of the `handleClick` second-click branch before any joint registration so no dangling joints are created on a blocked attempt.

**Tech Stack:** Phaser 3, Matter.js, Vite, Vitest

---

### Task 1: Add cost to level data

**Files:**
- Modify: `src/data/leveldata.js`

- [ ] **Step 1: Add `cost` to both material definitions in L1 and DEV_STRESS, and tune L1 budget**

In `src/data/leveldata.js`, update both level objects so every `materials` block reads:

```js
materials: {
  road: { type: 'road', cost: 2, stiffness: 0.15, snapThreshold: 0.30 },
  wood: { type: 'beam', cost: 1, stiffness: 0.15, snapThreshold: 0.25 },
},
```

Also change the L1 `budget` field from `500` to `30`. DEV_STRESS `budget` stays `9999`.

The full updated file:

```js
// src/data/leveldata.js
// Per spec §2 rule 3: level.vehicles is ALWAYS an array.

export const L1 = {
  id: 'L1',
  title: 'Forces & Gravity',
  span: 6,
  budget: 30,
  worldWidth: 1280,
  worldHeight: 720,
  canyon: {
    leftWall:  { x: 240,  y: 480, width: 80,  height: 240 },
    rightWall: { x: 1040, y: 480, width: 80,  height: 240 },
    waterY: 660,
  },
  anchors: [
    { id: 'L', x: 280,  y: 360, side: 'left' },
    { id: 'R', x: 1000, y: 360, side: 'right' },
  ],
  vehicles: [
    { type: 'car', spawnAt: 'left', weight: 200, speed: 'normal' },
  ],
  gravity: { y: 1.5, label: 'Normal' },
  materials: {
    road: { type: 'road', cost: 2, stiffness: 0.15, snapThreshold: 0.30 },
    wood: { type: 'beam', cost: 1, stiffness: 0.15, snapThreshold: 0.25 },
  },
};

export const DEV_STRESS = {
  id: 'DEV_STRESS',
  title: 'Dev — Stress Test',
  span: 6,
  budget: 9999,
  worldWidth: 1280,
  worldHeight: 720,
  canyon: {
    leftWall:  { x: 240,  y: 480, width: 80,  height: 240 },
    rightWall: { x: 1040, y: 480, width: 80,  height: 240 },
    waterY: 660,
  },
  anchors: [
    { id: 'L', x: 280,  y: 360, side: 'left' },
    { id: 'R', x: 1000, y: 360, side: 'right' },
  ],
  vehicles: [
    { type: 'car', spawnAt: 'left', weight: 2000, speed: 'normal' },
  ],
  gravity: { y: 1.5, label: 'Normal' },
  materials: {
    road: { type: 'road', cost: 2, stiffness: 0.15, snapThreshold: 0.30 },
    wood: { type: 'beam', cost: 1, stiffness: 0.15, snapThreshold: 0.25 },
  },
};

export const ALL_LEVELS = { L1, DEV_STRESS };
```

- [ ] **Step 2: Commit**

```bash
git add src/data/leveldata.js
git commit -m "feat(budget): add cost to materials, tune L1 budget to 30"
```

---

### Task 2: Budget state, display widget, and helpers

**Files:**
- Modify: `src/scenes/LevelScene.js`

- [ ] **Step 1: Initialize `_budgetRemaining` in `create()`**

In `create()`, find this line (around line 126):
```js
this.material = this.level.materials.road; // default: road placement
```

Add immediately after it:
```js
this._budgetRemaining = this.level.budget;
```

- [ ] **Step 2: Add the budget display widget in `create()`**

Find the TEST button block (around line 191):
```js
this.testButton = this.add.rectangle(640, 40, 140, 40, 0x2e7d32).setInteractive().setScrollFactor(0);
this.testButtonLabel = this.add.text(640, 40, 'TEST', { fontSize: '18px', color: '#fff' }).setOrigin(0.5).setScrollFactor(0);
this.testButton.on('pointerdown', (_p, _lx, _ly, ev) => { ev.stopPropagation(); this.toggleTest(); });
```

Add immediately after those three lines:
```js
this._budgetBg    = this.add.rectangle(800, 40, 130, 40, 0x1a3a2a).setScrollFactor(0);
this._budgetLabel = this.add.text(800, 40, `LEFT: ${this.level.budget}`, { fontSize: '16px', color: '#ffffff' })
  .setOrigin(0.5).setScrollFactor(0);
```

- [ ] **Step 3: Add `_updateBudgetDisplay()` method**

Add this method anywhere after `_selectMaterial()` (around line 287):

```js
_updateBudgetDisplay() {
  const n = this._budgetRemaining;
  this._budgetLabel.setText(`LEFT: ${n}`);
  if (n === 0) {
    this._budgetLabel.setColor('#ff4444');
    this._budgetBg.setFillStyle(0x3a1a1a);
  } else {
    this._budgetLabel.setColor('#ffffff');
    this._budgetBg.setFillStyle(0x1a3a2a);
  }
}
```

- [ ] **Step 4: Add `_flashBudget()` method**

Add directly after `_updateBudgetDisplay()`:

```js
_flashBudget() {
  this.tweens.add({
    targets: this._budgetLabel,
    x: '+=4',
    yoyo: true,
    repeat: 3,
    duration: 40,
  });
}
```

- [ ] **Step 5: Verify the game loads and shows LEFT: 30 in green**

Run: `npm run dev` and open the game. The toolbar should show a green `LEFT: 30` badge to the right of the TEST button. No interaction yet — just confirm it renders.

- [ ] **Step 6: Commit**

```bash
git add src/scenes/LevelScene.js
git commit -m "feat(budget): budget display widget + _updateBudgetDisplay + _flashBudget"
```

---

### Task 3: Placement guard in handleClick

**Files:**
- Modify: `src/scenes/LevelScene.js`

- [ ] **Step 1: Add the guard at the top of the second-click branch**

Find `handleClick` (around line 252). The full method currently reads:

```js
handleClick(pointer) {
  if (this.mode !== 'build') return;
  const raw = { x: pointer.worldX, y: pointer.worldY };
  const snap = this.findNearestJoint(raw);
  const p = snap ? { x: snap.x, y: snap.y, bodyId: snap.bodyId } : raw;

  if (!this.pendingJointA) {
    this.pendingJointA = p.bodyId ? p : this.registerNewJoint(p);
  } else {
    const endpoint = p.bodyId ? p : this.registerNewJoint(p);
    const matA = physics._nodes.get(this.pendingJointA.bodyId);
    const matB = physics._nodes.get(endpoint.bodyId);
    physics.buildBeam(matA, matB, this.material);
    this.beams.push({ a: this.pendingJointA, b: endpoint, material: this.material });
    this.pendingJointA = null;
    this.redrawBeams();
    this.redrawJoints(new Map());
  }
}
```

Replace it with:

```js
handleClick(pointer) {
  if (this.mode !== 'build') return;
  const raw = { x: pointer.worldX, y: pointer.worldY };
  const snap = this.findNearestJoint(raw);
  const p = snap ? { x: snap.x, y: snap.y, bodyId: snap.bodyId } : raw;

  if (!this.pendingJointA) {
    this.pendingJointA = p.bodyId ? p : this.registerNewJoint(p);
  } else {
    if (this._budgetRemaining < this.material.cost) {
      this._flashBudget();
      return;
    }
    const endpoint = p.bodyId ? p : this.registerNewJoint(p);
    const matA = physics._nodes.get(this.pendingJointA.bodyId);
    const matB = physics._nodes.get(endpoint.bodyId);
    physics.buildBeam(matA, matB, this.material);
    this.beams.push({ a: this.pendingJointA, b: endpoint, material: this.material });
    this._budgetRemaining -= this.material.cost;
    this._updateBudgetDisplay();
    this.pendingJointA = null;
    this.redrawBeams();
    this.redrawJoints(new Map());
  }
}
```

Note: the guard returns before `registerNewJoint` is called, so no dangling joints are created on a blocked attempt. `pendingJointA` is left set so the player can try again with a different second endpoint.

- [ ] **Step 2: Verify placement guard works**

Run `npm run dev`. Place road segments until `LEFT: 0` (red). Try to place another — counter should shake and no segment should appear. Switch to beam — still blocked (0 budget). Hit CLEAR — counter resets to 30 and turns green.

- [ ] **Step 3: Commit**

```bash
git add src/scenes/LevelScene.js
git commit -m "feat(budget): placement guard in handleClick — blocks and flashes at zero"
```

---

### Task 4: Budget reset on CLEAR and TEST→RESET

**Files:**
- Modify: `src/scenes/LevelScene.js`

- [ ] **Step 1: Reset budget in `hardReset()`**

Find `hardReset()` (around line 360). At the very end of the method, just before the closing brace, after `this.redrawJoints(new Map());`, add:

```js
this._budgetRemaining = this.level.budget;
this._updateBudgetDisplay();
```

The end of `hardReset()` should now look like:
```js
    this._selectMaterial('road'); // reset to default material
    this.redrawBeams();
    this.redrawJoints(new Map());
    this._budgetRemaining = this.level.budget;
    this._updateBudgetDisplay();
  }
```

- [ ] **Step 2: Reset budget in the `toggleTest()` RESET branch**

Find `toggleTest()` (around line 617). The `else` branch (the RESET path) ends with:
```js
    this.winOverlay?.destroy(); this.winOverlay = null;
    this.failOverlay?.destroy(); this.failOverlay = null;
    this.testEndAt = 0;
  }
```

Add budget reset before the closing brace:
```js
    this.winOverlay?.destroy(); this.winOverlay = null;
    this.failOverlay?.destroy(); this.failOverlay = null;
    this.testEndAt = 0;
    this._budgetRemaining = this.level.budget;
    this._updateBudgetDisplay();
  }
```

This also covers the auto-return path in `update()` (lines 700–703), which calls `clearBridgeData()` then `toggleTest()` — the `toggleTest()` else branch fires and resets the budget.

- [ ] **Step 3: Verify all reset paths**

Run `npm run dev` and check all three paths:

1. Place some segments → hit **CLEAR** → `LEFT: 30` resets.
2. Place some segments → hit **TEST** → hit **RESET** → `LEFT: 30` resets.
3. Place some segments → hit **TEST** → let the vehicle fall → wait for auto-return → `LEFT: 30` resets.

- [ ] **Step 4: Commit**

```bash
git add src/scenes/LevelScene.js
git commit -m "feat(budget): reset budget on hardReset and toggleTest RESET path"
```

---

### Task 5: Manual acceptance test

- [ ] **Step 1: Full acceptance run against spec**

Run `npm run dev` and verify each item from the spec:

| # | Check | Expected |
|---|-------|----------|
| 1 | Load L1 | `LEFT: 30` displayed in green in toolbar |
| 2 | Place road segments | Counter decrements by 2 each time |
| 3 | Place beam segments | Counter decrements by 1 each time |
| 4 | Counter hits 0 | Turns red; further placements trigger shake, no segment placed |
| 5 | CLEAR | Counter resets to 30, turns green |
| 6 | TEST → RESET | Counter resets to 30 |
| 7 | TEST → fall → auto-return | Counter resets to 30 |
| 8 | Load DEV_STRESS | Counter shows 9999, placement never blocks |
| 9 | TEST at zero budget | Vehicle spawns and drives normally |

- [ ] **Step 2: Run test suite to confirm no regressions**

```bash
npm test
```

Expected: all tests pass (budget logic is not unit-tested — it is scene-level UI).

- [ ] **Step 3: Commit if any fixups were needed, then tag**

```bash
git add src/scenes/LevelScene.js src/data/leveldata.js
git commit -m "fix(budget): acceptance test fixups"   # only if needed
```
