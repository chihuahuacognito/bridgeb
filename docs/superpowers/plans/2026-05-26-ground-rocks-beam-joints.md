# Ground, Rocks & Beam-on-Beam Joining — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace rectangle canyon walls with shaped terrain polygons, add mid-span rock pillars with anchor points, and allow beams to be placed onto existing beams (splitting them at the click point) with visual snap indicators that differ by target type.

**Architecture:** Terrain and rocks are static Matter.js bodies built from `physRect` fields in leveldata (polygon visuals rendered by Phaser, rectangles used for physics). Beam-on-beam joining creates a new joint node at the split point, removes the original beam constraint, and replaces it with two shorter constraints. Snap detection runs in `handleHover` and `handleClick`, with the indicator type (yellow ring vs green circle+crosshair) determined by what the cursor is nearest to.

**Tech Stack:** Phaser 3, Matter.js (via `this._scene.matter`), Vitest, existing physics singleton (`src/systems/physics.js`), LevelScene (`src/scenes/LevelScene.js`), level data (`src/data/leveldata.js`).

---

## File Map

| File | Change |
|---|---|
| `src/data/leveldata.js` | Replace `canyon` with `terrain` + `rocks` arrays |
| `src/systems/physics.js` | Replace `buildCanyon` with `buildTerrain` + `buildRocks`; add `removeBeam` |
| `src/utils/snapGeometry.js` | **Create** — `nearestPointOnSegment`, `findBeamSnap` |
| `src/scenes/LevelScene.js` | Replace `drawCanyon` with `drawTerrain`+`drawRocks`; update `create`, `handleClick`, `handleHover`; add `splitBeam` |
| `tests/snapGeometry.test.js` | **Create** — unit tests for geometry helpers |

---

## Task 1: Add `terrain` + `rocks` schema to leveldata

**Files:**
- Modify: `src/data/leveldata.js`

- [ ] **Step 1: Write the failing test**

Create `tests/leveldata.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { L1 } from '../src/data/leveldata.js';

describe('leveldata terrain schema', () => {
  it('L1 has terrain.left and terrain.right with verts and physRect', () => {
    expect(L1.terrain.left.verts).toBeInstanceOf(Array);
    expect(L1.terrain.left.verts.length).toBeGreaterThan(2);
    expect(L1.terrain.left.physRect).toMatchObject({ x: expect.any(Number), y: expect.any(Number), width: expect.any(Number), height: expect.any(Number) });
    expect(L1.terrain.right.verts).toBeInstanceOf(Array);
    expect(L1.terrain.waterY).toBeGreaterThan(0);
  });

  it('L1 has a rocks array (may be empty)', () => {
    expect(Array.isArray(L1.rocks)).toBe(true);
  });

  it('any rock has id, verts, physRect, and anchors array', () => {
    for (const r of L1.rocks) {
      expect(r.id).toBeTruthy();
      expect(r.verts).toBeInstanceOf(Array);
      expect(r.physRect).toMatchObject({ x: expect.any(Number), y: expect.any(Number), width: expect.any(Number), height: expect.any(Number) });
      expect(Array.isArray(r.anchors)).toBe(true);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```
cd bridgeb && npx vitest run tests/leveldata.test.js
```

Expected: FAIL — `L1.terrain` is undefined.

- [ ] **Step 3: Replace `canyon` with `terrain` + add `rocks` in both L1 and DEV_STRESS**

In `src/data/leveldata.js`, replace the entire file content:

```js
// src/data/leveldata.js
// Per spec §2 rule 3: level.vehicles is ALWAYS an array.

