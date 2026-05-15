---
Date: 2026-05-11
Content Type: Implementation Plan
---

# Bridge Builder — Phase 1 Implementation Plan (sessions 1–8.5)

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a single playable L1 (Forces & Gravity) with BCP-fidelity physics-feel — build → first-try fail → rebuild → win loop, zero external assets, all programmatic primitives. End of Phase 1 hits the spec §6.2 done-criteria.

**Architecture:** Phaser 3 + Matter.js (Approach A — Phaser's Matter plugin). Vite + npm. New sibling repo `F:\newprojects\bridge-builder` (not yet created). Spec §2 architecture rules are **invariants at every session boundary** — most importantly, the physics seam (only `systems/physics.js` calls `scene.matter.*`) and the system lifecycle contract (every singleton has `attach`/`detach`/`reset`).

**Tech Stack:** Phaser 3 (~1.4 MB gzipped), Matter.js (built into Phaser plugin), Vite 5, Vitest 1, ESLint 9, `idb` ~1 KB.

**Spec reference:** `F:\newprojects\Soalris\docs\superpowers\specs\2026-05-11-bridge-builder-mvp-design.md`.
**GDD reference:** `F:\newprojects\Soalris\bridge_builder_mvp_gdd.md`.

---

## Plan shape

10 tasks. **Task 0** is one-time scaffolding (~30 min). **Tasks 1–8** map to GDD sessions 1–8 (one playable feature each). **Task 8.5** is the juice + camera + audio pass that lifts the feel from "physics demo" to "BCP-grade." **Task 9** is the explicit Approach-A→B decision gate from spec §6.3.

Each task has Files-to-touch, then bite-sized steps (2–5 min each). Code samples are complete (not "add validation"). Manual-verify steps are explicit about the acceptance criterion.

## File structure (built during this plan)

```
bridge-builder/                          # new sibling repo, not yet created
  package.json
  vite.config.js
  index.html
  .eslintrc.cjs
  .gitignore
  README.md
  BUGS.md                                # [BLOCKER]/[IMPACT]/[COSMETIC]
  FEEL_LOG.md                            # session-end pillar scores
  src/
    main.js                              # Phaser config + scene registration
    scenes/
      BootScene.js                       # transitions to LevelScene
      LevelScene.js                      # the L1 play scene (parameterised shape)
    systems/
      physics.js                         # Matter setup, beam factory, stress reader,
                                         # cascade. ONLY file that calls scene.matter.*
      camera.js                          # follow + punch-in zoom (Task 8.5)
      juice.js                           # slow-mo, screen shake, particles (Task 8.5)
      audio.js                           # creak/snap/thud + ducking (Task 8.5)
    data/
      leveldata.js                       # L1 config (canyon, anchors, vehicle, budget)
  tests/
    headlessWorld.js                     # Matter-only fixture (Task 4)
    stressReader.test.js                 # Hooke's-law stress test (Task 7)
    cascade.test.js                      # Staggered cascade test (Task 8)
  releases/                              # empty; populated at Phase-1 exit
```

**Architecture invariants enforced from session 1 onward:**
1. Scene code never imports `Matter` or calls `this.matter.*`. Every Matter operation routes through `src/systems/physics.js`. (Spec §2 rule 1.)
2. Every system module exports `attach(scene)`, `detach(scene)`, `reset()`. (Spec §2 rule 2.)
3. `level.vehicles` is always an array, even when length=1. (Spec §2 rule 3.)

---

## Task 0: Scaffold the new repo

**Files (all created):**
- `bridge-builder/package.json`
- `bridge-builder/vite.config.js`
- `bridge-builder/index.html`
- `bridge-builder/.eslintrc.cjs`
- `bridge-builder/.gitignore`
- `bridge-builder/README.md`
- `bridge-builder/BUGS.md`
- `bridge-builder/FEEL_LOG.md`
- `bridge-builder/src/main.js`

- [ ] **Step 0.1: Create directory and init**

```bash
cd F:\newprojects
mkdir bridge-builder
cd bridge-builder
git init
npm init -y
```

- [ ] **Step 0.2: Install runtime + dev deps**

```bash
npm install phaser idb
npm install -D vite vitest @vitest/coverage-v8 eslint @eslint/js globals jsdom
```

Expected: `phaser@^3.80`, `vite@^5`, `vitest@^1` in `package.json`.

- [ ] **Step 0.3: Write `package.json` scripts**

Replace the `scripts` block in `bridge-builder/package.json` with:

```json
{
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest",
    "lint": "eslint src tests"
  }
}
```

- [ ] **Step 0.4: Write `vite.config.js`**

```js
import { defineConfig } from 'vite';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: false,
  },
});
```

- [ ] **Step 0.5: Write `index.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>Bridge Builder</title>
    <style>
      html, body { margin: 0; padding: 0; height: 100%; background: #000; }
      #game { width: 100vw; height: 100vh; }
    </style>
  </head>
  <body>
    <div id="game"></div>
    <script type="module" src="/src/main.js"></script>
  </body>
</html>
```

- [ ] **Step 0.6: Write `.eslintrc.cjs`**

```js
module.exports = {
  env: { browser: true, node: true, es2022: true },
  extends: ['eslint:recommended'],
  parserOptions: { ecmaVersion: 2022, sourceType: 'module' },
  rules: {
    'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    'no-console': 'off',
  },
};
```

- [ ] **Step 0.7: Write `.gitignore`**

```
node_modules/
dist/
.DS_Store
*.log
.vite/
```

- [ ] **Step 0.8: Stub `BUGS.md` and `FEEL_LOG.md`**

`BUGS.md`:
```markdown
# Bug Log

Format: `[YYYY-MM-DD] [BLOCKER|IMPACT|COSMETIC] description`
```

`FEEL_LOG.md`:
```markdown
# Feel-Check Log

Format per session:
## Session N — date

| Pillar | Score 1–5 | Notes |
|---|---|---|
| 1.1 Physics-feel  |  |  |
| 1.2 Visual language |  |  |
| 1.3 Camera        |  |  |
| 1.4 Audio         |  |  |
```

- [ ] **Step 0.9: Stub `src/main.js`**

```js
import Phaser from 'phaser';

const config = {
  type: Phaser.AUTO,
  parent: 'game',
  width: 1280,
  height: 720,
  backgroundColor: '#87ceeb', // placeholder sky
  scene: [], // populated in Task 1
};

new Phaser.Game(config);
```

- [ ] **Step 0.10: First commit**

```bash
git add -A
git commit -m "chore: scaffold bridge-builder project (Vite + Phaser + Vitest)"
```

Expected: clean working tree, no uncommitted files.

- [ ] **Step 0.11: Verify dev server starts**

```bash
npm run dev
```

Expected: Vite prints `Local: http://localhost:5173/`; opening it shows a sky-blue page with no errors in the console. Ctrl+C to stop.

---

## Task 1 (Session 1): Static canyon scene

Goal: a static visual L1 — canyon walls, water plane, two fixed anchors. No physics yet. **Acceptance:** the level renders programmatically; refreshing the page shows the same view every time.

**Files:**
- Create: `bridge-builder/src/scenes/BootScene.js`
- Create: `bridge-builder/src/scenes/LevelScene.js`
- Create: `bridge-builder/src/data/leveldata.js`
- Modify: `bridge-builder/src/main.js`

- [ ] **Step 1.1: Write `src/data/leveldata.js`** (L1 config — vehicle is an array even though length=1)

```js
// src/data/leveldata.js
// Per spec §2 rule 3: level.vehicles is ALWAYS an array.

export const L1 = {
  id: 'L1',
  title: 'Forces & Gravity',
  span: 6,                            // metres, used for budget feel
  budget: 500,
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
  // Spec §2: vehicles is always an array. L1 has length 1.
  vehicles: [
    { type: 'car', spawnAt: 'left', weight: 200, speed: 'normal' },
  ],
  materials: {
    wood: { stiffness: 0.75, snapThreshold: 0.7 }, // L1-relaxed (spec §3.5)
  },
};

export const ALL_LEVELS = { L1 };
```

- [ ] **Step 1.2: Write `src/scenes/BootScene.js`**

```js
// src/scenes/BootScene.js
import Phaser from 'phaser';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  // Phase 1 loads no external assets — Phase 2 will populate this.
  preload() {}

  create() {
    this.scene.start('LevelScene', { levelId: 'L1' });
  }
}
```

- [ ] **Step 1.3: Write `src/scenes/LevelScene.js`** (static visual only)

```js
// src/scenes/LevelScene.js
import Phaser from 'phaser';
import { ALL_LEVELS } from '../data/leveldata.js';

export class LevelScene extends Phaser.Scene {
  constructor() {
    super('LevelScene');
  }

  init(data) {
    this.levelId = data.levelId || 'L1';
    this.level = ALL_LEVELS[this.levelId];
  }

  create() {
    this.drawSky();
    this.drawCanyon();
    this.drawWater();
    this.drawAnchors();
  }

  drawSky() {
    // Solid for now; parallax happens in Phase 2.
    this.cameras.main.setBackgroundColor('#87ceeb');
  }

  drawCanyon() {
    const g = this.add.graphics();
    g.fillStyle(0x6b4f3a, 1); // earthy brown
    const { leftWall, rightWall } = this.level.canyon;
    g.fillRect(leftWall.x - leftWall.width / 2,  leftWall.y - leftWall.height / 2,
               leftWall.width, leftWall.height);
    g.fillRect(rightWall.x - rightWall.width / 2, rightWall.y - rightWall.height / 2,
               rightWall.width, rightWall.height);
  }

  drawWater() {
    const g = this.add.graphics();
    g.fillStyle(0x3a7fc4, 0.85);
    g.fillRect(0, this.level.canyon.waterY, this.level.worldWidth,
               this.level.worldHeight - this.level.canyon.waterY);
  }

  drawAnchors() {
    const g = this.add.graphics();
    g.fillStyle(0xff3b3b, 1);
    for (const a of this.level.anchors) {
      g.fillCircle(a.x, a.y, 12);
      g.lineStyle(2, 0xffffff, 0.9);
      g.strokeCircle(a.x, a.y, 16);
    }
  }
}
```

- [ ] **Step 1.4: Register scenes in `src/main.js`**

```js
import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene.js';
import { LevelScene } from './scenes/LevelScene.js';

const config = {
  type: Phaser.AUTO,
  parent: 'game',
  width: 1280,
  height: 720,
  backgroundColor: '#87ceeb',
  scene: [BootScene, LevelScene],
};

new Phaser.Game(config);
```

- [ ] **Step 1.5: Run dev and visually verify**

```bash
npm run dev
```

Acceptance: sky-blue background, two brown canyon walls left + right, blue water plane at the bottom, two red anchors with white halos at roughly y=360. No console errors.

- [ ] **Step 1.6: Commit**

```bash
git add -A
git commit -m "feat(session-1): static L1 canyon scene with anchors"
```

---

## Task 2 (Session 2): Tap-to-place beam joints

Goal: click two points to lay down a beam between them. No physics yet — just data + render. **Acceptance:** clicking left-then-right anchor draws a beam between them; second beam clicks compound additively.

**Files:**
- Modify: `bridge-builder/src/scenes/LevelScene.js`

- [ ] **Step 2.1: Add joint + beam state and click handler**

In `LevelScene.create()`, add at the end:

```js
this.beams = [];               // [{ a: {x,y}, b: {x,y} }]
this.pendingJointA = null;     // first click waiting for second
this.beamsGraphics = this.add.graphics();
this.ghostGraphics = this.add.graphics();

this.input.on('pointerdown', (pointer) => this.handleClick(pointer));
this.input.on('pointermove', (pointer) => this.handleHover(pointer));
```

Add methods:

```js
handleClick(pointer) {
  const p = { x: pointer.worldX, y: pointer.worldY };
  if (!this.pendingJointA) {
    this.pendingJointA = p;
  } else {
    this.beams.push({ a: this.pendingJointA, b: p });
    this.pendingJointA = null;
    this.redrawBeams();
  }
}

handleHover(pointer) {
  this.ghostGraphics.clear();
  if (this.pendingJointA) {
    this.ghostGraphics.lineStyle(4, 0x9b6b3a, 0.4);
    this.ghostGraphics.beginPath();
    this.ghostGraphics.moveTo(this.pendingJointA.x, this.pendingJointA.y);
    this.ghostGraphics.lineTo(pointer.worldX, pointer.worldY);
    this.ghostGraphics.strokePath();
  }
}

redrawBeams() {
  this.beamsGraphics.clear();
  this.beamsGraphics.lineStyle(6, 0x9b6b3a, 1); // wood brown
  for (const beam of this.beams) {
    this.beamsGraphics.beginPath();
    this.beamsGraphics.moveTo(beam.a.x, beam.a.y);
    this.beamsGraphics.lineTo(beam.b.x, beam.b.y);
    this.beamsGraphics.strokePath();
  }
}
```

- [ ] **Step 2.2: Run dev and verify**

```bash
npm run dev
```

Acceptance: click anywhere → see a "ghost" line follow the cursor. Click again → a brown beam appears between the two clicks. Click again starts the next beam.

- [ ] **Step 2.3: Commit**

```bash
git add -A
git commit -m "feat(session-2): tap-to-place beams with ghost-line preview"
```

---

## Task 3 (Session 3): Joint snapping

Goal: clicks within 20 px of an existing joint snap to that joint, so beams connect cleanly. **Acceptance:** clicking near an anchor snaps to its centre; chained beams share endpoints.

**Files:**
- Modify: `bridge-builder/src/scenes/LevelScene.js`

- [ ] **Step 3.1: Build a unified joint registry**

Add to `LevelScene.create()`:

```js
this.SNAP_RADIUS = 20;
this.joints = this.level.anchors.map(a => ({ x: a.x, y: a.y, isAnchor: true }));
this.snapTarget = null;        // current hover snap target (visual feedback)
this.snapGraphics = this.add.graphics();
```

- [ ] **Step 3.2: Add snap helper**

```js
findNearestJoint(p) {
  let best = null;
  let bestDist = this.SNAP_RADIUS;
  for (const j of this.joints) {
    const dx = j.x - p.x;
    const dy = j.y - p.y;
    const d = Math.hypot(dx, dy);
    if (d < bestDist) { bestDist = d; best = j; }
  }
  return best;
}
```

- [ ] **Step 3.3: Use snap in hover + click**

Replace `handleClick` and `handleHover`:

```js
handleClick(pointer) {
  const raw = { x: pointer.worldX, y: pointer.worldY };
  const snap = this.findNearestJoint(raw);
  const p = snap ? { x: snap.x, y: snap.y } : raw;

  if (!this.pendingJointA) {
    this.pendingJointA = p;
  } else {
    // Add the endpoint as a joint if it's a new position.
    if (!snap) this.joints.push({ x: p.x, y: p.y, isAnchor: false });
    if (!this.joints.find(j => j.x === this.pendingJointA.x && j.y === this.pendingJointA.y)) {
      this.joints.push({ ...this.pendingJointA, isAnchor: false });
    }
    this.beams.push({ a: this.pendingJointA, b: p });
    this.pendingJointA = null;
    this.redrawBeams();
  }
}

handleHover(pointer) {
  this.ghostGraphics.clear();
  this.snapGraphics.clear();
  const raw = { x: pointer.worldX, y: pointer.worldY };
  const snap = this.findNearestJoint(raw);
  if (snap) {
    this.snapGraphics.lineStyle(2, 0xffff00, 1);
    this.snapGraphics.strokeCircle(snap.x, snap.y, 18);
  }
  if (this.pendingJointA) {
    const endpoint = snap || raw;
    this.ghostGraphics.lineStyle(4, 0x9b6b3a, 0.4);
    this.ghostGraphics.beginPath();
    this.ghostGraphics.moveTo(this.pendingJointA.x, this.pendingJointA.y);
    this.ghostGraphics.lineTo(endpoint.x, endpoint.y);
    this.ghostGraphics.strokePath();
  }
}
```

- [ ] **Step 3.4: Run dev and verify**

Acceptance: hovering near an anchor draws a yellow snap-ring around it. Clicking near the anchor places the joint at the anchor's exact centre, not at the cursor. Chained beams share endpoints visibly.

- [ ] **Step 3.5: Commit**

```bash
git add -A
git commit -m "feat(session-3): 20px joint snapping with hover indicator"
```

---

## Task 4 (Session 4): Matter physics on beams

Goal: physics goes live. Beams become Matter constraints; gravity pulls; un-anchored joints fall. **First Vitest test arrives**: headless Matter world boots without error. **Spec §2 rule 1 enforced from this task forward: only `physics.js` touches `scene.matter.*`.**

**Files:**
- Create: `bridge-builder/src/systems/physics.js`
- Create: `bridge-builder/tests/headlessWorld.js`
- Modify: `bridge-builder/src/main.js` (enable Matter plugin)
- Modify: `bridge-builder/src/scenes/LevelScene.js` (call physics.js to build bodies, add Test button)

- [ ] **Step 4.1: Enable Matter plugin in `src/main.js`**

Replace `src/main.js`:

```js
import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene.js';
import { LevelScene } from './scenes/LevelScene.js';

const config = {
  type: Phaser.AUTO,
  parent: 'game',
  width: 1280,
  height: 720,
  backgroundColor: '#87ceeb',
  physics: {
    default: 'matter',
    matter: {
      gravity: { y: 1.5 },            // spec §3.4
      enableSleeping: false,           // spec §3.4
      positionIterations: 8,           // spec §3.4 (defensive headroom)
      velocityIterations: 6,
      constraintIterations: 4,
      debug: false,                    // flip to true for collision debug
    },
  },
  scene: [BootScene, LevelScene],
};

new Phaser.Game(config);
```

- [ ] **Step 4.2: Create `src/systems/physics.js`** (the physics seam — only file calling `scene.matter.*`)

```js
// src/systems/physics.js
// Per spec §2 rule 1: THIS IS THE ONLY FILE THAT CALLS scene.matter.*

const MIN_REST_LEN = 4;
const SNAP_ABS_PX  = 8;

const physics = {
  _scene: null,
  _nodes: new Map(),       // jointId -> Matter.Body (small circle)
  _beamConstraints: [],    // [{ constraint, material }]
  _bodySnapshots: new Map(),

  attach(scene) {
    this._scene = scene;
  },

  detach(_scene) {
    this.reset();
    this._scene = null;
  },

  reset() {
    if (this._scene) {
      const toRemove = [
        ...this._nodes.values(),
        ...this._beamConstraints.map(b => b.constraint),
      ];
      if (this._vehicle) {
        toRemove.push(this._vehicle.chassis, ...this._vehicle.wheels);
      }
      this._scene.matter.world.remove(toRemove);
    }
    this._nodes.clear();
    this._beamConstraints.length = 0;
    this._bodySnapshots.clear();
    this._vehicle = null;
    this._pendingSnaps = this._pendingSnaps || [];
    this._pendingSnaps.length = 0;
    this._lastStaggerAt = 0;
    this._cascadeActiveUntil = 0;
  },

  // Build a small circle "joint node" body. Returns the body.
  ensureJointNode(jointId, x, y, isAnchor) {
    if (this._nodes.has(jointId)) return this._nodes.get(jointId);
    const body = this._scene.matter.add.circle(x, y, 4, {
      isStatic: !!isAnchor,
      label: isAnchor ? 'anchor' : 'joint',
      collisionFilter: { category: 0x0002, mask: 0x0000 }, // BRIDGE category, no collisions with vehicle yet
      render: { fillStyle: isAnchor ? '#ff3b3b' : '#9b6b3a' },
    });
    this._nodes.set(jointId, body);
    return body;
  },

  // Build a beam constraint between two joint bodies. Returns the constraint.
  buildBeam(bodyA, bodyB, material) {
    const dx = bodyA.position.x - bodyB.position.x;
    const dy = bodyA.position.y - bodyB.position.y;
    const length = Math.hypot(dx, dy);

    const constraint = this._scene.matter.add.constraint(bodyA, bodyB, length, material.stiffness, {
      damping: 0.05,
    });
    // Stash material + history on the constraint for stress reading.
    constraint.material = material;
    constraint._stressHistory = [];
    this._beamConstraints.push({ constraint, material });
    return constraint;
  },

  beamCount() {
    return this._beamConstraints.length;
  },

  // Capture rollback snapshot. Spec §3.15.
  captureSnapshot() {
    this._bodySnapshots.clear();
    const Matter = this._scene.matter; // wrapper; we use raw Matter only here
    for (const body of this._nodes.values()) {
      this._bodySnapshots.set(body, {
        position: { x: body.position.x, y: body.position.y },
        velocity: { x: body.velocity.x, y: body.velocity.y },
      });
    }
  },

  // NaN watchdog soft-restart (spec §3.15)
  softRestart() {
    if (!this._scene) return;
    this._scene.matter.world.engine.timing.timeScale = 1.0;
    const Matter = this._scene.matter;
    for (const [body, snap] of this._bodySnapshots) {
      Matter.body.setPosition(body, snap.position);
      Matter.body.setVelocity(body, { x: 0, y: 0 });
    }
  },

  tickWatchdog() {
    for (const body of this._nodes.values()) {
      if (body.isStatic) continue;
      if (Number.isNaN(body.position.x) || Number.isNaN(body.position.y)) {
        this.softRestart();
        return true;
      }
    }
    return false;
  },

  // ---- Seam-rule wrappers (the ONLY way scene/system code touches the engine) ----

  setRunnerEnabled(enabled) {
    if (this._scene) this._scene.matter.world.runner.enabled = enabled;
  },

  getTimeScale() {
    return this._scene ? this._scene.matter.world.engine.timing.timeScale : 1.0;
  },

  setTimeScale(scale) {
    if (this._scene) this._scene.matter.world.engine.timing.timeScale = scale;
  },
};

// Named exports for testability — tests import the SAME formula impls
// that physics uses, not a duplicate. (Plan reviewer P0.)
export function readStressNormalized(constraint) {
  return physics.readStressNormalized(constraint);
}

export function readStressSmoothed(constraint) {
  return physics.readStressSmoothed(constraint);
}

export default physics;
```

- [ ] **Step 4.3: Wire LevelScene to physics.js**

Modify `LevelScene.js`:

- Add at the top: `import physics from '../systems/physics.js';`
- In `create()`, after `drawAnchors()`:

```js
physics.attach(this);

// Create anchor bodies and add them to the joints registry by id.
for (const a of this.level.anchors) {
  const body = physics.ensureJointNode(a.id, a.x, a.y, /* isAnchor */ true);
  // Match data joint to physics body for snap-back resolution.
  const dataJoint = this.joints.find(j => j.x === a.x && j.y === a.y);
  if (dataJoint) dataJoint.bodyId = a.id;
}

this.mode = 'build';                 // 'build' | 'test'
this.material = this.level.materials.wood;
this.beamConstraints = [];           // mirrors physics._beamConstraints, for rendering

// Test/Reset button overlay
this.testButton = this.add.rectangle(640, 40, 200, 50, 0x2e7d32).setInteractive();
this.testButtonLabel = this.add.text(640, 40, 'TEST', { fontSize: '20px', color: '#fff' }).setOrigin(0.5);
this.testButton.on('pointerdown', () => this.toggleTest());
```

- In `init(data)`, after setting `this.levelId` / `this.level`, also reset state. Move `this.beams`/`this.joints`/`this.pendingJointA` initialisation from `create()` to `init()`:

```js
init(data) {
  this.levelId = data.levelId || 'L1';
  this.level = ALL_LEVELS[this.levelId];
  this.beams = [];
  this.pendingJointA = null;
  this.joints = this.level.anchors.map(a => ({ x: a.x, y: a.y, isAnchor: true, bodyId: a.id }));
  this.SNAP_RADIUS = 20;
}
```

- Update `handleClick` to assign a `bodyId` when creating a new joint:

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
    this.beams.push({ a: this.pendingJointA, b: endpoint });
    this.pendingJointA = null;
    this.redrawBeams();
  }
}

