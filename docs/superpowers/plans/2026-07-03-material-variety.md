# Material Variety Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add 3 road materials (Dirt/Asphalt/Concrete) and 3 beam materials (Rope/Wood/Steel), each with distinct sag/strength/price/look, selectable from a spring-out toolbar submenu, spent from a single total budget.

**Architecture:** A new immutable `MATERIALS` registry is the single source of truth. `material.type` (`'road'`/`'beam'`) is kept as the drivability discriminator — **no rename**. The two budget pools collapse to one `_budget`. Per-material `visual` descriptors drive canvas rendering. Save/load persists `material.id`. `physics.js` is untouched except by data flowing through existing reads.

**Tech Stack:** Phaser 3.90 + Matter.js (via Phaser bundle), Vite, Vitest (jsdom), HTML/CSS DOM UI communicating with the scene through `src/ui-html/bus.js`.

## Global Constraints

- **Physics iron law:** only `physics.js` calls `scene.matter.*`. This plan introduces **no new `scene.matter.*` call sites.**
- **`material.type` stays** `'road'` | `'beam'` — do NOT rename to `category`. `target.type`/`_hoverTarget.type` are an unrelated field — never touch them.
- **Registry objects are immutable** — clone before any per-beam or cheat-panel mutation.
- Spec: `docs/superpowers/specs/2026-07-03-material-variety-design.md`. Directional physics numbers are tuned in-app, not computed.
- Run `npm test` at the end of every task. Commit at the end of every task.
- CSV edits: `LEVEL_HEADER`, the parse block, and the serialize array in `levelKnobs.js` must change together; append new columns at the END of the header.

---

## File Structure

**Create:**
- `src/data/materials.js` — the `MATERIALS` registry + `ROAD_MATERIALS`/`BEAM_MATERIALS` + `blocksFor()` + `resolveMaterial()`.
- `src/ui-html/components/MaterialSubmenu.js` — the spring-out material picker.
- `tests/materials.test.js`, `tests/materialSubmenu.test.js` — unit tests.

**Modify:**
- `src/data/leveldata.js` — `roadMat`/`woodMat` become registry adapters.
- `src/systems/physics.js` — read `material.visual`/`thickness` only where beams render (no physics-body change); `updateBeamMaterial` clones.
- `src/scenes/LevelScene.js` — single `_budget`; material selection via submenu; render from `visual`; save/load id.
- `src/utils/prebuilt.js` — `expandPrebuilt` returns single `cost` number; resolve material by id.
- `src/systems/saveload.js` — persist `material.id`, `version: 2`.
- `src/data/levelKnobs.js` — `budget_total` column; budget merge to `{ total }`.
- `src/ui-html/components/BudgetChip.js` + `TopBar.js` — one total chip.
- `src/ui/GhostBeam.js` — ghost color/thickness from `visual`.
- `gdd/levels.csv` + `scripts/genLevels.mjs` outputs — `budget_total`.
- Tests: `tests/levels.test.js`, `tests/prebuilt.test.js`, `tests/roundtrip.test.js`, `tests/saveload.test.js`, `tests/ui-html/BudgetChip.test.js`, `tests/Toolbar.test.js`.

---

# Phase 1 — Material registry

### Task 1: Create the `MATERIALS` registry

**Files:**
- Create: `src/data/materials.js`
- Test: `tests/materials.test.js`

**Interfaces:**
- Produces:
  - `MATERIALS: Record<string, Material>` where `Material = { id, name, type:'road'|'beam', cost, stiffness, snapThreshold, blocks, visual, thickness? }`
  - `ROAD_MATERIALS: Material[]`, `BEAM_MATERIALS: Material[]`
  - `blocksFor(type: 'road'|'beam'): Record<'S'|'M'|'L'|'XL', {length, cost}>`
  - `resolveMaterial(idOrLegacy: string): Material` — maps `'road'→asphalt`, `'wood'→wood`, else `MATERIALS[id]`
  - `cloneMaterial(m: Material): Material` — shallow clone (for mutation safety)

- [ ] **Step 1: Write the failing test**

