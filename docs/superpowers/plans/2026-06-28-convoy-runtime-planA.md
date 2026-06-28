# Convoy Runtime (Plan A) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a level send multiple vehicles across in a time-gapped convoy (mixed types), winning only when all cross and failing the instant any falls, with a live "N/total across" counter.

**Architecture:** `physics._vehicle` (single) becomes `physics._vehicles[]`. A new pure `src/systems/convoy.js` controller owns spawn cadence + win/fail given the scene clock and per-vehicle states. `vehicleDesign.js` gains `resolveConvoy()`. `LevelScene` drives the controller from its test-mode `update()` loop, spawning/despawning vehicles and drawing one sprite per live vehicle.

**Tech Stack:** Phaser 3.90 + Matter.js (via Phaser bundle), Vitest + jsdom, synchronous bus (`src/ui-html/bus.js`).

**Spec:** `docs/superpowers/specs/2026-06-28-convoy-and-csv-levels-design.md`

## Global Constraints

- **Physics iron law:** only `src/systems/physics.js` calls `scene.matter.*`. LevelScene calls physics singleton methods.
- **One Matter universe:** never `import 'matter-js'` in game code (tests may).
- **Teardown null-guards:** `detach`/`reset` must null-guard `scene.matter.world` (Phaser nulls it before `shutdown`). See `docs/AI_CODING_GUIDE.md` §3.
- **`level.vehicles` is ALWAYS an array** (existing invariant; this plan uses entries beyond `[0]`).
- **Vehicle collision group** is per-vehicle `-(2 + index)`: own chassis↔wheels never collide; different vehicles fall back to category/mask and can rear-end.
- Stage-only this pass (no commits); the user commits after manual testing. Commit steps below are written for completeness but are deferred.

---

## Task 1: Pure convoy controller (`convoy.js`)

**Files:**
- Create: `src/systems/convoy.js`
- Test: `tests/convoy.test.js`

**Interfaces:**
- Produces: `makeConvoyController({ count, gapMs, checkpointX, worldHeight })` → `{ total, tick(nowMs, states) }` where `states = [{ id, x, y, crossed }]` and `tick` returns `{ toSpawn: [{ index }], won, failed, crossedCount, total }`.

- [ ] **Step 1: Write the failing tests**

Create `tests/convoy.test.js`:

```js
// tests/convoy.test.js
import { describe, it, expect } from 'vitest';
import { makeConvoyController } from '../src/systems/convoy.js';

const opts = { count: 3, gapMs: 1000, checkpointX: 1000, worldHeight: 720 };

describe('makeConvoyController spawn cadence', () => {
  it('spawns vehicle 0 immediately on the first tick', () => {
    const c = makeConvoyController(opts);
    const r = c.tick(5000, []);
    expect(r.toSpawn).toEqual([{ index: 0 }]);
  });

  it('does not spawn vehicle 1 until a full gap has elapsed', () => {
    const c = makeConvoyController(opts);
    c.tick(5000, []);                       // t0 -> spawn 0
    expect(c.tick(5500, []).toSpawn).toEqual([]);   // +500ms, too early
    expect(c.tick(6000, []).toSpawn).toEqual([{ index: 1 }]); // +1000ms
  });

  it('spawns multiple at once if the loop fell behind', () => {
    const c = makeConvoyController(opts);
    c.tick(0, []);                          // spawn 0 at t0
    const r = c.tick(2500, []);             // 2.5 gaps later -> 1 and 2
    expect(r.toSpawn).toEqual([{ index: 1 }, { index: 2 }]);
  });
});

describe('makeConvoyController win/fail', () => {
  it('wins only after all spawned AND all crossed', () => {
    const c = makeConvoyController(opts);
    c.tick(0, []);
    c.tick(3000, []);                        // all 3 spawned by now
    const notYet = c.tick(3000, [
      { id: 0, x: 1000, y: 300, crossed: true },
      { id: 1, x: 500,  y: 300, crossed: false },
      { id: 2, x: 200,  y: 300, crossed: false },
    ]);
    expect(notYet.won).toBe(false);
    expect(notYet.crossedCount).toBe(1);
    const done = c.tick(3000, [
      { id: 0, x: 1200, y: 300, crossed: true },
      { id: 1, x: 1100, y: 300, crossed: true },
      { id: 2, x: 1000, y: 300, crossed: false }, // x>=checkpointX counts as crossed
    ]);
    expect(done.won).toBe(true);
    expect(done.crossedCount).toBe(3);
  });

  it('fails the instant any vehicle drops below the world', () => {
    const c = makeConvoyController(opts);
    c.tick(0, []);
    const r = c.tick(100, [{ id: 0, x: 300, y: 720 + 41, crossed: false }]);
    expect(r.failed).toBe(true);
    expect(r.won).toBe(false);
  });

  it('treats a length-1 convoy like a single vehicle', () => {
    const c = makeConvoyController({ ...opts, count: 1 });
    expect(c.tick(0, []).toSpawn).toEqual([{ index: 0 }]);
    expect(c.tick(50, [{ id: 0, x: 1000, y: 300, crossed: true }]).won).toBe(true);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- tests/convoy.test.js`