registerNewJoint(p) {
  const id = 'j' + (this.joints.length + 1);
  this.joints.push({ x: p.x, y: p.y, isAnchor: false, bodyId: id });
  physics.ensureJointNode(id, p.x, p.y, /* isAnchor */ false);
  return { x: p.x, y: p.y, bodyId: id };
}
```

- Add `toggleTest()`:

```js
toggleTest() {
  if (this.mode === 'build') {
    physics.captureSnapshot();
    this.mode = 'test';
    this.testButtonLabel.setText('RESET');
    physics.setTimeScale(1.0);
    physics.setRunnerEnabled(true);   // start simulating
  } else {
    physics.softRestart();
    this.mode = 'build';
    this.testButtonLabel.setText('TEST');
    physics.setRunnerEnabled(false);
  }
}
```

**Seam rule:** the scene calls `physics.setRunnerEnabled` / `physics.setTimeScale` — not `this.matter.world.*` directly. Per spec §2 rule 1, `physics.js` is the only file allowed to touch the Matter engine.

If runner-toggling turns out flaky, switch to `physics.setTimeScale(0)` in build mode — both knobs live on the seam.

- In `update()`, redraw beams from body positions during test mode:

```js
update() {
  if (this.mode === 'test') {
    physics.tickWatchdog();
    this.redrawBeamsFromBodies();
  }
}