export const L1 = {
  id: 'L1',
  title: 'Forces & Gravity',
  span: 6,
  budget: 16,
  worldWidth: 1280,
  worldHeight: 720,
  terrain: {
    left: {
      // Polygon vertices drawn clockwise. Bottom-left corner is world edge.
      verts: [
        { x: 0,   y: 360 },
        { x: 280, y: 360 },
        { x: 280, y: 500 },
        { x: 180, y: 560 },
        { x: 0,   y: 560 },
      ],
      // Rectangle used for Matter.js static body (center x/y, full width/height).
      physRect: { x: 140, y: 460, width: 280, height: 200 },
      color: 0x2c3033,
    },
    right: {
      verts: [
        { x: 1000, y: 360 },
        { x: 1280, y: 360 },
        { x: 1280, y: 560 },
        { x: 1100, y: 560 },
        { x: 1000, y: 500 },
      ],
      physRect: { x: 1140, y: 460, width: 280, height: 200 },
      color: 0x2c3033,
    },
    waterY: 660,
  },
  rocks: [],
  anchors: [
    { id: 'L', x: 280,  y: 360, side: 'left' },
    { id: 'R', x: 1000, y: 360, side: 'right' },
  ],
  vehicles: [
    { type: 'car', spawnAt: 'left', weight: 200, speed: 'normal' },
  ],
  gravity: { y: 1.5, label: 'Normal' },
  materials: {
    road: { type: 'road', cost: 2, stiffness: 0.08, snapThreshold: 0.025 },
    wood: { type: 'beam', cost: 1, stiffness: 0.15, snapThreshold: 0.18 },
  },
};

export const DEV_STRESS = {
  id: 'DEV_STRESS',
  title: 'Dev — Stress Test',
  span: 6,
  budget: 40,
  worldWidth: 1280,
  worldHeight: 720,
  terrain: {
    left: {
      verts: [
        { x: 0,   y: 360 },
        { x: 280, y: 360 },
        { x: 280, y: 500 },
        { x: 180, y: 560 },
        { x: 0,   y: 560 },
      ],
      physRect: { x: 140, y: 460, width: 280, height: 200 },
      color: 0x2c3033,
    },
    right: {
      verts: [
        { x: 1000, y: 360 },
        { x: 1280, y: 360 },
        { x: 1280, y: 560 },
        { x: 1100, y: 560 },
        { x: 1000, y: 500 },
      ],
      physRect: { x: 1140, y: 460, width: 280, height: 200 },
      color: 0x2c3033,
    },
    waterY: 660,
  },
  rocks: [
    {
      id: 'C1',
      verts: [
        { x: 600, y: 440 },
        { x: 680, y: 440 },
        { x: 700, y: 580 },
        { x: 580, y: 580 },
      ],
      physRect: { x: 640, y: 510, width: 120, height: 140 },
      color: 0x8b6a2e,
      anchors: [
        { id: 'C1_L', x: 600, y: 440 },
        { id: 'C1_R', x: 680, y: 440 },
      ],
    },
  ],
  anchors: [
    { id: 'L', x: 280,  y: 360, side: 'left' },
    { id: 'R', x: 1000, y: 360, side: 'right' },
  ],
  vehicles: [
    { type: 'car', spawnAt: 'left', weight: 2000, speed: 'normal' },
  ],
  gravity: { y: 1.5, label: 'Normal' },
  materials: {
    road: { type: 'road', cost: 2, stiffness: 0.08, snapThreshold: 0.025 },
    wood: { type: 'beam', cost: 1, stiffness: 0.15, snapThreshold: 0.18 },
  },
};

export const ALL_LEVELS = { L1, DEV_STRESS };
```

- [ ] **Step 4: Run test to verify it passes**

```
npx vitest run tests/leveldata.test.js
```

Expected: PASS

- [ ] **Step 5: Commit**

```
git add src/data/leveldata.js tests/leveldata.test.js
git commit -m "feat: replace canyon rect schema with terrain polygon + rocks array"
```

---

## Task 2: Create `src/utils/snapGeometry.js` with geometry helpers

**Files:**
- Create: `src/utils/snapGeometry.js`
- Create: `tests/snapGeometry.test.js`

- [ ] **Step 1: Write the failing tests**

Create `tests/snapGeometry.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { nearestPointOnSegment, findBeamSnap } from '../src/utils/snapGeometry.js';