```js
// tests/materials.test.js
import { describe, it, expect } from 'vitest';
import { MATERIALS, ROAD_MATERIALS, BEAM_MATERIALS, resolveMaterial, cloneMaterial } from '../src/data/materials.js';

describe('materials registry', () => {
  it('has 3 roads and 3 beams', () => {
    expect(ROAD_MATERIALS.map(m => m.id).sort()).toEqual(['asphalt', 'concrete', 'dirt']);
    expect(BEAM_MATERIALS.map(m => m.id).sort()).toEqual(['rope', 'steel', 'wood']);
  });
  it('every material has required fields and correct partition', () => {
    for (const m of Object.values(MATERIALS)) {
      expect(typeof m.id).toBe('string');
      expect(typeof m.name).toBe('string');
      expect(['road', 'beam']).toContain(m.type);
      expect(typeof m.cost).toBe('number');
      expect(typeof m.stiffness).toBe('number');
      expect(typeof m.snapThreshold).toBe('number');
      expect(m.blocks.M).toBeTruthy();
      expect(typeof m.visual.base).toBe('number');
    }
  });
  it('resolveMaterial maps legacy keys', () => {
    expect(resolveMaterial('road')).toBe(MATERIALS.asphalt);
    expect(resolveMaterial('wood')).toBe(MATERIALS.wood);
    expect(resolveMaterial('concrete')).toBe(MATERIALS.concrete);
  });
  it('cloneMaterial does not mutate the registry', () => {
    const c = cloneMaterial(MATERIALS.wood);
    c.stiffness = 999;
    expect(MATERIALS.wood.stiffness).not.toBe(999);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- materials`
Expected: FAIL — cannot find module `../src/data/materials.js`.

- [ ] **Step 3: Write the registry**

```js
// src/data/materials.js
// Single source of truth for buildable materials. `type` is the drivability
// discriminator (road = drivable deck + collision body; beam = structural brace,
// no collision body). Registry objects are IMMUTABLE — clone before mutating.
const BLOCK_LEN = { S: 40, M: 80, L: 160, XL: 240 };
const ROAD_COST = { S: 2, M: 4, L: 8, XL: 12 };
const WOOD_COST = { S: 1, M: 2, L: 4, XL: 6 };

export function blocksFor(type, sizes = ['S', 'M', 'L', 'XL']) {
  const costTable = type === 'road' ? ROAD_COST : WOOD_COST;
  return Object.fromEntries(sizes.map(s => [s, { length: BLOCK_LEN[s], cost: costTable[s] }]));
}

export const MATERIALS = {
  dirt:     { id: 'dirt', name: 'Dirt', type: 'road', cost: 1, stiffness: 0.05, snapThreshold: 0.018,
              blocks: blocksFor('road'), visual: { base: 0x8a6a3e, edgeTop: 0x9c7a4a, edgeBottom: 0x6b4f2c, motif: 'speckle', centerLine: false } },
  asphalt:  { id: 'asphalt', name: 'Asphalt', type: 'road', cost: 4, stiffness: 0.08, snapThreshold: 0.025,
              blocks: blocksFor('road'), visual: { base: 0x3b4047, edgeTop: 0x4c535b, edgeBottom: 0x23262a, motif: 'speckle', centerLine: true } },
  concrete: { id: 'concrete', name: 'Concrete', type: 'road', cost: 6, stiffness: 0.14, snapThreshold: 0.05,
              blocks: blocksFor('road'), visual: { base: 0xb8bcc2, edgeTop: 0xcfd3d8, edgeBottom: 0x95999f, motif: 'speckle', centerLine: true } },
  rope:     { id: 'rope', name: 'Rope', type: 'beam', cost: 1, stiffness: 0.06, snapThreshold: 0.30, thickness: 5,
              blocks: blocksFor('beam'), visual: { base: 0xc8a86a, edgeTop: 0xdcc088, edgeBottom: 0xa5824a, motif: 'twist' } },
  wood:     { id: 'wood', name: 'Wood', type: 'beam', cost: 1, stiffness: 0.15, snapThreshold: 0.18,
              blocks: blocksFor('beam'), visual: { base: 0xa9772f, edgeTop: 0xc08f44, edgeBottom: 0x835a20, motif: 'grain' } },
  steel:    { id: 'steel', name: 'Steel', type: 'beam', cost: 5, stiffness: 0.30, snapThreshold: 0.22,
              blocks: blocksFor('beam'), visual: { base: 0x8a94a3, edgeTop: 0xc2ccd8, edgeBottom: 0x5f6875, motif: 'sheen' } },
};

export const ROAD_MATERIALS = Object.values(MATERIALS).filter(m => m.type === 'road');
export const BEAM_MATERIALS = Object.values(MATERIALS).filter(m => m.type === 'beam');

const LEGACY = { road: 'asphalt', wood: 'wood', beam: 'wood' };
export function resolveMaterial(idOrLegacy) {
  return MATERIALS[idOrLegacy] ?? MATERIALS[LEGACY[idOrLegacy]] ?? MATERIALS.asphalt;
}
export function cloneMaterial(m) {
  return { ...m, blocks: { ...m.blocks }, visual: { ...m.visual } };
}
```