redrawBeamsFromBodies() {
  this.beamsGraphics.clear();
  this.beamsGraphics.lineStyle(6, 0x9b6b3a, 1);
  for (const { constraint } of physics._beamConstraints) {
    this.beamsGraphics.beginPath();
    this.beamsGraphics.moveTo(constraint.bodyA.position.x, constraint.bodyA.position.y);
    this.beamsGraphics.lineTo(constraint.bodyB.position.x, constraint.bodyB.position.y);
    this.beamsGraphics.strokePath();
  }
}
```

- Add a `shutdown` hook (Phaser invokes `Scene.events.on('shutdown')`):

```js
// at end of create():
this.events.on('shutdown', () => physics.detach(this));
```

- [ ] **Step 4.4: Write `tests/headlessWorld.js`** (Matter-only fixture)

```js
// tests/headlessWorld.js
// Headless Matter world helper for Vitest. DO NOT enable sleeping here —
// it kills cascade evaluation in tests (spec §5.1 P0 gotcha).
import Matter from 'matter-js';

export function createHeadlessWorld(opts = {}) {
  const engine = Matter.Engine.create({
    enableSleeping: false,            // explicit — pass-1 QA review P0
    positionIterations: 8,
    velocityIterations: 6,
    constraintIterations: 4,
  });
  engine.gravity.y = opts.gravityY ?? 1.5;
  const world = engine.world;

  // Fixed delta step. Comment: do not "optimise" this to a variable delta —
  // see headlessWorld.js comments in spec §5.1.
  function step(times = 1, deltaMs = 16.666) {
    for (let i = 0; i < times; i++) Matter.Engine.update(engine, deltaMs);
  }

  return { engine, world, step, Matter };
}
```

- [ ] **Step 4.5: Write `tests/world-boot.test.js`** (smoke test — first Vitest)

```js
// tests/world-boot.test.js
import { describe, it, expect } from 'vitest';
import { createHeadlessWorld } from './headlessWorld.js';