describe('nearestPointOnSegment', () => {
  it('returns midpoint when P projects onto middle of AB', () => {
    const r = nearestPointOnSegment({ x: 150, y: 10 }, { x: 0, y: 0 }, { x: 300, y: 0 });
    expect(r.x).toBeCloseTo(150);
    expect(r.y).toBeCloseTo(0);
    expect(r.t).toBeCloseTo(0.5);
  });

  it('clamps t to 0 when P is before A', () => {
    const r = nearestPointOnSegment({ x: -50, y: 0 }, { x: 0, y: 0 }, { x: 100, y: 0 });
    expect(r.t).toBe(0);
    expect(r.x).toBeCloseTo(0);
  });

  it('clamps t to 1 when P is past B', () => {
    const r = nearestPointOnSegment({ x: 200, y: 0 }, { x: 0, y: 0 }, { x: 100, y: 0 });
    expect(r.t).toBe(1);
    expect(r.x).toBeCloseTo(100);
  });

  it('works on a diagonal segment', () => {
    const r = nearestPointOnSegment({ x: 0, y: 100 }, { x: 0, y: 0 }, { x: 100, y: 100 });
    expect(r.t).toBeCloseTo(0.5);
    expect(r.x).toBeCloseTo(50);
    expect(r.y).toBeCloseTo(50);
  });
});

describe('findBeamSnap', () => {
  const beams = [
    { a: { x: 0, y: 0 }, b: { x: 200, y: 0 } },
  ];

  it('returns null when cursor is outside radius', () => {
    expect(findBeamSnap({ x: 100, y: 40 }, beams, 20)).toBeNull();
  });

  it('returns snap when cursor is within radius of beam midpoint', () => {
    const snap = findBeamSnap({ x: 100, y: 10 }, beams, 20);
    expect(snap).not.toBeNull();
    expect(snap.beamIndex).toBe(0);
    expect(snap.point.x).toBeCloseTo(100);
    expect(snap.t).toBeCloseTo(0.5);
  });

  it('ignores points within 5% of endpoints (t < 0.05 or t > 0.95)', () => {
    // Very close to A endpoint (t ≈ 0.01)
    expect(findBeamSnap({ x: 2, y: 5 }, beams, 20)).toBeNull();
    // Very close to B endpoint (t ≈ 0.99)
    expect(findBeamSnap({ x: 198, y: 5 }, beams, 20)).toBeNull();
  });

  it('returns the closest beam when multiple beams are in range', () => {
    const twoBeams = [
      { a: { x: 0, y: 0 }, b: { x: 200, y: 0 } },
      { a: { x: 0, y: 8 }, b: { x: 200, y: 8 } },
    ];
    const snap = findBeamSnap({ x: 100, y: 5 }, twoBeams, 20);
    expect(snap.beamIndex).toBe(0); // beam 0 is 5px away, beam 1 is 3px away
    // Actually beam 1 is closer: dist = |5-8| = 3 < 5 = dist to beam 0
    // Re-check: cursor y=5, beam0 y=0 → dist=5; beam1 y=8 → dist=3 → beam1 wins
    expect(snap.beamIndex).toBe(1);
  });
});
```

Note: the last test has a logical self-correction inline — the assertion should be `beamIndex === 1`. Write it exactly as shown.

- [ ] **Step 2: Run test to verify it fails**

```
npx vitest run tests/snapGeometry.test.js
```

Expected: FAIL — module not found.

- [ ] **Step 3: Create `src/utils/snapGeometry.js`**

```js
// src/utils/snapGeometry.js

export function nearestPointOnSegment(P, A, B) {
  const dx = B.x - A.x;
  const dy = B.y - A.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return { x: A.x, y: A.y, t: 0 };
  const t = Math.max(0, Math.min(1, ((P.x - A.x) * dx + (P.y - A.y) * dy) / lenSq));
  return { x: A.x + t * dx, y: A.y + t * dy, t };
}