> Note: `asphalt`/`wood` keep today's exact `stiffness`/`snapThreshold`/cost (from `leveldata.js:18,25` and `BLOCK_LEN`/`*_COST`) so existing levels are byte-identical.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- materials`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/data/materials.js tests/materials.test.js
git commit -m "feat(materials): add MATERIALS registry (3 roads + 3 beams)"
```

---

### Task 2: Point `roadMat`/`woodMat` at the registry (back-compat adapters)

**Files:**
- Modify: `src/data/leveldata.js:16-28`
- Test: `tests/roundtrip.test.js` (existing — must still pass)

**Interfaces:**
- Consumes: `MATERIALS`, `cloneMaterial`, `blocksFor` from Task 1.
- Produces: `roadMat(sizes?)`/`woodMat(sizes?)` returning registry-backed material objects (cloned when `sizes` given).

- [ ] **Step 1: Replace the two builders**

In `src/data/leveldata.js`, replace the `BLOCK_LEN`/`ROAD_COST`/`WOOD_COST` consts and `roadMat`/`woodMat` (lines 12-28) with:

```js
import { MATERIALS, cloneMaterial, blocksFor } from './materials.js';

function roadMat(sizes) {
  if (!sizes) return MATERIALS.asphalt;
  const m = cloneMaterial(MATERIALS.asphalt);
  m.blocks = blocksFor('road', sizes);
  return m;
}
function woodMat(sizes) {
  if (!sizes) return MATERIALS.wood;
  const m = cloneMaterial(MATERIALS.wood);
  m.blocks = blocksFor('beam', sizes);
  return m;
}
```

(Keep the `WATER_Y` const that was on line 11.)

- [ ] **Step 2: Run the full suite**

Run: `npm test`
Expected: PASS — `roundtrip.test.js` deep-equals all 12 levels; asphalt/wood are unchanged so levels are identical. If a level used `roadMat(['L'])` etc., the cloned blocks match the old output.

- [ ] **Step 3: Verify the generated data still builds**

Run: `npm run gen:levels`
Expected: no diff in `src/data/levelOverrides.generated.js` (materials are size-lists only, unaffected).

- [ ] **Step 4: Commit**

```bash
git add src/data/leveldata.js
git commit -m "refactor(materials): roadMat/woodMat delegate to registry"
```

---

# Phase 2 — Single budget pool

> Converts the two pools `_budgetRoad`/`_budgetWood` into one `_budget`. Do this as one task — the sites are interdependent and only make sense together.

### Task 3: Collapse `expandPrebuilt` cost to a single number

**Files:**
- Modify: `src/utils/prebuilt.js`
- Test: `tests/prebuilt.test.js`

**Interfaces:**
- Consumes: `resolveMaterial` (Task 1).
- Produces: `expandPrebuilt(level)` returns `{ joints, beams, cost: number }` (was `cost: {road, wood}`).

- [ ] **Step 1: Update the test**

In `tests/prebuilt.test.js`, change any assertion reading `cost.road`/`cost.wood` to the single number. Add:

```js
it('returns a single numeric prebuilt cost', () => {
  const level = { prebuilt: { joints: [{id:'p1',x:0,y:0}], beams: [{a:'L',b:'p1',material:'road',size:'M'}] },
                  materials: {} };
  const { cost } = expandPrebuilt(level);
  expect(typeof cost).toBe('number');
  expect(cost).toBe(4); // asphalt M block cost
});
```

- [ ] **Step 2: Run it — expect FAIL**

Run: `npm test -- prebuilt`
Expected: FAIL (`cost` is an object).

- [ ] **Step 3: Rewrite `expandPrebuilt`**

```js
// src/utils/prebuilt.js
import { resolveMaterial } from '../data/materials.js';