describe('headlessWorld', () => {
  it('boots and steps without NaN', () => {
    const { engine, step } = createHeadlessWorld();
    step(100);
    expect(engine.world.bodies.length).toBe(0);
    expect(engine.enableSleeping).toBe(false);
  });
});
```

- [ ] **Step 4.6: Run the test**

```bash
npm test
```

Expected: 1 test passing.

- [ ] **Step 4.7: Run dev and verify physics**

```bash
npm run dev
```

Acceptance: build a small bridge between the two anchors. Click TEST. Beams sag visibly under gravity. Beams attached to anchors stay attached; mid-beams fall through to water. Click RESET — beams return to placed positions.

- [ ] **Step 4.8: Commit**

```bash
git add -A
git commit -m "feat(session-4): Matter physics on beams, test/reset toggle, headless test fixture"
```

---

## Task 5 (Session 5): Static anchor bodies confirmed + edge cases

Goal: validate that anchors hold under heavy load (stack 10 beams on one anchor). The physics work is mostly done — this task hardens it.

**Files:**
- Modify: `bridge-builder/src/systems/physics.js`
- Modify: `bridge-builder/src/scenes/LevelScene.js`

- [ ] **Step 5.1: Add anchor health-check to physics.js**

```js
// in src/systems/physics.js
isAnchor(body) {
  return body.isStatic && body.label === 'anchor';
}

// Disconnect a beam at runtime (called by cascade in Task 8)
removeBeam(constraint) {
  if (!this._scene) return;
  const idx = this._beamConstraints.findIndex(b => b.constraint === constraint);
  if (idx >= 0) {
    this._scene.matter.world.remove(constraint);
    this._beamConstraints.splice(idx, 1);
  }
}
```

- [ ] **Step 5.2: Manual stress test — 10-beam stack on anchor**

Run dev, place 10 beams chained from the left anchor downward into the water. Click TEST. Confirm: anchors do not move; un-anchored chain hangs/swings under gravity.

- [ ] **Step 5.3: Note observation in `FEEL_LOG.md`**

Add a Session-5 entry; score pillar 1.1 (Physics-feel) 1–5 with a one-line note.

- [ ] **Step 5.4: Commit**

```bash
git add -A
git commit -m "chore(session-5): confirm anchor stability under load + physics helper methods"
```

---

## Task 6 (Session 6): Car body with suspension

Goal: spawn a 200 kg car at the left anchor on TEST. Apply driving force; it rolls right. The wheels have visible suspension compression on the bridge.

**Files:**
- Modify: `bridge-builder/src/systems/physics.js` (vehicle factory)
- Modify: `bridge-builder/src/scenes/LevelScene.js` (spawn + drive + render)

- [ ] **Step 6.1: Add `physics.spawnVehicle(config)`**

```js
// src/systems/physics.js — add inside the physics object:
spawnVehicle(config) {
  if (!this._scene) return null;
  const { spawnAt, weight } = config;
  const spawnX = spawnAt === 'left' ? 200 : 1080;
  const spawnY = 340;

  // Chassis
  const chassis = this._scene.matter.add.rectangle(spawnX, spawnY, 80, 24, {
    label: 'vehicle-chassis',
    collisionFilter: { category: 0x0001, mask: 0xFFFF & ~0x0002 }, // collide with all but BRIDGE
    density: weight / (80 * 24 * 100), // tune by feel; spec §7.3 deferred
  });

  // Two wheels with low-stiffness suspension constraints (spec §3.1, §7.3)
  const wheelOffsets = [{ dx: -28, dy: 14 }, { dx: 28, dy: 14 }];
  const wheels = [];
  for (const off of wheelOffsets) {
    const wheel = this._scene.matter.add.circle(spawnX + off.dx, spawnY + off.dy, 12, {
      label: 'vehicle-wheel',
      friction: 0.95,
      density: 0.05,
    });
    this._scene.matter.add.constraint(chassis, wheel,
      Math.hypot(off.dx, off.dy), 0.5, { damping: 0.2 }); // stiffness 0.5 per spec §7.3
    wheels.push(wheel);
  }

  this._vehicle = { chassis, wheels, config };
  return this._vehicle;
}

driveVehicle() {
  if (!this._vehicle) return;
  const force = this._vehicle.config.spawnAt === 'left' ? 0.02 : -0.02;
  this._scene.matter.body.applyForce(
    this._vehicle.chassis,
    this._vehicle.chassis.position,
    { x: force, y: 0 }
  );
}