Expected: FAIL — cannot import `makeConvoyController`.

- [ ] **Step 3: Implement `convoy.js`**

```js
// src/systems/convoy.js
// Pure convoy controller — NO Phaser/Matter. The scene passes in its clock (nowMs) and
// the live per-vehicle states each frame; this decides spawn cadence + win/fail. Pure so
// cadence and the win condition are unit-testable with deterministic time.
const FALL_MARGIN = 40; // px below world bottom = fell (mirrors LevelScene.checkFall)

export function makeConvoyController({ count, gapMs, checkpointX, worldHeight }) {
  let spawned = 0;
  let startedAt = null;        // nowMs of the first tick; vehicle 0 spawns immediately

  return {
    total: count,
    tick(nowMs, states) {
      if (startedAt === null) startedAt = nowMs;
      const toSpawn = [];
      while (spawned < count && nowMs - startedAt >= spawned * gapMs) {
        toSpawn.push({ index: spawned });
        spawned++;
      }

      let crossedCount = 0;
      let failed = false;
      for (const s of states) {
        if (s.crossed || s.x >= checkpointX) crossedCount++;
        if (s.y > worldHeight + FALL_MARGIN) failed = true;
      }
      const won = !failed && spawned === count && crossedCount >= count;
      return { toSpawn, won, failed, crossedCount, total: count };
    },
  };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- tests/convoy.test.js`
Expected: PASS (all cadence + win/fail suites).

- [ ] **Step 5: Commit** (deferred — stage only)

```bash
git add src/systems/convoy.js tests/convoy.test.js
```

---

## Task 2: Physics — single vehicle → array of vehicles

**Files:**
- Modify: `src/systems/physics.js` (reset 114–125; `freezeVehicle` 371–379; `removeVehicle` 381–389; `spawnVehicle` 391–444; `driveVehicle` 446–478; `getDebugInfo` 480–481; `getVehicleChassisPosition` 526–528; `applyVehicleLoad` 726–728)

**Interfaces:**
- Produces: `physics._vehicles` (array). `spawnVehicle(config)` returns `{ id, chassis, wheelA, wheelB, axleA, axleB, config }` and assigns `config.id` if absent. `getVehicles()` → `[{ id, position, config }]`. `freezeVehicle(id?)` freezes one or all. `removeVehicle(id)` removes one. `getVehicleChassisPosition()` returns the **lead** (`_vehicles[0]`) chassis position or null.
- Consumes: nothing new.

Note: physics spawn/drive are not unit-tested today (they require a live Phaser `scene.matter`); this task is verified by the production build compiling and by the in-app run in Task 4. Keep edits mechanical.

- [ ] **Step 1: Add the vehicles array field and a counter**

In the singleton's field initializers (near other `_` fields, e.g. where `_wheelLandAt` is declared), add:

```js
  _vehicles: [],
  _vehicleSeq: 0,
```

(If a `_vehicle: null` field declaration exists, leave it; it is no longer read after this task. Search-and-confirm no remaining `this._vehicle` references at the end.)

- [ ] **Step 2: Rewrite `reset()` vehicle teardown (lines ~114–125)**

Replace:

```js
      if (this._vehicle) {
        toRemove.push(this._vehicle.chassis);
        if (this._vehicle.wheelA) toRemove.push(this._vehicle.wheelA, this._vehicle.wheelB);
        if (this._vehicle.axleA)  toRemove.push(this._vehicle.axleA,  this._vehicle.axleB);
      }
```

with:

```js
      for (const v of this._vehicles) {
        toRemove.push(v.chassis);
        if (v.wheelA) toRemove.push(v.wheelA, v.wheelB);
        if (v.axleA)  toRemove.push(v.axleA,  v.axleB);
      }
```

And replace `this._vehicle = null;` (line ~125) with:

```js
    this._vehicles.length = 0;
    this._vehicleSeq = 0;
```

- [ ] **Step 3: Rewrite `freezeVehicle` and `removeVehicle`**

Replace `freezeVehicle()` (371–379) with:

```js
  freezeVehicle(id) {
    if (!this._scene) return;
    const targets = id == null ? this._vehicles : this._vehicles.filter(v => v.id === id);
    for (const { chassis, wheelA, wheelB } of targets) {
      this._scene.matter.body.setStatic(chassis, true);
      if (wheelA) {
        this._scene.matter.body.setStatic(wheelA, true);
        this._scene.matter.body.setStatic(wheelB, true);
      }
    }
  },
```

Replace `removeVehicle()` (381–389) with:

```js
  removeVehicle(id) {
    if (!this._scene) return;
    const v = this._vehicles.find(x => x.id === id);
    if (!v) return;
    const toRemove = [v.chassis];
    if (v.wheelA) toRemove.push(v.wheelA, v.wheelB);
    if (v.axleA)  toRemove.push(v.axleA, v.axleB);
    this._scene.matter.world.remove(toRemove);
    this._vehicles = this._vehicles.filter(x => x.id !== id);
  },
```

- [ ] **Step 4: Make `spawnVehicle` push to the array with a per-vehicle group**

In `spawnVehicle` (391–444): assign an id and a unique negative group, and use that group on both chassis and wheels. At the top of the function after `const { spawnAt } = config;` add:

```js
    const id = config.id ?? this._vehicleSeq++;
    const group = -(2 + (this._vehicles.length)); // own chassis<->wheels never collide; cross-vehicle collide
```

Change the chassis `collisionFilter` group from `group: -2` to `group,` and the wheel `collisionFilter` group from `group: -2` to `group,`.

Replace the final two lines:

```js
    this._vehicle = { chassis, wheelA, wheelB, axleA, axleB, config };
    return this._vehicle;
```

with:

```js
    const vehicle = { id, chassis, wheelA, wheelB, axleA, axleB, config };
    this._vehicles.push(vehicle);
    return vehicle;
```

- [ ] **Step 5: Iterate in `driveVehicle` and `applyVehicleLoad`; add `getVehicles`; fix lead accessors**

Replace `driveVehicle()` body guard + destructure (446–448) so it loops:

```js
  driveVehicle() {
    if (!this._scene) return;
    for (const { chassis, config } of this._vehicles) {
      const dir      = config.spawnAt === 'left' ? 1 : -1;
      const maxSpeed = config.driveSpeed ?? 3;
      const gain     = config.driveForceGain ?? 0.001;
      const vx       = chassis.velocity.x;
      if (dir * vx < maxSpeed) {
        this._scene.matter.body.applyForce(chassis, chassis.position, {
          x: dir * (maxSpeed - dir * vx) * gain * chassis.mass,
          y: 0,
        });
      }
      this._scene.matter.body.setAngularVelocity(chassis, chassis.angularVelocity * 0.3);
    }
  },
```

In `applyVehicleLoad()` (726–753): wrap the per-beam loop so it runs once per vehicle. Replace the guard + `const chassis = this._vehicle.chassis;` (727–728) with:

```js
  applyVehicleLoad() {
    if (!this._scene) return;
    const engine = this._scene.matter.world.engine;
    for (const v of this._vehicles) {
      const chassis = v.chassis;
      const carX = chassis.position.x;
      const carY = chassis.position.y;
      const weightForce = chassis.mass * engine.gravity.y * (engine.gravity.scale ?? 0.001);
```