export function expandPrebuilt(level) {
  const pb = level.prebuilt;
  if (!pb) return { joints: [], beams: [], cost: 0 };
  const joints = pb.joints.map(j => ({ x: j.x, y: j.y, isAnchor: false, bodyId: j.id }));
  let cost = 0;
  const beams = pb.beams.map(b => {
    const mat = level.materials?.[b.material] ?? resolveMaterial(b.material);
    const c = mat.blocks?.[b.size]?.cost ?? mat.cost;
    cost += c;
    return { a: b.a, b: b.b, material: mat, cost: c };
  });
  return { joints, beams, cost };
}
```

- [ ] **Step 4: Run it — expect PASS**

Run: `npm test -- prebuilt`

- [ ] **Step 5: Commit**

```bash
git add src/utils/prebuilt.js tests/prebuilt.test.js
git commit -m "refactor(budget): expandPrebuilt returns single cost"
```

---

### Task 4: Migrate level `budget` schema to `{ total }`

**Files:**
- Modify: `src/data/leveldata.js` (every `budget: { road, wood }` in RAW_LEVELS)
- Modify: `src/data/levelKnobs.js:11-15,71-98,126-143` (CSV column + parse + serialize + merge)
- Modify: `gdd/levels.csv`
- Test: `tests/levels.test.js`, `tests/roundtrip.test.js`

**Interfaces:**
- Produces: `level.budget = { total: number }`. Legacy `{road, wood}` still readable via shim in merge.

- [ ] **Step 1: Add the shim + column to `levelKnobs.js`**

In `LEVEL_HEADER` (line 11-15) append `'budget_total'` at the END. In `parseLevelsCsv`, after the `budget_road`/`budget_wood` block (line 71-77), add:

```js
    const bt = num(at(cells, 'budget_total'));
    if (bt != null) k.budget = { total: bt };
    else if (br != null || bw != null) k.budget = { total: (br ?? 0) + (bw ?? 0) };
```

Remove the old `k.budget = {}` road/wood assignment (replaced above). In `mergeLevelKnobs` (line 30) keep `if (knobs.budget) out.budget = { ...knobs.budget }`. In `serializeLevelsCsv` (line 126-143) append at the END of the row array:

```js
      str(lv.budget?.total),
```

and change the existing `budget_road`/`budget_wood` cells to emit `''` (kept as legacy placeholders) OR drop them from `LEVEL_HEADER` entirely — **choose drop** for cleanliness: remove `'budget_road','budget_wood'` from `LEVEL_HEADER`, their parse lines, and their serialize cells.

- [ ] **Step 2: Add a normalizer for RAW_LEVELS budgets**

In `leveldata.js`, add near the top:

```js
const totalBudget = (b) => (b == null ? undefined : { total: b.total ?? ((b.road ?? 0) + (b.wood ?? 0)) });
```

Wrap each RAW_LEVELS `budget:` with `totalBudget(...)`, OR (simpler, fewer edits) run a one-time pass in the `ALL_LEVELS` builder that maps every level's `budget` through `totalBudget`. Prefer the builder pass so `roundtrip.test.js` compares normalized-to-normalized.

- [ ] **Step 3: Update `gdd/levels.csv`**

Run `npm run export:levels` to regenerate the CSV from the normalized RAW_LEVELS (now emits `budget_total`). Confirm the header matches `LEVEL_HEADER`.

- [ ] **Step 4: Update `tests/levels.test.js`**

Replace assertions on `l.budget.road`/`l.budget.wood` with `l.budget.total`. For the L05/L06 intended-failure math, sum into `total`.

- [ ] **Step 5: Run the suite**

Run: `npm test`
Expected: PASS. `roundtrip.test.js` passes because RAW_LEVELS and overrides both normalize to `{ total }`.

- [ ] **Step 6: Commit**

```bash
git add src/data/leveldata.js src/data/levelKnobs.js gdd/levels.csv tests/levels.test.js
git commit -m "refactor(budget): level budget schema -> { total }"
```

---

### Task 5: Single `_budget` pool in LevelScene

**Files:**
- Modify: `src/scenes/LevelScene.js` — lines `137, 228-231, 675-677, 694, 708-709, 727, 793, 811-814, 835, 897-898, 1443-1444, 1551-1556, 1644, 1701`
- Test: add `tests/budget.test.js` (headless accounting via a thin harness) OR cover through existing `levels.test.js`

**Interfaces:**
- Produces: `this._budget: number`; `budget:update` payload `{ total: number }`.

- [ ] **Step 1: Replace pool init**

`:228-231` — replace:
```js
    this._budgetRoad = _fresh0.road;
    this._budgetWood = _fresh0.wood;