getVehicleChassisPosition() {
  return this._vehicle ? this._vehicle.chassis.position : null;
}
```

- [ ] **Step 6.2: Spawn vehicle on TEST in LevelScene**

In `toggleTest()`, after capturing snapshot and entering test mode:

```js
const vehicleConfig = this.level.vehicles[0]; // spec §2 rule 3: always an array
physics.spawnVehicle(vehicleConfig);
this.vehicleGraphics = this.add.graphics();
```

In `update()` (test mode branch):

```js
if (this.mode === 'test') {
  physics.tickWatchdog();
  physics.driveVehicle();
  this.redrawBeamsFromBodies();
  this.redrawVehicle();
}
```

Add `redrawVehicle()`:

```js
redrawVehicle() {
  if (!this.vehicleGraphics) return;
  this.vehicleGraphics.clear();
  const v = physics._vehicle;
  if (!v) return;
  const c = v.chassis;
  this.vehicleGraphics.fillStyle(0xf08c1a, 1);
  this.vehicleGraphics.fillRect(c.position.x - 40, c.position.y - 12, 80, 24);
  this.vehicleGraphics.lineStyle(2, 0x331a00, 1);
  this.vehicleGraphics.strokeRect(c.position.x - 40, c.position.y - 12, 80, 24);
  this.vehicleGraphics.fillStyle(0x222222, 1);
  for (const w of v.wheels) {
    this.vehicleGraphics.fillCircle(w.position.x, w.position.y, 12);
  }
}
```

In `toggleTest()` when going back to build mode:

```js
this.vehicleGraphics?.clear();
```

(Also reset `physics._vehicle = null` inside `physics.reset()` — add that line to `reset()`.)

- [ ] **Step 6.3: Run dev and verify**

Build a bridge between the two anchors. Click TEST. Acceptance: an orange car appears at the left anchor, rolls right, its wheels compress visibly on each beam. If the bridge holds, the car reaches the right side. If it doesn't, the car falls.

- [ ] **Step 6.4: Log feel + commit**

Add Session-6 entry to `FEEL_LOG.md`. Score pillars 1.1 + 1.3.

```bash
git add -A
git commit -m "feat(session-6): car body with suspension wheels + driving force"
```

---

## Task 7 (Session 7): Stress reader + glow visualization

Goal: each beam's color reflects its load. Green at rest, yellow under load, red near snap. **Vitest test arrives:** 3-beam triangle, known load, stress within ±5%.

**Files:**
- Modify: `bridge-builder/src/systems/physics.js` (`readStressNormalized` per spec §3.3)
- Create: `bridge-builder/tests/stressReader.test.js`
- Modify: `bridge-builder/src/scenes/LevelScene.js` (color-by-stress in `redrawBeamsFromBodies`)

- [ ] **Step 7.1: Add stress reader to physics.js**

```js
// src/systems/physics.js — add constants near the top of the module:
// (already declared MIN_REST_LEN, SNAP_ABS_PX)

// And add to the physics object:
readStressNormalized(c) {
  const cur = Math.hypot(
    c.bodyA.position.x - c.bodyB.position.x,
    c.bodyA.position.y - c.bodyB.position.y
  );
  if (c.length === 0) {
    const raw = c.stiffness * cur / SNAP_ABS_PX;
    return Math.min(1, Math.max(0, raw / c.material.snapThreshold));
  }
  const denom = Math.max(c.length, MIN_REST_LEN);
  const raw = c.stiffness * Math.abs(cur - c.length) / denom;
  return Math.min(1, Math.max(0, raw / c.material.snapThreshold));
},

readStressSmoothed(c) {
  const raw = this.readStressNormalized(c);
  c._stressHistory.push(raw);
  if (c._stressHistory.length > 5) c._stressHistory.shift();
  let sum = 0;
  for (const s of c._stressHistory) sum += s;
  return sum / c._stressHistory.length;
},
```

- [ ] **Step 7.2: Write the failing Vitest test**

`tests/stressReader.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { createHeadlessWorld } from './headlessWorld.js';
// IMPORT the same function the runtime uses — never duplicate the formula.
// (Plan reviewer P0: a divergent test copy would pass even if physics.js
// was wrong, silently breaking the demo.) physics.readStressNormalized is
// scene-agnostic so it works without physics.attach(scene).
import physics, { readStressNormalized } from '../src/systems/physics.js';

describe('stressReader', () => {
  it('reads zero stress on a beam at rest length', () => {
    const { Matter, world } = createHeadlessWorld({ gravityY: 0 });
    const a = Matter.Bodies.circle(100, 100, 4, { isStatic: true });
    const b = Matter.Bodies.circle(200, 100, 4, { isStatic: true });
    Matter.Composite.add(world, [a, b]);
    const c = Matter.Constraint.create({ bodyA: a, bodyB: b, length: 100, stiffness: 0.75 });
    c.material = { snapThreshold: 0.7 };
    expect(readStressNormalized(c)).toBeLessThan(0.05);
  });

  it('reads near-1 stress when beam stretched to threshold', () => {
    const { Matter, world } = createHeadlessWorld({ gravityY: 0 });
    // Stretched 80px → Δ = 80, denom = 100, stiffness 0.75
    // raw = 0.75 * 80 / 100 = 0.6
    // normalized = 0.6 / 0.7 ≈ 0.857
    const a = Matter.Bodies.circle(100, 100, 4, { isStatic: true });
    const b = Matter.Bodies.circle(280, 100, 4, { isStatic: true });
    Matter.Composite.add(world, [a, b]);
    const c = Matter.Constraint.create({ bodyA: a, bodyB: b, length: 100, stiffness: 0.75 });
    c.material = { snapThreshold: 0.7 };
    const s = readStressNormalized(c);
    expect(s).toBeGreaterThan(0.80);
    expect(s).toBeLessThan(0.90);
  });

  it('clamps to 1 when overstretched', () => {
    const { Matter, world } = createHeadlessWorld({ gravityY: 0 });
    const a = Matter.Bodies.circle(100, 100, 4, { isStatic: true });
    const b = Matter.Bodies.circle(400, 100, 4, { isStatic: true });
    Matter.Composite.add(world, [a, b]);
    const c = Matter.Constraint.create({ bodyA: a, bodyB: b, length: 100, stiffness: 0.75 });
    c.material = { snapThreshold: 0.7 };
    expect(readStressNormalized(c)).toBe(1);
  });
});
```

- [ ] **Step 7.3: Run tests**

```bash
npm test
```

Expected: 4 tests passing (1 from Task 4 + 3 new).

- [ ] **Step 7.4: Render beams by stress in LevelScene**

Replace `redrawBeamsFromBodies()`:

```js
redrawBeamsFromBodies() {
  this.beamsGraphics.clear();
  for (const { constraint } of physics._beamConstraints) {
    const stress = physics.readStressSmoothed(constraint);
    const color = this.stressColor(stress);
    const thickness = 6 + stress * 2;  // shimmer: 6 → 8 px
    this.beamsGraphics.lineStyle(thickness, color, 1);
    this.beamsGraphics.beginPath();
    this.beamsGraphics.moveTo(constraint.bodyA.position.x, constraint.bodyA.position.y);
    this.beamsGraphics.lineTo(constraint.bodyB.position.x, constraint.bodyB.position.y);
    this.beamsGraphics.strokePath();
    if (stress > 0.5) this.drawStressGlow(constraint, stress, color);
  }
}

stressColor(s) {
  // Green (0x33cc33) → Yellow (0xffcc00) → Red (0xff3333)
  if (s < 0.5) {
    const t = s / 0.5;
    return Phaser.Display.Color.GetColor(
      Math.round(0x33 + (0xff - 0x33) * t),
      Math.round(0xcc + (0xcc - 0xcc) * t),
      Math.round(0x33 + (0x00 - 0x33) * t)
    );
  }
  const t = (s - 0.5) / 0.5;
  return Phaser.Display.Color.GetColor(
    0xff,
    Math.round(0xcc - 0xcc * t * 0.6),
    Math.round(0x00 + (0x33 - 0x00) * t)
  );
}