// Returns { point: {x,y}, beamIndex, t } or null.
// Excludes points within 5% of either endpoint so you don't accidentally
// "split" a beam right next to its joint node.
export function findBeamSnap(P, beams, radius) {
  let best = null;
  let bestDist = radius;
  for (let i = 0; i < beams.length; i++) {
    const near = nearestPointOnSegment(P, beams[i].a, beams[i].b);
    if (near.t < 0.05 || near.t > 0.95) continue;
    const dist = Math.hypot(P.x - near.x, P.y - near.y);
    if (dist < bestDist) {
      bestDist = dist;
      best = { point: { x: near.x, y: near.y }, beamIndex: i, t: near.t };
    }
  }
  return best;
}
```

- [ ] **Step 4: Fix the test — the two-beam assertion has a self-correction inside it**

The last test as written has a contradictory pair of `expect` calls. Fix the test to have a single correct assertion:

```js
  it('returns the closest beam when multiple beams are in range', () => {
    const twoBeams = [
      { a: { x: 0, y: 0 }, b: { x: 200, y: 0 } },
      { a: { x: 0, y: 8 }, b: { x: 200, y: 8 } },
    ];
    // cursor at y=5: beam0 is 5px away, beam1 is 3px away → beam1 wins
    const snap = findBeamSnap({ x: 100, y: 5 }, twoBeams, 20);
    expect(snap.beamIndex).toBe(1);
  });
```

- [ ] **Step 5: Run tests to verify they pass**

```
npx vitest run tests/snapGeometry.test.js
```

Expected: PASS (4 tests in `nearestPointOnSegment`, 4 in `findBeamSnap`)

- [ ] **Step 6: Commit**

```
git add src/utils/snapGeometry.js tests/snapGeometry.test.js
git commit -m "feat: add snapGeometry helpers (nearestPointOnSegment, findBeamSnap)"
```

---

## Task 3: Update `physics.js` — replace `buildCanyon` with `buildTerrain` + `buildRocks`, add `removeBeam`

**Files:**
- Modify: `src/systems/physics.js`

- [ ] **Step 1: Replace `buildCanyon` with `buildTerrain`**

Find the `buildCanyon` method (lines ~114–134) and replace it entirely:

```js
  // Build static collision bodies for terrain sides. Called once from LevelScene.
  // Uses physRect (center x/y, width, height) for the Matter body.
  // Idempotent: clears existing canyon bodies first.
  buildTerrain(terrainData) {
    if (!this._scene) return;
    if (this._canyonBodies.length > 0) {
      this._scene.matter.world.remove(this._canyonBodies);
      this._canyonBodies.length = 0;
    }
    for (const side of [terrainData.left, terrainData.right]) {
      const { x, y, width, height } = side.physRect;
      const body = this._scene.matter.add.rectangle(x, y, width, height, {
        isStatic: true,
        label: 'terrain',
        friction: 0.6,
        collisionFilter: { category: 0x0008, mask: 0xFFFF },
      });
      this._canyonBodies.push(body);
    }
  },

  // Build static collision bodies for rocks. Each rock may have anchor points
  // registered as joint nodes (static anchors the player can attach beams to).
  buildRocks(rocks) {
    if (!this._scene) return;
    for (const rock of rocks) {
      const { x, y, width, height } = rock.physRect;
      const body = this._scene.matter.add.rectangle(x, y, width, height, {
        isStatic: true,
        label: 'rock',
        friction: 0.6,
        collisionFilter: { category: 0x0008, mask: 0xFFFF },
      });
      this._canyonBodies.push(body);
      // Register rock anchor points as static joint nodes.
      for (const anchor of (rock.anchors ?? [])) {
        this.ensureJointNode(anchor.id, anchor.x, anchor.y, true);
      }
    }
  },