…and add a matching closing `}` for the `for (const v of this._vehicles)` loop at the end of the method (after the existing beam `for` loop closes, before the method's closing `},`). Remove the now-duplicated `const engine`/`weightForce` lines that were inside the old single-vehicle body.

Replace `getVehicleChassisPosition()` (526–528) with a lead accessor + a new plural accessor:

```js
  getVehicleChassisPosition() {
    return this._vehicles[0] ? this._vehicles[0].chassis.position : null;
  },

  getVehicles() {
    return this._vehicles.map(v => ({ id: v.id, position: v.chassis.position, config: v.config }));
  },
```

In `getDebugInfo()` (480–481) replace the guard + `const chassis = this._vehicle.chassis;` with lead-vehicle equivalents:

```js
  getDebugInfo() {
    if (!this._vehicles[0]) return null;
    const lead = this._vehicles[0];
    const chassis = lead.chassis;
```

…and within `getDebugInfo`, replace any remaining `this._vehicle.` references with `lead.` (e.g. `this._vehicle.config` → `lead.config`, `this._vehicle._dbgPrevVx` → `lead._dbgPrevVx`).

- [ ] **Step 6: Confirm no stale `this._vehicle` references remain**

Run: `npx rg "this\._vehicle\b" src/systems/physics.js`
Expected: no matches (only `this._vehicles`). Fix any stragglers.

- [ ] **Step 7: Verify the build compiles and the suite is green**

Run: `npm run build`
Expected: built, no errors.
Run: `npm test -- tests/cascade.test.js tests/stressReader.test.js`
Expected: no NEW failures vs baseline (these don't touch vehicles).

- [ ] **Step 8: Commit** (deferred — stage only)

```bash
git add src/systems/physics.js
```

---

## Task 3: `resolveConvoy()` in `vehicleDesign.js`

**Files:**
- Modify: `src/utils/vehicleDesign.js`
- Test: `tests/vehicleDesign.test.js`

**Interfaces:**
- Produces: `resolveConvoy(level, presets, selectedKey)` → array of `{ type, spawnAt, weight, speed, acceleration }` (design scales, pre-`vehicleParamsFromDesign`), one per `level.vehicles` entry. Locked levels resolve each entry's type+design; unlocked levels return a single entry for the player-selected preset.

- [ ] **Step 1: Write the failing tests**

Append to `tests/vehicleDesign.test.js`:

```js
import { resolveConvoy } from '../src/utils/vehicleDesign.js';

const PRESETS = [
  { key: 'car',   weight: 3, speed: 7, acceleration: 5 },
  { key: 'truck', weight: 5, speed: 4, acceleration: 5 },
  { key: 'tank',  weight: 8, speed: 2, acceleration: 5 },
];

describe('resolveConvoy', () => {
  it('locked level resolves every entry by its own type + design override', () => {
    const level = {
      ui: { vehicleSelect: false },
      vehicles: [
        { type: 'car', spawnAt: 'left' },
        { type: 'truck', spawnAt: 'left', design: { weight: 6 } },
      ],
    };
    const out = resolveConvoy(level, PRESETS, 'tank');   // selectedKey ignored when locked
    expect(out).toHaveLength(2);
    expect(out[0]).toMatchObject({ type: 'car', spawnAt: 'left', weight: 3, speed: 7 });
    expect(out[1]).toMatchObject({ type: 'truck', spawnAt: 'left', weight: 6, speed: 4 });
  });

  it('unlocked level returns a single player-selected vehicle', () => {
    const level = { vehicles: [{ type: 'car', spawnAt: 'left' }] };   // no ui.vehicleSelect:false
    const out = resolveConvoy(level, PRESETS, 'tank');
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ type: 'tank', spawnAt: 'left', weight: 8, speed: 2 });
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- tests/vehicleDesign.test.js`
Expected: FAIL — `resolveConvoy` is not exported.

- [ ] **Step 3: Implement `resolveConvoy` + shared `resolveOne`**

Replace the contents of `src/utils/vehicleDesign.js` with (keeps `resolveVehicleDesign` working via the shared helper):

```js
// src/utils/vehicleDesign.js
// Resolves the 1-10 design-scale vehicle params for a test run.
// Locked levels (ui.vehicleSelect === false) always use the level's vehicle(s);
// otherwise the player's selected preset wins. Level `design` overrides
// individual fields on locked levels.

function resolveOne(entry, presets, key) {
  const preset = presets.find(p => p.key === key) ?? presets[0];
  const base = { weight: preset.weight, speed: preset.speed, acceleration: preset.acceleration };
  return { ...base, ...(entry?.design ?? {}) };
}

export function resolveVehicleDesign(level, presets, selectedKey) {
  const v = level.vehicles[0];
  const locked = level.ui?.vehicleSelect === false;
  const key = locked ? v.type : selectedKey;
  // Unlocked: ignore any level design override (player owns the design).
  return locked ? resolveOne(v, presets, key) : resolveOne(null, presets, key);
}

// Multi-vehicle convoy. Locked levels resolve every entry; unlocked levels run a
// single player-selected vehicle (convoys are a locked-level construct).
export function resolveConvoy(level, presets, selectedKey) {
  const locked = level.ui?.vehicleSelect === false;
  if (!locked) {
    const preset = presets.find(p => p.key === selectedKey) ?? presets[0];
    const first = level.vehicles[0] ?? {};
    return [{
      type: preset.key, spawnAt: first.spawnAt ?? 'left',
      ...resolveOne(null, presets, preset.key),
    }];
  }
  return level.vehicles.map(v => ({
    type: v.type, spawnAt: v.spawnAt ?? 'left',
    ...resolveOne(v, presets, v.type),
  }));
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- tests/vehicleDesign.test.js`
Expected: PASS (existing `resolveVehicleDesign` tests + new `resolveConvoy` tests).

- [ ] **Step 5: Commit** (deferred — stage only)

```bash
git add src/utils/vehicleDesign.js tests/vehicleDesign.test.js
```

---

## Task 4: LevelScene — convoy controller wiring (logic)

**Files:**
- Modify: `src/scenes/LevelScene.js` (imports ~10; `_checkpointX` 150–152; `toggleTest` build-branch 1292–1333; `update` test loop 1476–1518; `checkWin` 1644–1652 and `checkFall` 1586–1593 — replaced; `showWin` 1618–1635; `endTest` 1639–1642)

**Interfaces:**
- Consumes: `makeConvoyController` (Task 1), `resolveConvoy` (Task 3), `physics.getVehicles`/`spawnVehicle`/`removeVehicle`/`freezeVehicle` (Task 2).
- Produces: `this._convoy` controller; `this._crossed` (Set of crossed ids); `this._convoyConfigs` (resolved array); `this._spawnedIds` (array). Emits `convoy:progress` on the bus.

This task is scene wiring; verified by running the app and the suite staying green (no LevelScene unit test exists, consistent with the codebase).

- [ ] **Step 1: Import the controller + resolver**

At the top of `src/scenes/LevelScene.js`, where `vehicleDesign`/`resolveVehicleDesign` is imported, add `resolveConvoy` to that import, and add:

```js
import { makeConvoyController } from '../systems/convoy.js';
```

(Find the existing line importing from `'../utils/vehicleDesign.js'` and add `resolveConvoy` to its named imports.)

- [ ] **Step 2: Initialize convoy state fields**

In the field-init area (near `this._vehicleSprite`/`_prevChassisY`), add:

```js
    this._convoy = null;
    this._crossed = new Set();
    this._convoyConfigs = [];
    this._spawnedIds = [];
```

- [ ] **Step 3: Build the convoy in the build→test branch of `toggleTest`**

In `toggleTest` build→test (1292–1333), replace the single-spawn block (the lines building `vehicleConfig` from `this.level.vehicles[0]` and calling `physics.spawnVehicle(vehicleConfig)`) with convoy setup:

```js
      // Resolve the convoy (locked levels: the level's vehicle list; unlocked: one
      // player-selected vehicle). Each entry carries its own design scales.
      const selected = this._vehiclePreset;
      this._convoyConfigs = resolveConvoy(this.level, VEHICLE_PRESETS, selected);
      this._crossed = new Set();
      this._spawnedIds = [];
      const spawn = this._spawnPoint();
      this._convoy = makeConvoyController({
        count: this._convoyConfigs.length,
        gapMs: this.level.convoyGapMs ?? 1500,
        checkpointX: this._checkpointX,
        worldHeight: this.level.worldHeight,
      });
      this._spawnConvoyVehicle(0, spawn);   // vehicle 0 spawns immediately
      bus.emit('convoy:progress', { crossed: 0, total: this._convoyConfigs.length });
```

(If a per-vehicle `spawnY` should differ, `_spawnConvoyVehicle` recomputes it; see Step 5.)

- [ ] **Step 4: Add the per-vehicle spawn helper**

Add a method to `LevelScene` (near `_spawnPoint`):

```js
  _spawnConvoyVehicle(index, spawn) {
    const cfg = this._convoyConfigs[index];
    if (!cfg) return;
    const vehicleConfig = {
      type: cfg.type,
      spawnAt: cfg.spawnAt,
      ...vehicleParamsFromDesign({ weight: cfg.weight, speed: cfg.speed, acceleration: cfg.acceleration }),
      spawnX: spawn.x,
      spawnY: spawn.y,
    };
    const v = physics.spawnVehicle(vehicleConfig);
    if (v) this._spawnedIds.push(v.id);
  }
```

(`vehicleParamsFromDesign` is already imported in LevelScene — confirm; if not, add it to the `vehicleDesign.js` import.)

- [ ] **Step 5: Replace `checkWin`/`checkFall` with a controller tick**

In the `update()` test-mode block (1476–1518), find the `this.checkWin();` and `this.checkFall();` calls and replace **both** with a single `this._tickConvoy();`. Then add the method:

```js
  _tickConvoy() {
    if (!this._convoy) return;
    const live = physics.getVehicles();                 // [{ id, position, config }]
    const cpX = this._checkpointX;

    // Persist crossings (a vehicle stays "crossed" even after it despawns off-screen).
    for (const v of live) if (v.position.x >= cpX) this._crossed.add(v.id);

    // Build states for ALL spawned ids: live ones use real x/y, retired ones are
    // reported as crossed (x = Infinity, y = 0) so the win count stays correct.
    const states = this._spawnedIds.map(id => {
      const lv = live.find(l => l.id === id);
      return lv
        ? { id, x: lv.position.x, y: lv.position.y, crossed: this._crossed.has(id) }
        : { id, x: Infinity, y: 0, crossed: this._crossed.has(id) };
    });

    const r = this._convoy.tick(this.time.now, states);

    // Spawn any due vehicles.
    for (const { index } of r.toSpawn) {
      if (index === 0) continue;                        // vehicle 0 already spawned in toggleTest
      this._spawnConvoyVehicle(index, this._spawnPoint());
    }

    // Despawn vehicles that have crossed and driven fully off the far side, so they
    // don't pile up and block followers. (Their crossed flag is already in the Set.)
    const offX = this.level.worldWidth + 120;
    for (const v of live) {
      if (this._crossed.has(v.id) && (v.position.x > offX || v.position.x < -120)) {
        physics.removeVehicle(v.id);
        this._vehicleSprites?.get(v.id)?.setVisible(false);
      }
    }

    bus.emit('convoy:progress', { crossed: r.crossedCount, total: r.total });

    if (r.failed && !this.failOverlay && !this.winOverlay) { cam.follow(null); this.showFail(); }
    else if (r.won && !this.winOverlay && !this.failOverlay) { this.showWin(); }
  }
```

- [ ] **Step 6: Freeze ALL vehicles on win/fail**

`physics.freezeVehicle()` already freezes all when called with no id (Task 2), so `showWin` (1619) and `endTest` (1640) need no change. Confirm both call `physics.freezeVehicle()` with no argument.

- [ ] **Step 7: Reset convoy state on test→build**

In the test→build branch of `toggleTest` (1334–1364), after the existing cleanup, add:

```js
      this._convoy = null;
      this._crossed = new Set();
      this._spawnedIds = [];
      this._convoyConfigs = [];
```

- [ ] **Step 8: Verify the suite stays green and the build compiles**

Run: `npm test`
Expected: no NEW failures vs the pre-task baseline (record the baseline count first with `npm test` on a clean tree).
Run: `npm run build`
Expected: built, no errors.

- [ ] **Step 9: Commit** (deferred — stage only)

```bash
git add src/scenes/LevelScene.js
```

---

## Task 5: LevelScene — one sprite per live vehicle

**Files:**
- Modify: `src/scenes/LevelScene.js` (`redrawVehicle` 1654–1703; field init; reset in test→build)

**Interfaces:**
- Consumes: `physics.getVehicles()` (Task 2).
- Produces: `this._vehicleSprites` (`Map<id, Phaser.Image>`).

Verified in-app (visual). No unit test (consistent with the codebase).

- [ ] **Step 1: Replace the single-sprite field**

In field init, replace `this._vehicleSprite = null;` with:

```js
    this._vehicleSprites = new Map();   // vehicle id -> Phaser.Image
```

(Search the file for other `_vehicleSprite` uses — e.g. in `redrawVehicle`, sink-fade, and any `setVisible(false)` on mode change — and update them per the steps below.)

- [ ] **Step 2: Rewrite `redrawVehicle` to iterate vehicles**

Replace `redrawVehicle()` (1654–1703) with a version that draws one sprite per live vehicle, keyed by id, using that vehicle's type texture, reusing the existing procedural fallback + sink-fade + squash per vehicle:

```js
  redrawVehicle() {
    this.vehicleGraphics.clear();
    const live = physics.getVehicles();
    const seen = new Set();

    for (const v of live) {
      seen.add(v.id);
      const c = v.config;
      const key = c.type;
      const pos = v.position;
      // (Re)use the chassis body for angle: getVehicles exposes position+config; for
      // angle/wheels fall back to procedural when no texture. Read the body via config? —
      // draw sprite at position; rotation from the chassis is fetched via getVehicles
      // extension below.
      const angle = v.angle ?? 0;

      if (this.textures.exists(key) && assets.has(key)) {
        let spr = this._vehicleSprites.get(v.id);
        if (!spr) {
          spr = this.add.image(pos.x, pos.y, key).setOrigin(0.5, 0.5).setDepth(2).setDisplaySize(120, 72);
          this._vehicleSprites.set(v.id, spr);
        }
        const fade = this._sinkAlpha(pos.y);            // existing helper, reused
        const sq = fx.getSquash ? fx.getSquash() : { sx: 1, sy: 1 };
        spr.setTexture(key).setVisible(true)
           .setDisplaySize(120 * sq.sx, 72 * sq.sy)
           .setPosition(pos.x, pos.y).setRotation(angle).setAlpha(fade);
      }
    }

    // Hide/destroy sprites whose vehicle is gone.
    for (const [id, spr] of this._vehicleSprites) {
      if (!seen.has(id)) { spr.destroy(); this._vehicleSprites.delete(id); }
    }
  }
```

NOTE: this needs per-vehicle `angle` and the existing sink-fade helper. In Task 2's `getVehicles`, extend the mapped object to include `angle: v.chassis.angle`. If the current sink-fade is inline (not a `_sinkAlpha` helper), extract the existing alpha math into `_sinkAlpha(y)` and call it here. If the procedural fallback (no texture) path is needed for DEV, port the existing rectangle+wheels draw inside the loop using `physics.getVehicles()` extended with wheel positions; for the shipped sprite levels the texture path is the common case.

- [ ] **Step 3: Extend `getVehicles()` with angle (Task 2 follow-on)**

In `physics.getVehicles()` change the mapped object to:

```js
  getVehicles() {
    return this._vehicles.map(v => ({
      id: v.id, position: v.chassis.position, angle: v.chassis.angle, config: v.config,
    }));
  },
```

- [ ] **Step 4: Clear all sprites on test→build and shutdown**

In the test→build branch of `toggleTest`, replace any `this._vehicleSprite?.setVisible(false);` with:

```js
      for (const spr of this._vehicleSprites.values()) spr.destroy();
      this._vehicleSprites.clear();
```

Do the same wherever the old `_vehicleSprite` was hidden on win/reset.

- [ ] **Step 5: Verify the build + run**

Run: `npm run build`
Expected: built, no errors.
(In-app convoy verification happens in Task 7.)

- [ ] **Step 6: Commit** (deferred — stage only)

```bash
git add src/scenes/LevelScene.js src/systems/physics.js
```

---

## Task 6: Progress counter HUD ("N/total across")

**Files:**
- Modify: `src/ui-html/components/Hud.js` (subscribe to `convoy:progress`, render a counter)
- Test: none (DOM component; verified in-app, consistent with `tests/ui-html` coverage gaps)

**Interfaces:**
- Consumes: bus event `convoy:progress` `{ crossed, total }` (emitted in Task 4).

- [ ] **Step 1: Read the current Hud component**

Run: `npx rg "bus\.(on|emit)" src/ui-html/components/Hud.js` and read the file to match its render/update pattern (how it mounts an element and subscribes to bus events).

- [ ] **Step 2: Add a convoy counter element + subscription**

In `Hud.js`, in the mount function, create a hidden counter element and subscribe:

```js
  const convoy = document.createElement('div');
  convoy.className = 'hud-convoy';
  convoy.style.display = 'none';
  root.appendChild(convoy);

  bus.on('convoy:progress', ({ crossed, total }) => {
    if (total <= 1) { convoy.style.display = 'none'; return; }  // hide for single-vehicle
    convoy.style.display = '';
    convoy.textContent = `${crossed}/${total} across`;
  });
```

(Match the file's existing element-creation idiom; if it uses a helper like `el('div', …)`, use that instead of raw `document.createElement`.)

- [ ] **Step 3: Style the counter**

In `src/ui-html/styles/components.css`, add:

```css
.hud-convoy {
  font: 600 14px/1 system-ui, sans-serif;
  color: #eaf2ff;
  background: rgba(20, 30, 50, 0.6);
  padding: 4px 10px;
  border-radius: 8px;
}
```

(Match neighboring HUD chip styles if they differ.)

- [ ] **Step 4: Ensure cleanup**

If `Hud.js` returns/registers a teardown that calls `bus.off`, add `bus.off('convoy:progress', handler)` there (store the handler in a const). If the HUD has no teardown (mounted once for the app lifetime), no `bus.off` is needed — match the file's existing convention.

- [ ] **Step 5: Verify build**

Run: `npm run build`
Expected: built, no errors.

- [ ] **Step 6: Commit** (deferred — stage only)

```bash
git add src/ui-html/components/Hud.js src/ui-html/styles/components.css
```

---

## Task 7: Demo convoy level + `convoyGapMs`, and in-app verification

**Files:**
- Modify: `src/data/leveldata.js` (give one level a multi-vehicle convoy + `convoyGapMs`)
- Test: `tests/levels.test.js` stays green (it already allows multi-entry `vehicles`)

- [ ] **Step 1: Make L10 a convoy**

In `src/data/leveldata.js`, change `L10`'s `vehicles` from the single truck to a 3-vehicle convoy and add a gap. Replace:

```js
  vehicles: [{ type: 'truck', spawnAt: 'left' }],
```

with:

```js
  vehicles: [
    { type: 'car',   spawnAt: 'left' },
    { type: 'car',   spawnAt: 'left' },
    { type: 'truck', spawnAt: 'left' },
  ],
  convoyGapMs: 1400,
```

Update `L10.tutorial.success.text` to reflect the convoy, e.g. `'The whole convoy made it across!'`. (L10's hint is generic — "use everything you know" — so the tutorial-promise invariant in `docs/AI_CODING_GUIDE.md` §2 still holds: it's a locked challenge level with `ui.vehicleSelect: false`.)

- [ ] **Step 2: Run the level/data suites**

Run: `npm test -- tests/levels.test.js tests/modules.test.js tests/vehicleDesign.test.js tests/convoy.test.js`
Expected: PASS (no schema violations; convoy entries are known types).

- [ ] **Step 3: Full suite — no new failures**

Run: `npm test`
Expected: only the pre-existing baseline failures (record them first); nothing new from this plan.

- [ ] **Step 4: In-app verification (manual — Playwright not installed)**

Run: `npm run dev`, enter Module "Weight & Engineering" → Level (L10), build a strong bridge, press TEST. Confirm:
- Three vehicles spawn in sequence ~1.4s apart (two cars then a truck); more than one is on the deck at once.
- The HUD shows "1/3 across", "2/3 across", "3/3 across" as they cross.
- WIN fires only after the **third** vehicle crosses the checkpoint.
- If the bridge breaks and any vehicle drops, FAIL fires immediately.
- No console errors; a NEXT LEVEL / MENU transition after the result does not throw (watch the console — `fx`/physics teardown path).
- A single-vehicle level (e.g. L01) behaves exactly as before and shows no counter.

- [ ] **Step 5: Commit** (deferred — stage only; user commits after manual testing)

```bash
git add src/data/leveldata.js
```

---

## Self-Review

**Spec coverage (Feature 1 rows):**
- Convoy sequential time-gap + win-all/fail-any → Tasks 1, 4 ✓
- `physics._vehicles[]` + per-vehicle group (rear-end) → Task 2 ✓
- Pure controller (time injected) → Task 1 ✓
- `resolveConvoy` (locked convoy / unlocked single) → Task 3 ✓
- Spawn queue + despawn-after-cross → Task 4 ✓
- One sprite per live vehicle → Task 5 ✓
- "N/total across" progress, hidden for length-1 → Task 6 ✓
- `convoyGapMs` (default 1500) + demo convoy → Tasks 4, 7 ✓
- Cheat panel unchanged for single/unlocked → Task 3 (unlocked path) ✓

**Out of scope (Plan B):** CSV pipeline, `levelKnobs.js`, gen/export scripts, generated overrides.

**Type/name consistency:** `makeConvoyController({count,gapMs,checkpointX,worldHeight})`, `tick(nowMs, states)→{toSpawn:[{index}],won,failed,crossedCount,total}`, `physics.getVehicles()→[{id,position,angle,config}]`, `physics.spawnVehicle→{id,…}`, `freezeVehicle(id?)`, `removeVehicle(id)`, `resolveConvoy(level,presets,selectedKey)`, `convoy:progress {crossed,total}`, `this._convoy/_crossed/_spawnedIds/_convoyConfigs`, `_spawnConvoyVehicle(index,spawn)`, `_tickConvoy()` — used consistently across tasks.

**Risk note (in-app only):** the procedural (no-texture) vehicle draw path and the exact sink-fade helper name (`_sinkAlpha`) must be reconciled against the live `redrawVehicle` during Task 5 — the file may inline that math. Resolve by reading the current method before editing.