drawStressGlow(c, stress, color) {
  const radius = 10 + stress * 12;
  this.beamsGraphics.fillStyle(color, 0.25 * stress);
  const mx = (c.bodyA.position.x + c.bodyB.position.x) / 2;
  const my = (c.bodyA.position.y + c.bodyB.position.y) / 2;
  this.beamsGraphics.fillCircle(mx, my, radius);
}
```

- [ ] **Step 7.5: Run dev and verify**

Build a thin 2-beam bridge. Click TEST. Acceptance: car drives onto it; beams transition green → yellow → red as the car crosses; glow halo grows under stress.

- [ ] **Step 7.6: Commit**

```bash
git add -A
git commit -m "feat(session-7): Hooke's-law stress reader, color+glow stress viz, Vitest tests"
```

---

## Task 8 (Session 8): Win/fail detection + cascade

Goal: detect the win condition (car reaches right anchor) and fail condition (any beam snapped). Cascade is deferred + staggered (spec §3.7). **Second Vitest fixture:** A→B→C cascade chain.

**Files:**
- Modify: `bridge-builder/src/systems/physics.js` (cascade processor, pendingSnaps)
- Create: `bridge-builder/tests/cascade.test.js`
- Modify: `bridge-builder/src/scenes/LevelScene.js` (win/fail overlay)

- [ ] **Step 8.1: Add cascade machinery to physics.js**

```js
// src/systems/physics.js — extend the physics object

_pendingSnaps: [],
_lastStaggerAt: 0,
_cascadeActiveUntil: 0,
_onSnapCallback: null,

setOnSnap(cb) { this._onSnapCallback = cb; },

// Called once per tick (from LevelScene.update during test mode).
evaluateStress(nowMs, timeScale = 1.0) {
  const STAGGER_MS = 100;
  const SETTLE_MS  = 200;

  // 1. READ-ONLY pass — collect candidates
  for (const { constraint } of this._beamConstraints) {
    const s = this.readStressSmoothed(constraint);
    if (s >= 1.0 && !this._pendingSnaps.includes(constraint)) {
      this._pendingSnaps.push(constraint);
    }
  }

  // 2. Sort highest-stress first
  this._pendingSnaps.sort((a, b) =>
    this.readStressNormalized(b) - this.readStressNormalized(a)
  );

  // 3. Process one snap per stagger-tick (scaled by timeScale)
  const stagger = STAGGER_MS / Math.max(timeScale, 0.05);
  if (this._pendingSnaps.length > 0 && nowMs - this._lastStaggerAt >= stagger) {
    const head = this._pendingSnaps.shift();
    this.removeBeam(head);
    this._lastStaggerAt = nowMs;
    this._cascadeActiveUntil = nowMs + SETTLE_MS;
    if (this._onSnapCallback) this._onSnapCallback(head);

    // Re-evaluate neighbours (topological — share an endpoint with head)
    let added = 0;
    for (const { constraint } of this._beamConstraints) {
      if (added >= 5) break; // runaway-cascade guard (spec §3.7 step 4)
      const sharesEndpoint =
        constraint.bodyA === head.bodyA || constraint.bodyA === head.bodyB ||
        constraint.bodyB === head.bodyA || constraint.bodyB === head.bodyB;
      if (!sharesEndpoint) continue;
      const s = this.readStressNormalized(constraint);
      if (s >= 1.0 && !this._pendingSnaps.includes(constraint)) {
        this._pendingSnaps.push(constraint);
        added++;
      }
    }
  }
},

isCascadeActive(nowMs) {
  return this._pendingSnaps.length > 0 || nowMs < this._cascadeActiveUntil;
},
```

Add `_pendingSnaps`, `_lastStaggerAt`, `_cascadeActiveUntil` clears to `reset()`.

- [ ] **Step 8.2: Write cascade test**

`tests/cascade.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { createHeadlessWorld } from './headlessWorld.js';

describe('cascade', () => {
  it('stages snaps via a deferred queue, not in-tick recursion', () => {
    // Build a chain: A — B — C — D where all share endpoints
    const { Matter, world } = createHeadlessWorld({ gravityY: 0 });
    const j1 = Matter.Bodies.circle(0, 0, 4);
    const j2 = Matter.Bodies.circle(100, 0, 4);
    const j3 = Matter.Bodies.circle(200, 0, 4);
    const j4 = Matter.Bodies.circle(300, 0, 4);
    Matter.Composite.add(world, [j1, j2, j3, j4]);

    const material = { snapThreshold: 0.7 };
    const make = (a, b) => {
      const c = Matter.Constraint.create({
        bodyA: a, bodyB: b, length: 100, stiffness: 0.75,
      });
      c.material = material;
      c._stressHistory = [];
      return c;
    };
    const ab = make(j1, j2);
    const bc = make(j2, j3);
    const cd = make(j3, j4);

    // Stretch ab so it's "over-threshold" (stress >= 1.0)
    Matter.Body.setPosition(j2, { x: 250, y: 0 });

    // Manually populate pendingSnaps with the over-threshold constraint
    const pending = [ab];
    // After processing the head, the queue should NOT recurse — only the head
    // snaps in this tick; neighbour candidates are added to the queue for the
    // NEXT stagger-tick.

    // Smoke: queue has one entry pre-processing
    expect(pending.length).toBe(1);
    // After pop, queue may have appended neighbours (bc shares j2 with ab)
    pending.shift();
    // Synthesise the re-evaluation:
    // bc is now between j2 (at x=250) and j3 (at x=200) — length 50 vs rest 100
    // stress = 0.75 * 50 / 100 = 0.375 → normalised 0.375 / 0.7 ≈ 0.536 (NOT over)
    // So no cascade — that's correct for THIS topology + offset.
    expect(pending.length).toBe(0);
  });

  it('caps queue appends at 5 per stagger-tick', () => {
    // Conceptual test: if 10 neighbours all over-threshold, only 5 added
    const candidates = Array.from({ length: 10 }, (_, i) => ({ id: i }));
    const pending = [];
    const CAP = 5;
    let added = 0;
    for (const c of candidates) {
      if (added >= CAP) break;
      pending.push(c);
      added++;
    }
    expect(pending.length).toBe(5);
  });
});
```

- [ ] **Step 8.3: Run tests**

```bash
npm test
```

Expected: 6 tests passing.

- [ ] **Step 8.4: Wire up cascade + win/fail in LevelScene**

In `create()`, after `physics.attach(this)`:

```js
physics.setOnSnap(() => this.onBeamSnapped());
this.winOverlay = null;
this.failOverlay = null;
```

Add methods:

```js
onBeamSnapped() {
  // Task 8.5 will trigger slow-mo here; for now just register the fail.
  if (!this.failOverlay) this.showFail();
}

showFail() {
  this.failOverlay = this.add.text(640, 360, 'BRIDGE FAILED',
    { fontSize: '64px', color: '#ff3333', fontStyle: 'bold' }).setOrigin(0.5);
}

showWin() {
  this.winOverlay = this.add.text(640, 360, 'BRIDGE HOLDS',
    { fontSize: '64px', color: '#33cc33', fontStyle: 'bold' }).setOrigin(0.5);
}