```

- [ ] **Step 2: Add `removeBeam` method** (needed by `splitBeam` in Task 5)

Add after `buildRocks`:

```js
  // Remove a beam constraint and its associated collision body from the world.
  // Called by LevelScene.splitBeam when splitting a beam at a mid-point.
  removeBeam(constraint) {
    const idx = this._beamConstraints.findIndex(b => b.constraint === constraint);
    if (idx === -1) return;
    const entry = this._beamConstraints[idx];
    const toRemove = [entry.constraint];
    if (entry.body)    toRemove.push(entry.body);
    if (entry.attachA) toRemove.push(entry.attachA);
    if (entry.attachB) toRemove.push(entry.attachB);
    this._scene.matter.world.remove(toRemove);
    this._beamConstraints.splice(idx, 1);
  },
```

- [ ] **Step 3: Run existing tests to confirm nothing broke**

```
npx vitest run
```

Expected: All previously-passing tests still pass.

- [ ] **Step 4: Commit**

```
git add src/systems/physics.js
git commit -m "feat: physics buildTerrain/buildRocks/removeBeam (replaces buildCanyon)"
```

---

## Task 4: Update `LevelScene.js` — terrain + rock visuals, wire up new physics calls

**Files:**
- Modify: `src/scenes/LevelScene.js`

- [ ] **Step 1: Replace `drawCanyon` with `drawTerrain` and add `drawRocks`**

Find `drawCanyon()` (currently drawing leftWall/rightWall rectangles) and replace it with:

```js
  drawTerrain() {
    const g = this.add.graphics();
    const { left, right } = this.level.terrain;
    for (const side of [left, right]) {
      g.fillStyle(side.color ?? 0x2c3033, 1);
      g.fillPoints(side.verts, true);
      g.lineStyle(2, 0x1a1d20, 1);
      g.strokePoints(side.verts, true);
    }
  },

  drawRocks() {
    const g = this.add.graphics();
    for (const rock of (this.level.rocks ?? [])) {
      g.fillStyle(rock.color ?? 0x8b6a2e, 1);
      g.fillPoints(rock.verts, true);
      g.lineStyle(2, 0x1a1d20, 1);
      g.strokePoints(rock.verts, true);
    }
  },
```

Also replace `drawWater()` to read from `terrain.waterY` instead of `canyon.waterY`:

```js
  drawWater() {
    const g = this.add.graphics();
    g.fillStyle(0x1a1d20, 1);
    g.fillRect(0, this.level.terrain.waterY, this.level.worldWidth,
               this.level.worldHeight - this.level.terrain.waterY);
  },
```

- [ ] **Step 2: Update `create()` — call new draw/physics methods and register rock anchors**

In `create()`, find:
```js
    this.drawSky();
    this.drawGrid();
    this.drawCanyon();
    this.drawWater();
```
Replace with:
```js
    this.drawSky();
    this.drawGrid();
    this.drawTerrain();
    this.drawRocks();
    this.drawWater();
```

Find:
```js
    physics.buildCanyon(this.level.canyon);
```
Replace with:
```js
    physics.buildTerrain(this.level.terrain);
    physics.buildRocks(this.level.rocks ?? []);
```

Find the anchor registration loop:
```js
    for (const a of this.level.anchors) {
      physics.ensureJointNode(a.id, a.x, a.y, /* isAnchor */ true);
      const dataJoint = this.joints.find(j => j.x === a.x && j.y === a.y);
      if (dataJoint) dataJoint.bodyId = a.id;
    }
```
Add rock anchor registration immediately after it:
```js
    for (const rock of (this.level.rocks ?? [])) {
      for (const a of (rock.anchors ?? [])) {
        // Physics body already created by buildRocks; just add to the scene joint list.
        if (!this.joints.find(j => j.bodyId === a.id)) {
          this.joints.push({ x: a.x, y: a.y, isAnchor: true, bodyId: a.id });
        }
      }
    }