```
with:
```js
    this._budget = _fresh0.total;
```

`_freshBudget()` (`:1551-1556`) — return `{ total: level.budget.total - prebuiltCostTotal }` (prebuilt cost is now a single number from Task 3). Update `this._prebuiltCost` (`:137`) to a number.

- [ ] **Step 2: Replace every pool read/write**

At `:675-677`, `:694`, `:708-709`, `:727`, `:793`, `:897-898`, `:1443-1444`, `:1644`: replace the `const pool = mat.type === 'road' ? '_budgetRoad' : '_budgetWood'` pattern and `this[pool]` usages with direct `this._budget`. Example for `_handleFreeformClick` (`:674-695`):

```js
      const cost = this.material.cost;
      if (this._budget < cost) { this._flashBudget(); this.pendingJointA = null; return; }
      // …place beam…
      this._budget -= cost;
      this._updateBudgetDisplay();
```

At `:1701` replace `budgetLeft: this._budgetRoad + this._budgetWood` with `budgetLeft: this._budget`.

- [ ] **Step 3: Emit a single total**

`_updateBudgetDisplay` (around `:811-814`) — emit:
```js
    bus.emit('budget:update', { total: this._budget });
```

`_flashBudget` (`:835`) — drop the `materialType` arg; emit `bus.emit('budget:flash')` with no payload.

- [ ] **Step 4: Run suite + smoke**

Run: `npm test` then `npm run dev`, play L03 (has wood): place road + wood, confirm one budget number decrements for both and never goes negative; undo restores it.

- [ ] **Step 5: Commit**

```bash
git add src/scenes/LevelScene.js
git commit -m "refactor(budget): single _budget pool in LevelScene"
```

---

### Task 6: One total BudgetChip

**Files:**
- Modify: `src/ui-html/components/BudgetChip.js`, `src/ui-html/components/TopBar.js`
- Test: `tests/ui-html/BudgetChip.test.js`

- [ ] **Step 1: Update the test**

Assert the chip renders `payload.total` and flashes on a payload-less `budget:flash`:

```js
bus.emit('budget:update', { total: 250 });
expect(chip.querySelector('.budget-num').textContent).toBe('250');
```

- [ ] **Step 2: Simplify BudgetChip**

Rewrite `BudgetChip()` to take no `type`, label `BUDGET`, use a coin/star icon, read `payload.total`, and flash on any `budget:flash`:

```js
export function BudgetChip() {
  const root = document.createElement('div');
  root.className = 'budget-chip budget-chip--total';
  // …label 'BUDGET', num, star icon…
  bus.on('budget:update', (p) => { num.textContent = p?.total != null ? String(p.total) : '0'; });
  bus.on('budget:flash', () => {
    root.classList.add('budget-chip--flash');
    root.addEventListener('animationend', () => root.classList.remove('budget-chip--flash'), { once: true });
  });
  return root;
}
```

Add a `.budget-chip--total { --chip-accent: var(--green); }` rule in `components.css`; retire `--road`/`--wood`.

- [ ] **Step 3: One chip in TopBar**

`TopBar.js:32-35` — replace the two chips with `const chip = BudgetChip(); root.appendChild(chip);`. In the `ui:config` handler (`:56-63`) toggle just `chip.style.display`.

- [ ] **Step 4: Run + commit**

Run: `npm test -- BudgetChip`

```bash
git add src/ui-html/components/BudgetChip.js src/ui-html/components/TopBar.js src/ui-html/styles/components.css tests/ui-html/BudgetChip.test.js
git commit -m "feat(ui): single total budget chip"
```

---

# Phase 3 — Per-material rendering

### Task 7: Render deck/beam/debris/ghost from `material.visual`

**Files:**
- Modify: `src/scenes/LevelScene.js` — `redrawBeams` (~`:960-1050`), `drawRoads` (`:567-586`), `_spawnDebris` (`:1218-1219`)
- Modify: `src/ui/GhostBeam.js:146`
- Test: manual (canvas rendering) + a small pure-helper unit test

**Interfaces:**
- Produces: `drawBeamVisual(g, x0, y0, x1, y1, material, opts)` — a pure-ish helper on LevelScene (or a new `src/utils/materialRender.js`) that paints the 3-tone body + motif from `material.visual`.

- [ ] **Step 1: Extract a motif renderer** into `src/utils/materialRender.js` mirroring the validated mockup (`.superpowers/brainstorm/…/materials-visuals.html` `draw()`), with a unit test that it reads `visual.base/edgeTop/edgeBottom/motif` and calls the passed graphics stub the expected number of times for each motif (`speckle`,`grain`,`sheen`,`twist`). Keep motifs bold/high-contrast.

- [ ] **Step 2: Wire `redrawBeams`** to call the renderer with `beam.material` instead of the hardcoded `isRoad ? asphalt : wood` colors. Thickness for beams comes from `beam.material.thickness ?? default`.

- [ ] **Step 3: Wire `drawRoads`** cliff strip to the starting road material's `visual` (find it from the level's offered road set / default asphalt).

- [ ] **Step 4: `_spawnDebris`** — `const color = (c.material?.visual?.base) ?? (c.material?.type === 'road' ? 0x3a3a3a : 0x7a5c2e);`

- [ ] **Step 5: `GhostBeam.js:146`** — derive ghost tint from `material.visual.base` and thickness from `material.thickness`.

- [ ] **Step 6: Manual verify** — `npm run dev`, place all 6 materials, confirm each is visually distinct and reads on-style; commit.

```bash
git add src/utils/materialRender.js src/scenes/LevelScene.js src/ui/GhostBeam.js tests/materialRender.test.js
git commit -m "feat(render): per-material visuals (dirt/asphalt/concrete/rope/wood/steel)"
```

---

# Phase 4 — Submenu UI

### Task 8: `MaterialSubmenu` component

**Files:**
- Create: `src/ui-html/components/MaterialSubmenu.js`, styles in `components.css`
- Modify: `src/ui-html/components/Toolbar.js` (toggle submenu on road/beam), `src/scenes/LevelScene.js` (handle `material:select`)
- Test: `tests/materialSubmenu.test.js`

**Interfaces:**
- Consumes: bus events `materials:show { type, list, current }` (scene→UI), emits `material:select { id }` (UI→scene).
- Produces: DOM submenu matching the approved mockup (`.superpowers/brainstorm/…/toolbar-submenu.html`).

- [ ] **Step 1: Failing test** — mounting the submenu and emitting `materials:show` renders one tile per material with its `$cost`; clicking a tile emits `material:select` with the id.

- [ ] **Step 2: Implement `MaterialSubmenu(root)`** — white card floating above the active toolbar tile, spring-in/pop-out animation (reuse the mockup's CSS keyframes), canvas swatch per material (call `materialRender`), name + gold `$cost`, active state, hover tooltip, header showing active unit price. Auto-select the current material; if `list.length === 1`, still render (all-available means 3, so this branch is defensive).

- [ ] **Step 3: Toolbar toggle** — in `Toolbar.js`, when `tool:select` is `road`/`beam`, emit `materials:show` with `ROAD_MATERIALS`/`BEAM_MATERIALS` and the scene's current pick; clicking the same tile again closes it. Keep NODES/REMOVE/etc. behavior.

- [ ] **Step 4: LevelScene handler** — register `material:select` in `_busHandlers` (`:296-307`) and `bus.off` it in `shutdown` (`:332-343`). On select, set `this.material = resolveMaterial(id)` (clone if it will be tuned), update the size row (`sizes:show` from the chosen material's `blocks`), and re-emit active state.

- [ ] **Step 5: Mount** in `src/ui-html/index.js` alongside the other components.

- [ ] **Step 6: Run + manual** — `npm test`, then `npm run dev`: ROAD/BEAM springs the submenu, pick flows to size row, budget flashes; commit.

```bash
git add src/ui-html/components/MaterialSubmenu.js src/ui-html/components/Toolbar.js src/ui-html/index.js src/scenes/LevelScene.js src/ui-html/styles/components.css tests/materialSubmenu.test.js
git commit -m "feat(ui): material submenu picker off ROAD/BEAM tiles"
```

---

# Phase 5 — Save/load migration

### Task 9: Persist `material.id`, load with legacy shim

**Files:**
- Modify: `src/systems/saveload.js:11`, `src/scenes/LevelScene.js:1806-1808`
- Test: `tests/saveload.test.js`

**Interfaces:**
- Produces: save `version: 2`, beams store `material: b.material.id`. Load resolves via `resolveMaterial`.

- [ ] **Step 1: Update test** — a saved beam persists `material: 'concrete'`; loading an old `version:1` save with `material:'road'` resolves to asphalt.

```js
it('persists material id and shims legacy road/wood', () => {
  saveLayout('L01', joints, [{ a, b, material: { id: 'concrete', type: 'road' } }], null);
  const data = loadLayout('L01');
  expect(data.beams[0].material).toBe('concrete');
});
```

- [ ] **Step 2: `saveload.js:11`** — `material: b.material.id` and bump `version: 2`.

- [ ] **Step 3: `LevelScene.js:1806-1808`** — replace the `savedBeam.material === 'road' ? … : wood` branch with `const mat = resolveMaterial(savedBeam.material);` (handles both new ids and legacy `'road'`/`'wood'`).

- [ ] **Step 4: Run + manual** — `npm test`; `npm run dev`, build a mixed bridge, SAVE, reload page, LOAD, confirm materials restore correctly; commit.

```bash
git add src/systems/saveload.js src/scenes/LevelScene.js tests/saveload.test.js
git commit -m "feat(saveload): persist material.id with legacy shim (v2)"
```

---

### Task 10: Showcase level + docs

**Files:**
- Modify: `gdd/levels.csv` (one M3 level's budget so multiple materials are affordable), `CLAUDE.md` (Beam/Material section note), `docs/LEVEL_AUTHORING.md` (materials registry pointer)

- [ ] **Step 1:** Pick an existing M3 level; set its `budget_total` so a player can choose between cheap-weak and pricey-strong. `npm run gen:levels`, play it, confirm the trade-off reads.
- [ ] **Step 2:** Add a short "Materials" subsection to `CLAUDE.md` pointing at `src/data/materials.js` and noting `type` is the drivability discriminator and the registry is immutable.
- [ ] **Step 3:** Commit.

```bash
git add gdd/levels.csv src/data/levelOverrides.generated.js CLAUDE.md docs/LEVEL_AUTHORING.md
git commit -m "docs+level: showcase material trade-off, document registry"
```

---

## Self-Review

**Spec coverage:** §2 lineup → Task 1. §3 registry/type-kept/immutability → Tasks 1,2,8. §4 physics-untouched → confirmed (no physics task). §5 single budget → Tasks 3-6. §6 rendering → Task 7. §7 submenu → Task 8. §8 save/load → Task 9. §10 testing → each task's tests + updated files. §11 CSV → Task 4. §13 review dispositions → each mapped. No gaps.

**Placeholder scan:** Task 5/7/8 reference exact line numbers and show the transformation pattern rather than re-listing all ~10 identical pool sites — acceptable because the pattern is shown once and the sites are enumerated by line. No "TBD"/"handle edge cases" present.

**Type consistency:** `resolveMaterial`, `cloneMaterial`, `blocksFor`, `MATERIALS`, `ROAD_MATERIALS`/`BEAM_MATERIALS` used consistently across Tasks 1,2,3,8,9. `budget:update` payload `{ total }` consistent across Tasks 5,6. `material:select { id }` / `materials:show { type, list, current }` consistent across Task 8.