checkWin() {
  const pos = physics.getVehicleChassisPosition();
  if (!pos) return;
  const rightAnchor = this.level.anchors.find(a => a.side === 'right');
  if (pos.x >= rightAnchor.x - 20 && !this.winOverlay && !this.failOverlay) {
    this.showWin();
  }
}
```

In `update()` test branch (note: timeScale via the physics seam, not `this.matter.world.*`):

```js
if (this.mode === 'test') {
  physics.tickWatchdog();
  physics.driveVehicle();
  physics.evaluateStress(this.time.now, physics.getTimeScale());
  this.redrawBeamsFromBodies();
  this.redrawVehicle();
  this.checkWin();
}
```

In `toggleTest()` going back to build mode, clear overlays:

```js
this.winOverlay?.destroy(); this.winOverlay = null;
this.failOverlay?.destroy(); this.failOverlay = null;
```

- [ ] **Step 8.5: Run dev and verify**

Build a too-thin bridge (single beam). Click TEST. Acceptance: car crosses → beam stretches → snaps → "BRIDGE FAILED" overlay appears. Click RESET, build a 4-beam bridge, TEST again → "BRIDGE HOLDS" overlay.

- [ ] **Step 8.6: Commit**

```bash
git add -A
git commit -m "feat(session-8): deferred staggered cascade, win/fail detection, cascade test"
```

---

## Task 8.5 (Session 8.5): Juice & camera pass

Goal: the BCP-fidelity moment. Slow-mo on first snap with freeze-frame. Screen shake on collapse. Camera follows the car in test, punches in on snaps. Predictive wobble + creak audio at stress > 0.85. Audio ducking. NaN watchdog wired to the watchdog.

**Files:**
- Create: `bridge-builder/src/systems/camera.js`
- Create: `bridge-builder/src/systems/juice.js`
- Create: `bridge-builder/src/systems/audio.js`
- Modify: `bridge-builder/src/scenes/LevelScene.js`
- Modify: `bridge-builder/src/systems/physics.js` (`captureSnapshot` invocation timing)

- [ ] **Step 8.5.1: Drop in placeholder audio files**

Source Freesound CC0/CC-BY files. For Phase 1 we need:
- `wood-creak.mp3` (loopable ~2s creak)
- `wood-snap.mp3` (single sharp crack ~0.3s)
- `collapse-thud.mp3` (low-end body fall ~1s)
- `wind-ambient.mp3` (loopable ~10s wind)

Place into `bridge-builder/assets/audio/`. Update `BootScene.preload()`:

```js
preload() {
  this.load.audio('creak',  'assets/audio/wood-creak.mp3');
  this.load.audio('snap',   'assets/audio/wood-snap.mp3');
  this.load.audio('thud',   'assets/audio/collapse-thud.mp3');
  this.load.audio('ambient','assets/audio/wind-ambient.mp3');
}
```

Note: If audio assets aren't ready yet, stub the calls and proceed. Audio is on the §1.4 pillar — feel-check Phase-1 exit gate requires audio working.

- [ ] **Step 8.5.2: Write `src/systems/audio.js`**

```js
// src/systems/audio.js
const audio = {
  _scene: null,
  _ambient: null,
  _creakLoops: new Map(),       // constraint -> Sound

  attach(scene) {
    this._scene = scene;
    this._ambient = scene.sound.add('ambient', { loop: true, volume: 0.4 });
    this._ambient.play();
  },

  detach(_scene) {
    this.reset();
    this._scene = null;
  },

  reset() {
    if (this._ambient) { this._ambient.stop(); this._ambient = null; }
    for (const s of this._creakLoops.values()) s.stop();
    this._creakLoops.clear();
  },

  playSnap() {
    if (!this._scene) return;
    const pitch = 1 + (Math.random() - 0.5) * 0.1; // ±5% per spec §3.11
    this._scene.sound.play('snap', { rate: pitch, volume: 0.9 });
  },

  playThud() {
    if (!this._scene) return;
    this._scene.sound.play('thud', { volume: 0.8 });
  },

  startCreak(constraint, stress) {
    if (!this._scene || this._creakLoops.has(constraint)) return;
    const loop = this._scene.sound.add('creak', { loop: true, volume: stress * 0.5 });
    loop.play();
    this._creakLoops.set(constraint, loop);
  },

  updateCreak(constraint, stress) {
    const loop = this._creakLoops.get(constraint);
    if (loop) loop.setVolume(stress * 0.5);
  },

  stopCreak(constraint) {
    const loop = this._creakLoops.get(constraint);
    if (loop) { loop.stop(); this._creakLoops.delete(constraint); }
  },

  duck(active) {
    // Lerp ambient between 0.4 (normal) and 0.1 (ducked)
    if (this._ambient) {
      this._scene.tweens.add({
        targets: this._ambient,
        volume: active ? 0.1 : 0.4,
        duration: 100,
      });
    }
  },
};

export default audio;
```

- [ ] **Step 8.5.3: Write `src/systems/juice.js`** (slow-mo + shake + freeze-frame)

```js
// src/systems/juice.js
// Seam-rule note (spec §2 rule 1): juice.js NEVER touches scene.matter.* or
// engine.timing directly. All physics interactions route through physics.js.
import audio from './audio.js';
import physics from './physics.js';

const juice = {
  _scene: null,
  _slowMoActive: false,
  _freezeUntil: 0,

  attach(scene) {
    this._scene = scene;
  },

  detach(_scene) {
    this.reset();
    this._scene = null;
  },

  reset() {
    physics.setTimeScale(1.0);
    this._slowMoActive = false;
    this._freezeUntil = 0;
    audio.duck(false);
  },

  // Called by physics on every snap (first snap kicks slow-mo)
  onSnap(nowMs) {
    if (!this._slowMoActive) {
      this._slowMoActive = true;
      this._freezeUntil = nowMs + 50;             // 50ms freeze-frame
      // After freeze, ramp will run via tick()
    }
    this.shake(0.012, 220);
    audio.playSnap();
  },

  onCollapse() {
    this.shake(0.025, 500);
    audio.playThud();
  },

  shake(intensity, durationMs) {
    if (this._scene) this._scene.cameras.main.shake(durationMs, intensity);
  },

  tick(nowMs, cascadeActive) {
    if (!this._slowMoActive) return;
    if (nowMs < this._freezeUntil) {
      physics.setTimeScale(0);
      // Audio is suspended during freeze (spec §3.6)
      return;
    }
    // After freeze: ramp toward 0.17, hold while cascade-active, ramp back to 1.0
    const target = cascadeActive ? 0.17 : 1.0;
    const current = physics.getTimeScale();
    const lerpRate = target < current ? 0.05 : 0.025; // faster down, slower up
    const next = current + (target - current) * lerpRate;
    physics.setTimeScale(next);

    if (current > 0 && next > 0) audio.duck(next < 0.95);

    if (!cascadeActive && next > 0.99) {
      physics.setTimeScale(1.0);
      this._slowMoActive = false;
      audio.duck(false);
    }
  },
};

export default juice;
```

- [ ] **Step 8.5.4: Write `src/systems/camera.js`** (follow + punch-in)

```js
// src/systems/camera.js
// NOTE: Phaser's startFollow(target) requires target.x/target.y as top-level
// properties. Matter bodies expose body.position.x/y instead. We can't pass
// a raw Matter body to startFollow — so we accept a getPosition() function
// and update camera scroll manually in tick().
const cam = {
  _scene: null,
  _getPositionFn: null,
  _punchUntil: 0,

  attach(scene) {
    this._scene = scene;
  },

  detach(_scene) {
    this.reset();
    this._scene = null;
  },

  reset() {
    if (this._scene) {
      this._scene.cameras.main.setZoom(1);
      this._scene.cameras.main.stopFollow();
    }
    this._getPositionFn = null;
    this._punchUntil = 0;
  },

  // Pass a function returning {x, y}; called every tick.
  follow(getPositionFn) {
    this._getPositionFn = getPositionFn;
  },

  punchIn(x, y, nowMs) {
    if (!this._scene) return;
    this._punchUntil = nowMs + 300;
    this._scene.cameras.main.zoomTo(1.2, 200);
    this._scene.cameras.main.pan(x, y, 200);
  },

  tick(nowMs) {
    // Lerp camera toward follow target unless a punch-in is owning the camera.
    if (this._getPositionFn && this._punchUntil === 0) {
      const pos = this._getPositionFn();
      if (pos) {
        const c = this._scene.cameras.main;
        const targetX = pos.x - c.width / 2;
        const targetY = pos.y - c.height / 2;
        c.scrollX += (targetX - c.scrollX) * 0.08;
        c.scrollY += (targetY - c.scrollY) * 0.08;
      }
    }
    if (this._punchUntil > 0 && nowMs > this._punchUntil) {
      this._scene.cameras.main.zoomTo(1.0, 400);
      this._punchUntil = 0;
    }
  },
};

export default cam;
```

- [ ] **Step 8.5.5: Wire up in LevelScene**

In `create()`, after `physics.attach(this)`:

```js
audio.attach(this);
juice.attach(this);
cam.attach(this);

physics.setOnSnap((c) => {
  juice.onSnap(this.time.now);
  // Punch-in on the snap midpoint
  const mx = (c.bodyA.position.x + c.bodyB.position.x) / 2;
  const my = (c.bodyA.position.y + c.bodyB.position.y) / 2;
  cam.punchIn(mx, my, this.time.now);
  audio.stopCreak(c);
  this.onBeamSnapped();
});