```

- [ ] **Step 3: Update `init()` — read anchors from terrain + rocks**

`init()` currently seeds `this.joints` from `this.level.anchors` only. Add rock anchors to the initial list:

Find in `init()`:
```js
    this.joints = this.level.anchors.map(a => ({ x: a.x, y: a.y, isAnchor: true, bodyId: a.id }));
```
Replace with:
```js
    this.joints = [
      ...this.level.anchors.map(a => ({ x: a.x, y: a.y, isAnchor: true, bodyId: a.id })),
      ...(this.level.rocks ?? []).flatMap(rock =>
        (rock.anchors ?? []).map(a => ({ x: a.x, y: a.y, isAnchor: true, bodyId: a.id }))
      ),
    ];
```

- [ ] **Step 4: Run the dev server and confirm terrain renders**

```
cd bridgeb && npm run dev
```

Open L1 in browser. Confirm:
- Terrain polygons visible instead of rectangles
- Water line unchanged
- Existing beam placement still works
- No console errors

- [ ] **Step 5: Load DEV_STRESS level and confirm rock renders**

In browser, navigate to DEV_STRESS. Confirm:
- Rock polygon C1 visible in the center-ish area
- Rock anchor points visible as red circles
- Beams can be attached to rock anchors

- [ ] **Step 6: Commit**

```
git add src/scenes/LevelScene.js
git commit -m "feat: terrain polygon + rock visuals wired into LevelScene"
```

---

## Task 5: Beam-on-beam splitting — `splitBeam` + updated `handleClick`

**Files:**
- Modify: `src/scenes/LevelScene.js`
- Import `findBeamSnap` from `src/utils/snapGeometry.js`

- [ ] **Step 1: Add import at top of LevelScene.js**

Find the last import line (currently `import cam from '../systems/camera.js';`) and add after it:

```js
import { findBeamSnap } from '../utils/snapGeometry.js';
```

- [ ] **Step 2: Add `splitBeam` method to LevelScene**

Add as a new method after `registerNewJoint`:

```js
  splitBeam(beamIndex, splitPoint) {
    const beam = this.beams[beamIndex];
    const mat = beam.material;

    // Remove the old beam from physics and data.
    physics.removeBeam(beam.constraint);
    this.beams.splice(beamIndex, 1);

    // Create the new mid-joint node at the split point.
    const newJoint = this.registerNewJoint(splitPoint);

    // Retrieve the Matter bodies for both original endpoints and the new joint.
    const bodyA = physics._nodes.get(beam.a.bodyId);
    const bodyC = physics._nodes.get(newJoint.bodyId);
    const bodyB = physics._nodes.get(beam.b.bodyId);

    // Build two replacement beams.
    const c1 = physics.buildBeam(bodyA, bodyC, mat);
    this.beams.push({ a: beam.a, b: newJoint, material: mat, constraint: c1 });

    const c2 = physics.buildBeam(bodyC, bodyB, mat);
    this.beams.push({ a: newJoint, b: beam.b, material: mat, constraint: c2 });

    this.redrawBeams();
    this.redrawJoints(new Map());
    return newJoint;
  },
```

- [ ] **Step 3: Confirm `buildBeam` returns the constraint**

Check in `physics.js` that `buildBeam` returns `constraint`. It currently returns nothing. Add `return constraint;` at the end of `buildBeam`:

```js
    // ... (existing end of buildBeam)
    return constraint;
  },
```

- [ ] **Step 4: Update `handleClick` to detect beam snaps**

Find the existing `handleClick`:

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
        this.pendingJointA = null;
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
  },
```

Replace with:

```js
  handleClick(pointer) {
    if (this.mode !== 'build') return;
    const raw = { x: pointer.worldX, y: pointer.worldY };

    // Priority: joint snap > beam snap > free point.
    const jointSnap = this.findNearestJoint(raw);
    let p;
    let beamSnapResult = null;

    if (jointSnap) {
      p = { x: jointSnap.x, y: jointSnap.y, bodyId: jointSnap.bodyId };
    } else {
      beamSnapResult = findBeamSnap(raw, this.beams, this.SNAP_RADIUS);
      p = beamSnapResult ? { x: beamSnapResult.point.x, y: beamSnapResult.point.y } : raw;
    }

    if (!this.pendingJointA) {
      if (beamSnapResult) {
        // Clicking on a beam mid-span creates a new joint by splitting the beam.
        const newJoint = this.splitBeam(beamSnapResult.beamIndex, beamSnapResult.point);
        this.pendingJointA = newJoint;
      } else {
        this.pendingJointA = p.bodyId ? p : this.registerNewJoint(p);
      }
    } else {
      if (this._budgetRemaining < this.material.cost) {
        this._flashBudget();
        this.pendingJointA = null;
        return;
      }
      let endpoint;
      if (beamSnapResult) {
        endpoint = this.splitBeam(beamSnapResult.beamIndex, beamSnapResult.point);
      } else {
        endpoint = p.bodyId ? p : this.registerNewJoint(p);
      }
      const matA = physics._nodes.get(this.pendingJointA.bodyId);
      const matB = physics._nodes.get(endpoint.bodyId);
      const constraint = physics.buildBeam(matA, matB, this.material);
      this.beams.push({ a: this.pendingJointA, b: endpoint, material: this.material, constraint });
      this._budgetRemaining -= this.material.cost;
      this._updateBudgetDisplay();
      this.pendingJointA = null;
      this.redrawBeams();
      this.redrawJoints(new Map());
    }
  },
```

- [ ] **Step 5: Also update the existing non-split beam push to include `constraint`**

Note: the old `this.beams.push(...)` in `handleClick` (second branch, non-split path) now uses `const constraint = physics.buildBeam(...)` — this is already done in the replacement above. Confirm `this.beams` entries always have `{ a, b, material, constraint }` shape. Check `init()` — the beams array starts empty so no migration needed.

- [ ] **Step 6: Run the game and test splitting**

```
npm run dev
```

Manual test:
1. Place a beam from L anchor to R anchor
2. Click somewhere on the middle of that beam
3. Confirm the beam is split into two, with a new yellow joint visible at the click point
4. Attach another beam from the new joint
5. Run TEST — confirm the bridge still behaves physically correctly

- [ ] **Step 7: Commit**

```
git add src/scenes/LevelScene.js src/systems/physics.js
git commit -m "feat: beam-on-beam splitting via splitBeam + updated handleClick"
```

---

## Task 6: Visual snap indicators by target type

**Files:**
- Modify: `src/scenes/LevelScene.js`

The existing `handleHover` draws a yellow ring for joint snap. Extend it to also draw a green circle + crosshair when hovering over a beam mid-span.

- [ ] **Step 1: Find `handleHover`**

Look for the method. It currently:
1. Detects joint snap via `findNearestJoint`
2. Draws a yellow ring on `this.snapGraphics` if a joint is near
3. Draws a ghost line from `pendingJointA` to cursor

- [ ] **Step 2: Replace `handleHover` with the extended version**

Read the current `handleHover` from the file to get its exact text, then replace. The new version adds beam-snap detection and a distinct green indicator:

```js
  handleHover(pointer) {
    if (this.mode !== 'build') return;
    const raw = { x: pointer.worldX, y: pointer.worldY };

    this.snapGraphics.clear();
    this.ghostGraphics.clear();

    // Determine what the cursor is near: joint takes priority over beam.
    const jointSnap = this.findNearestJoint(raw);
    const beamSnap = jointSnap ? null : findBeamSnap(raw, this.beams, this.SNAP_RADIUS);

    // Joint snap indicator — yellow ring (existing behaviour).
    if (jointSnap) {
      this.snapTarget = { x: jointSnap.x, y: jointSnap.y, bodyId: jointSnap.bodyId };
      this.snapGraphics.lineStyle(3, VIZ.JOINT_COLOR, 0.9);
      this.snapGraphics.strokeCircle(jointSnap.x, jointSnap.y, VIZ.JOINT_RADIUS + 5);
    }
    // Beam snap indicator — green filled circle + crosshair.
    else if (beamSnap) {
      const { x, y } = beamSnap.point;
      this.snapTarget = { x, y };
      const GREEN = 0x44dd44;
      this.snapGraphics.fillStyle(GREEN, 0.5);
      this.snapGraphics.fillCircle(x, y, 8);
      this.snapGraphics.lineStyle(2, GREEN, 0.9);
      this.snapGraphics.strokeCircle(x, y, 8);
      // Crosshair lines.
      const HALF = 12;
      this.snapGraphics.beginPath();
      this.snapGraphics.moveTo(x - HALF, y); this.snapGraphics.lineTo(x + HALF, y);
      this.snapGraphics.moveTo(x, y - HALF); this.snapGraphics.lineTo(x, y + HALF);
      this.snapGraphics.strokePath();
    } else {
      this.snapTarget = null;
    }

    // Ghost line from pendingJointA to cursor (or snap target).
    if (this.pendingJointA) {
      const to = this.snapTarget ?? raw;
      this.ghostGraphics.lineStyle(2, 0xffffff, 0.4);
      this.ghostGraphics.beginPath();
      this.ghostGraphics.moveTo(this.pendingJointA.x, this.pendingJointA.y);
      this.ghostGraphics.lineTo(to.x, to.y);
      this.ghostGraphics.strokePath();
    }
  },
```

- [ ] **Step 3: Run the game and verify indicators**

```
npm run dev
```

Manual test:
- Hover over an anchor point → yellow ring appears
- Hover over a placed beam mid-span → green circle + crosshair appears
- Hover over a rock anchor → yellow ring appears
- Hover over empty space → no indicator
- With a pending joint, ghost line always tracks to snap target or cursor

- [ ] **Step 4: Commit**

```
git add src/scenes/LevelScene.js
git commit -m "feat: beam-snap green crosshair indicator in handleHover"
```

---

## Task 7: Regression check — full test suite

- [ ] **Step 1: Run all tests**

```
cd bridgeb && npx vitest run
```

Expected: all pass including `cascade.test.js`, `snapGeometry.test.js`, `leveldata.test.js`.

- [ ] **Step 2: Manual smoke test both levels**

Open L1:
- Terrain polygons visible, water correct
- Place beams, run sim, car crosses

Open DEV_STRESS:
- Rock pillar C1 visible in center
- Rock anchors joinable
- Beam splitting works
- Green indicator on beam hover, yellow on joint hover

- [ ] **Step 3: Final commit**

```
git add -A
git commit -m "chore: terrain+rocks+beam-splitting complete, all tests green"
```

---

## Self-Review Checklist

**Spec coverage:**
- [x] Terrain polygon system replacing rectangle walls — Tasks 1, 3, 4
- [x] Rock mid-span pillars with anchor points — Tasks 1, 3, 4
- [x] Beams attachable to other beams (splitting) — Tasks 2, 5
- [x] Visual indicators: yellow ring for joint, green circle+crosshair for beam snap — Task 6
- [x] Visual indicators on rock anchors (they are registered as joints → yellow ring) — Task 4

**Placeholder scan:** None found — all code blocks are complete and runnable.

**Type consistency:**
- `this.beams` entries shape: `{ a, b, material, constraint }` — used consistently across `handleClick`, `splitBeam`, `findBeamSnap` call sites, and `handleHover`
- `physics.buildBeam` now returns `constraint` — Task 5 Step 3 ensures this
- `physics.removeBeam(constraint)` takes the constraint object — matches `splitBeam` call
- `physics.buildTerrain(terrainData)` / `physics.buildRocks(rocks)` — matches leveldata schema and LevelScene calls