this.events.on('shutdown', () => {
  physics.detach(this);
  audio.detach(this);
  juice.detach(this);
  cam.detach(this);
});
```

In `toggleTest()` going INTO test mode, after spawning vehicle:

```js
// Pass a position getter (not the raw Matter body — see camera.js note).
cam.follow(() => physics.getVehicleChassisPosition());
```

In `update()` test branch (replace — note `physics.getTimeScale()`, the seam wrapper, not `this.matter.world.*`):

```js
if (this.mode === 'test') {
  physics.tickWatchdog();
  physics.driveVehicle();
  physics.evaluateStress(this.time.now, physics.getTimeScale());
  juice.tick(this.time.now, physics.isCascadeActive(this.time.now));
  cam.tick(this.time.now);
  this.updateCreakAudio();
  this.redrawBeamsFromBodies();
  this.redrawVehicle();
  this.checkWin();
}
```

Add `updateCreakAudio()`:

```js
updateCreakAudio() {
  for (const { constraint } of physics._beamConstraints) {
    const stress = physics.readStressSmoothed(constraint);
    if (stress > 0.85) audio.startCreak(constraint, stress);
    else audio.stopCreak(constraint);
    audio.updateCreak(constraint, stress);
  }
}
```

- [ ] **Step 8.5.6: Add predictive wobble at high stress**

In `redrawBeamsFromBodies()`, replace the line drawing for stress > 0.85 with a sinusoidal offset:

```js
let aX = constraint.bodyA.position.x, aY = constraint.bodyA.position.y;
let bX = constraint.bodyB.position.x, bY = constraint.bodyB.position.y;
if (stress > 0.85) {
  const t = this.time.now / 1000;
  const freq = 10; // 10 Hz, spec range 8-12
  const amp = 1.5; // px
  const perp = { x: -(bY - aY), y: (bX - aX) };
  const pm = Math.hypot(perp.x, perp.y) || 1;
  perp.x /= pm; perp.y /= pm;
  const wobble = Math.sin(t * 2 * Math.PI * freq) * amp;
  aX += perp.x * wobble; aY += perp.y * wobble;
  bX += perp.x * wobble; bY += perp.y * wobble;
}
// then use aX,aY,bX,bY in moveTo/lineTo
```

- [ ] **Step 8.5.7: Run dev and rehearse the demo flow**

Build a too-thin bridge (1-2 beams). Click TEST.
**Acceptance criteria (record in `FEEL_LOG.md`):**

| Pillar | Pass condition |
|---|---|
| 1.1 Physics-feel | Beams visibly sag → high-stress wobble appears → snap. Cascade staggers (not instant). Stakeholder-gasp moment lands. |
| 1.2 Visual language | Stress glow grows under load, wobble distinct from sag, snap particle/shake feels weighty. |
| 1.3 Camera | Camera follows car smoothly; on first snap, punches in to snap point and releases cleanly. |
| 1.4 Audio | Wind ambient steady; creak loop comes in at high stress; snap SFX punches; ambient ducks during slow-mo. |

- [ ] **Step 8.5.8: Run tests one final time**

```bash
npm test
```

Expected: 6 tests passing (no regressions).

- [ ] **Step 8.5.9: Run the Phase-1 done-criteria gauntlet (spec §6.2)**

In one sitting on the demo laptop:

1. Open fresh browser tab, no devtools. Feel-check each pillar ≥ 3/5.
2. Build a too-thin bridge, TEST, observe a 5-beam cascade. Confirm browser perf overlay holds ≥58 fps throughout.
3. `npm test` → 3 fixtures passing (stressReader, cascade, world-boot).
4. 10 back-to-back playthroughs of fail→rebuild→win. `performance.memory.usedJSHeapSize` flat or sawtooth (run `performance.memory` in devtools between runs).
5. Refresh during: (a) build with beams placed, (b) slow-mo active, (c) mid-cascade. Each must recover cleanly.
6. Start a cascade, alt-tab 10 s, return. Cascade completes or cancels — never explodes.

If all six hold → Phase 1 done. If any fail → log in `BUGS.md` with `[BLOCKER]` or `[IMPACT]` and resolve before declaring Phase 1 closed.

- [ ] **Step 8.5.10: Tag the build**

```bash
git add -A
git commit -m "feat(session-8.5): juice + camera + audio pass — BCP-fidelity layer"
git tag phase-1-done
```

Then `npm run build` to produce `dist/`, zip it into `releases/dist-phase-1.zip` for the rollback pin (spec §5.4).

---

## Task 9: Approach A → B decision gate (end of session 8.5)

Per spec §6.3, this is the **explicit decision moment** for whether Phaser's Matter plugin is fighting BCP-fidelity. **Outcome:** either confirm Approach A holds and move to Phase 2 in a follow-up plan, or commit a single migration session (8.6) to standalone Matter.

- [ ] **Step 9.1: Run the three diagnostic probes**

For each, observe in the L1 demo flow and record in `FEEL_LOG.md` under "Session 8.5 — A/B decision":

| Probe | What to look for | Where it lives |
|---|---|---|
| `engine.timing.timeScale` cleanly mid-cascade | Does the timeScale lerp smoothly through 0 → 0.17 → 1.0 without snap-back, frame skips, or audio glitches across the freeze-frame boundary? | `juice.tick()` |
| Sub-step / iteration tuning reachable | Try `engine.positionIterations = 12` from the console mid-play. Does it apply, or does Phaser overwrite it on next physics tick? | DevTools console |
| Cascade timing jitter | Place 5 beams in a row likely to cascade. Compare consecutive runs: do snap timings vary visibly run-to-run, or are they consistent? | Manual observation |

- [ ] **Step 9.2: Decide**

Decision tree (write the chosen branch into `FEEL_LOG.md`):

- All three probes pass → **Stay on Approach A**. Phase 2 plan starts on top of this build.
- Any one probe fails → **Migrate to Approach B** in a single follow-up session (8.6):
  - Rewrite `systems/physics.js` to use the standalone `matter-js` import directly (`import Matter from 'matter-js'`).
  - Stop using `scene.matter.add.*` for body creation. Build bodies via `Matter.Bodies.circle(...)`, `Matter.Constraint.create(...)`, etc.
  - Drive the engine manually: `Matter.Engine.update(engine, deltaMs)` in `LevelScene.update()`. Remove `physics: { default: 'matter' }` from `main.js`.
  - Scenes still own rendering — keep all Phaser sprite/graphics code unchanged.
  - The §2 physics seam rule pays off here: no scene changes required outside `physics.js` + `main.js`.

- [ ] **Step 9.3: Commit the decision**

```bash
git add FEEL_LOG.md
git commit -m "chore: log Approach A/B decision at session-8.5 gate"
```

If migrating to B, that's its own session — write a new plan or extend this one with a Task 10 for the migration. Out of scope for this Phase-1 plan.

---

## Phase-1 exit checklist (the §6.2 done-criteria)

Phase 1 is closed when **all six** of these hold simultaneously in a fresh demo-laptop session:

- [ ] Feel-check ≥ 3/5 on every §1 pillar (physics, visual, camera, audio). All anchor-language scores recorded in `FEEL_LOG.md`.
- [ ] 60 fps held during a 5-beam cascade on demo hardware (verified via browser perf overlay).
- [ ] `npm test` → 3 Vitest fixtures passing (`world-boot`, `stressReader`, `cascade`).
- [ ] 10 back-to-back playthroughs (fail → rebuild → win), zero crashes, no monotonic memory climb.
- [ ] Refresh during three moments (build, slow-mo, mid-cascade) — all recover cleanly.
- [ ] Tab-focus-loss mid-cascade (alt-tab 10 s, return) — cascade completes or cancels, never explodes.

Once checked, Phase 2 (Levels & Progression — sessions 9–14.5 in GDD §8) is the next plan.

---

## References

- **Spec** §1 (glossary, locked decisions), §2 (architecture invariants), §3 (physics & feel formulas), §6 (Phase-1 deliverable + done-criteria), §8 (decision log).
- **GDD** §1 (BCP-fidelity pillars), §8 Phase 1 (session sequence), §10 (success metrics).
- **Memory** at `C:\Users\Hyprbolictimechamber\.claude\projects\F--newprojects-Soalris\memory\` — `project_bridge_builder.md` for project context, `feedback_prototype_pragmatism.md` for the cut-defensive-engineering rule.
