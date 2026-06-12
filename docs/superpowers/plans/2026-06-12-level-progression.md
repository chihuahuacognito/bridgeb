# Level Progression System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 12-level PolyBridge-style progression (3 tutorials, 6 topic levels, 3 challenges) with a level-select menu, data-driven tutorial cards, per-level UI simplification, prebuilt bridges, and vehicle enforcement.

**Architecture:** All difficulty lives in `data/leveldata.js` (compressed via local helper functions). New `MenuScene` selects levels; new `systems/tutorial.js` singleton renders cards into `#ui-modals`; per-level UI visibility flows over the existing bus as a new `ui:config` event consumed by the boot-mounted HTML chrome. Pure logic (prebuilt expansion, vehicle resolution, hint gating) is extracted into testable modules.

**Tech Stack:** Phaser 3.90, Matter.js (via Phaser), Vite, Vitest (jsdom), existing `ui-html` DOM chrome + bus.

**Spec:** `docs/superpowers/specs/2026-06-12-level-progression-design.md`

---

## File Structure

| File | Action | Responsibility |
|---|---|---|
| `src/data/leveldata.js` | Rewrite | Helpers + `L01`–`L12`, `LEVEL_ORDER`, `menuEntries()`, `DEV_STRESS` kept |
| `src/utils/prebuilt.js` | Create | `expandPrebuilt(level)` — pure prebuilt-bridge expansion + cost |
| `src/utils/vehicleDesign.js` | Create | `resolveVehicleDesign(level, presets, selectedKey)` — pure |
| `src/systems/tutorial.js` | Create | Card singleton (`attach/detach/reset`), `shouldShowHint()` |
| `src/ui-html/components/ResultModal.js` | Create | Win modal (Try Again / Next / Menu) |
| `src/ui-html/components/TopBar.js` | Modify | `ui:config` → hide budget chip |
| `src/ui-html/components/Toolbar.js` | Modify | `ui:config` → tool whitelist; enable REMOVE tile |
| `src/ui-html/index.js` | Modify | Mount ResultModal; `ui:config` sidebar hide; `ui:screen` class |
| `src/ui-html/styles/index.css` | Modify | Append menu-screen, result-modal, tutorial-card rules |
| `src/scenes/MenuScene.js` | Create | Level-select grid from `LEVEL_ORDER` |
| `src/scenes/BootScene.js` | Modify | Drop inline menu; go straight to MenuScene |
| `src/main.js` | Modify | Register MenuScene |
| `src/scenes/LevelScene.js` | Modify | ui guards, prebuilt, vehicle enforcement, remove tool, tutorial hooks, win flow, nav |
| `tests/levels.test.js` | Create | Level data validation |
| `tests/prebuilt.test.js` | Create | Prebuilt expansion |
| `tests/vehicleDesign.test.js` | Create | Vehicle resolution |
| `tests/tutorial.test.js` | Create | Hint gating + card DOM |
| `tests/ui-html/uiconfig.test.js` | Create | `ui:config` visibility behavior |

Run all tests with `npm test`; single file with `npx vitest run tests/<file>`.

---

### Task 1: Level data — helpers, L01–L12, LEVEL_ORDER

**Files:**
- Modify: `src/data/leveldata.js` (full rewrite; keep `DEV_STRESS` verbatim)
- Test: `tests/levels.test.js`

- [ ] **Step 1: Write the failing test**

```js
// tests/levels.test.js
import { describe, it, expect } from 'vitest';
import { ALL_LEVELS, LEVEL_ORDER, menuEntries, DEV_STRESS } from '../src/data/leveldata.js';

const SIZES = ['S', 'M', 'L', 'XL'];
const PHASES = ['tutorial', 'topic', 'challenge'];
const VEHICLE_TYPES = ['car', 'truck', 'tank'];

describe('LEVEL_ORDER', () => {
  it('lists exactly 12 unique level ids, all present in ALL_LEVELS', () => {
    expect(LEVEL_ORDER).toHaveLength(12);
    expect(new Set(LEVEL_ORDER).size).toBe(12);
    for (const id of LEVEL_ORDER) expect(ALL_LEVELS[id], id).toBeDefined();
  });

  it('does not include DEV_STRESS', () => {
    expect(LEVEL_ORDER).not.toContain('DEV_STRESS');
    expect(ALL_LEVELS.DEV_STRESS).toBe(DEV_STRESS); // still reachable for the dev flag
  });

  it('phases run tutorial ×3, topic ×6, challenge ×3 in order', () => {
    const phases = LEVEL_ORDER.map(id => ALL_LEVELS[id].phase);
    expect(phases).toEqual([
      'tutorial', 'tutorial', 'tutorial',
      'topic', 'topic', 'topic', 'topic', 'topic', 'topic',
      'challenge', 'challenge', 'challenge',
    ]);
  });
});

describe('every progression level', () => {
  for (const id of ['L01','L02','L03','L04','L05','L06','L07','L08','L09','L10','L11','L12']) {
    describe(id, () => {
      const lvl = () => ALL_LEVELS[id];

      it('has core fields', () => {
        const l = lvl();
        expect(l.id).toBe(id);
        expect(typeof l.title).toBe('string');
        expect(PHASES).toContain(l.phase);
        expect(l.budget).toBeGreaterThan(0);
        expect(l.worldWidth).toBe(1280);
        expect(l.worldHeight).toBe(720);
        expect(l.terrain.left.verts.length).toBeGreaterThanOrEqual(3);
        expect(l.terrain.right.verts.length).toBeGreaterThanOrEqual(3);
        expect(l.terrain.waterY).toBeGreaterThan(0);
      });

      it('has left + right anchors matching terrain tops', () => {
        const l = lvl();
        const left = l.anchors.find(a => a.side === 'left');
        const right = l.anchors.find(a => a.side === 'right');
        expect(left).toBeDefined();
        expect(right).toBeDefined();
        expect(right.x).toBeGreaterThan(left.x);
      });

      it('vehicles is a non-empty array of known types', () => {
        const l = lvl();
        expect(Array.isArray(l.vehicles)).toBe(true);
        expect(l.vehicles.length).toBeGreaterThan(0);
        for (const v of l.vehicles) expect(VEHICLE_TYPES).toContain(v.type);
      });

      it('materials blocks use known sizes with positive cost/length', () => {
        const l = lvl();
        for (const mat of Object.values(l.materials)) {
          for (const [size, b] of Object.entries(mat.blocks)) {
            expect(SIZES).toContain(size);
            expect(b.length).toBeGreaterThan(0);
            expect(b.cost).toBeGreaterThan(0);
          }
        }
      });

      it('prebuilt (if any) references existing joints/anchors and valid sizes', () => {
        const l = lvl();
        if (!l.prebuilt) return;
        const ids = new Set([
          ...l.anchors.map(a => a.id),
          ...(l.rocks ?? []).flatMap(r => (r.anchors ?? []).map(a => a.id)),
          ...l.prebuilt.joints.map(j => j.id),
        ]);
        for (const b of l.prebuilt.beams) {
          expect(ids.has(b.a), `${id} prebuilt beam a=${b.a}`).toBe(true);
          expect(ids.has(b.b), `${id} prebuilt beam b=${b.b}`).toBe(true);
          const mat = l.materials[b.material === 'road' ? 'road' : 'wood'];
          expect(mat.blocks[b.size], `${id} size ${b.size}`).toBeDefined();
        }
      });

      it('ui.tools (if present) only names real tools', () => {
        const l = lvl();
        if (!l.ui?.tools) return;
        for (const t of l.ui.tools) {
          expect(['road', 'beam', 'free', 'remove']).toContain(t);
        }
      });
    });
  }
});

describe('intended-failure budget direction (spec: L05/L06)', () => {
  it('L05 budget is below a pillar-free brute-force deck (2 stacked decks of road)', () => {
    const l = ALL_LEVELS.L05;
    const left = l.anchors.find(a => a.side === 'left');
    const right = l.anchors.find(a => a.side === 'right');
    const gap = right.x - left.x;
    const lBlock = l.materials.road.blocks.L;
    const oneDeck = Math.ceil(gap / lBlock.length) * lBlock.cost;
    expect(l.budget).toBeLessThan(oneDeck * 2);
  });

  it('L06 budget cannot afford doubling the prebuilt deck in road', () => {
    const l = ALL_LEVELS.L06;
    const deckCost = l.prebuilt.beams
      .filter(b => b.material === 'road')
      .reduce((s, b) => s + l.materials.road.blocks[b.size].cost, 0);
    // budget is net-of-prebuilt at runtime; gross budget minus prebuilt must be < a second deck
    expect(l.budget - deckCost).toBeLessThan(deckCost);
  });
});

describe('menuEntries', () => {
  it('maps LEVEL_ORDER to {id, title, phase}', () => {
    const entries = menuEntries(ALL_LEVELS, LEVEL_ORDER);
    expect(entries).toHaveLength(12);
    expect(entries[0]).toEqual({
      id: LEVEL_ORDER[0],
      title: ALL_LEVELS[LEVEL_ORDER[0]].title,
      phase: 'tutorial',
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/levels.test.js`
Expected: FAIL — `LEVEL_ORDER` is not exported.

- [ ] **Step 3: Rewrite `src/data/leveldata.js`**

Keep the existing `DEV_STRESS` export byte-for-byte. Replace the rest of the file with:

```js
// src/data/leveldata.js
// Per spec §2 rule 3: level.vehicles is ALWAYS an array.
// Spec: docs/superpowers/specs/2026-06-12-level-progression-design.md

const WATER_Y = 660;
const BLOCK_LEN  = { S: 40, M: 80, L: 160, XL: 240 };
const ROAD_COST  = { S: 2,  M: 4,  L: 8,   XL: 12 };
const WOOD_COST  = { S: 1,  M: 2,  L: 4,   XL: 6 };

function roadMat(sizes = ['S', 'M', 'L', 'XL']) {
  return {
    type: 'road', cost: 2, stiffness: 0.08, snapThreshold: 0.025,
    blocks: Object.fromEntries(sizes.map(s => [s, { length: BLOCK_LEN[s], cost: ROAD_COST[s] }])),
  };
}

function woodMat(sizes = ['S', 'M', 'L', 'XL']) {
  return {
    type: 'beam', cost: 1, stiffness: 0.15, snapThreshold: 0.18,
    blocks: Object.fromEntries(sizes.map(s => [s, { length: BLOCK_LEN[s], cost: WOOD_COST[s] }])),
  };
}

// Canyon walls flanking a gap. Edge x positions are where the anchors sit.
function terrainPair(leftEdgeX, rightEdgeX, leftTopY = 360, rightTopY = 360) {
  return {
    left: {
      verts: [
        { x: 0,             y: leftTopY },
        { x: leftEdgeX,     y: leftTopY },
        { x: leftEdgeX,     y: leftTopY + 140 },
        { x: leftEdgeX - 100, y: leftTopY + 200 },
        { x: 0,             y: leftTopY + 200 },
      ],
      physRect: { x: leftEdgeX / 2, y: leftTopY + 100, width: leftEdgeX, height: 200 },
      color: 0x2c3033,
    },
    right: {
      verts: [
        { x: rightEdgeX,       y: rightTopY },
        { x: 1280,             y: rightTopY },
        { x: 1280,             y: rightTopY + 200 },
        { x: rightEdgeX + 100, y: rightTopY + 200 },
        { x: rightEdgeX,       y: rightTopY + 140 },
      ],
      physRect: { x: (1280 + rightEdgeX) / 2, y: rightTopY + 100, width: 1280 - rightEdgeX, height: 200 },
      color: 0x2c3033,
    },
    waterY: WATER_Y,
  };
}

function spanAnchors(leftEdgeX, rightEdgeX, leftTopY = 360, rightTopY = 360) {
  return [
    { id: 'L', x: leftEdgeX,  y: leftTopY,  side: 'left' },
    { id: 'R', x: rightEdgeX, y: rightTopY, side: 'right' },
  ];
}

// Tapered mid-chasm rock pillar with two attachable top anchors.
function pillar(id, cx, topY) {
  return {
    id, sprite: 'rock-pillar',
    verts: [
      { x: cx - 38, y: topY }, { x: cx + 38, y: topY },
      { x: cx + 60, y: 720 },  { x: cx - 60, y: 720 },
    ],
    physRect: { x: cx, y: (topY + 720) / 2, width: 120, height: 720 - topY },
    color: 0x8b6a2e,
    anchors: [
      { id: `${id}_L`, x: cx - 38, y: topY },
      { id: `${id}_R`, x: cx + 38, y: topY },
    ],
  };
}

function level(def) {
  return {
    worldWidth: 1280, worldHeight: 720,
    gravity: { y: 1.5, label: 'Normal' },
    rocks: [],
    ...def,
  };
}

// ── Phase 1 — Tutorials ─────────────────────────────────────────────────────

export const L01 = level({
  id: 'L01', title: 'Make It Reach', phase: 'tutorial',
  span: 1.6, budget: 8,
  terrain: terrainPair(560, 720),
  anchors: spanAnchors(560, 720),
  vehicles: [{ type: 'car', spawnAt: 'left' }],
  materials: { road: roadMat(['L']) },
  ui: { budgetMeter: false, delete: false, vehicleSelect: false, tools: ['road'] },
  tutorial: {
    intro:   { icon: '👆', text: 'Tap between the red dots!' },
    hint:    { icon: '👆', text: 'Tap the gap to place a beam.' },
    success: { text: 'You built a bridge!' },
  },
});

export const L02 = level({
  id: 'L02', title: 'Try Again!', phase: 'tutorial',
  span: 3.2, budget: 40,
  terrain: terrainPair(480, 800),
  anchors: spanAnchors(480, 800),
  // Heavier-than-car design weight so a flat 2–3 segment deck is guaranteed to snap.
  vehicles: [{ type: 'car', spawnAt: 'left', design: { weight: 6, speed: 7, acceleration: 5 } }],
  materials: { road: roadMat(['M', 'L']) },
  ui: { budgetMeter: false, delete: false, vehicleSelect: false, tools: ['road'] },
  tutorial: {
    intro:   { icon: '🌉', text: 'Build across — then press TEST.' },
    hint:    { icon: '💪', text: 'It broke! Add more beams and try again.' },
    success: { text: 'Falling down is how we learn!' },
  },
});

export const L03 = level({
  id: 'L03', title: "Builder's Tools", phase: 'tutorial',
  span: 3.2, budget: 60,
  terrain: terrainPair(480, 800),
  anchors: spanAnchors(480, 800),
  vehicles: [{ type: 'car', spawnAt: 'left' }],
  materials: { road: roadMat(), wood: woodMat() },
  ui: { vehicleSelect: false },
  prebuilt: {
    joints: [
      { id: 'p1', x: 560, y: 390 },
      { id: 'p2', x: 700, y: 350 },
    ],
    beams: [
      { a: 'L',  b: 'p1', material: 'road', size: 'M' },
      { a: 'p1', b: 'p2', material: 'road', size: 'L' },
      { a: 'p2', b: 'R',  material: 'road', size: 'M' },
    ],
  },
  tutorial: {
    intro:   { icon: '🗑️', text: 'This bridge is wonky! Use REMOVE, then rebuild it.' },
    hint:    { icon: '🗑️', text: 'Pick REMOVE, tap a crooked beam, then place a better one.' },
    success: { text: 'You fixed it — a real builder!' },
  },
});

// ── Phase 2 — Topic levels ──────────────────────────────────────────────────

export const L04 = level({
  id: 'L04', title: 'Gravity Pulls Down', phase: 'topic',
  span: 4.4, budget: 36,
  terrain: terrainPair(420, 860),
  anchors: spanAnchors(420, 860),
  rocks: [pillar('P1', 640, 530)],
  vehicles: [{ type: 'car', spawnAt: 'left' }],
  materials: { road: roadMat(), wood: woodMat() },
  ui: { vehicleSelect: false },
  tutorial: {
    intro:   { icon: '⬇️', text: 'Gravity pulls everything down. Watch the glow!' },
    hint:    { icon: '🔴', text: 'Red glow = too much force. Build support where it glows.' },
    success: { text: 'You beat gravity!' },
  },
});

export const L05 = level({
  id: 'L05', title: 'Heavier Is Harder', phase: 'topic',
  span: 4.4, budget: 26,
  terrain: terrainPair(420, 860),
  anchors: spanAnchors(420, 860),
  rocks: [pillar('P1', 640, 530)],
  vehicles: [{ type: 'truck', spawnAt: 'left', design: { weight: 6, speed: 4, acceleration: 5 } }],
  materials: { road: roadMat(), wood: woodMat() },
  ui: { vehicleSelect: false },
  tutorial: {
    intro:   { icon: '🚚', text: 'The truck weighs more than the car. What needs to change?' },
    hint:    { icon: '🪨', text: 'The rock in the middle can hold your bridge up.' },
    success: { text: 'Heavy load, strong bridge!' },
  },
});

export const L06 = level({
  id: 'L06', title: 'The Strongest Shape', phase: 'topic',
  span: 4.8, budget: 38,
  terrain: terrainPair(400, 880),
  anchors: spanAnchors(400, 880),
  vehicles: [{ type: 'car', spawnAt: 'left' }],
  // Anti-bypass: only L-size road (no cheap re-segmenting), wood for diagonals.
  materials: { road: roadMat(['L']), wood: woodMat(['S', 'M', 'L']) },
  ui: { vehicleSelect: false },
  prebuilt: {
    joints: [
      { id: 'd1', x: 560, y: 360 },
      { id: 'd2', x: 720, y: 360 },
    ],
    beams: [
      { a: 'L',  b: 'd1', material: 'road', size: 'L' },
      { a: 'd1', b: 'd2', material: 'road', size: 'L' },
      { a: 'd2', b: 'R',  material: 'road', size: 'L' },
    ],
  },
  tutorial: {
    intro:   { icon: '🔺', text: 'Squares squish. Triangles hold! Add slanted beams.' },
    hint:    { icon: '📐', text: 'Try a slanted beam. What shape does it make?' },
    success: { text: 'Triangles are the strongest shape!' },
  },
});

export const L07 = level({
  id: 'L07', title: 'Triangles Everywhere', phase: 'topic',
  span: 5.6, budget: 60,
  terrain: terrainPair(360, 920),
  anchors: spanAnchors(360, 920),
  rocks: [pillar('P1', 640, 530)],
  vehicles: [{ type: 'car', spawnAt: 'left' }],
  materials: { road: roadMat(), wood: woodMat() },
  tutorial: {
    intro:   { icon: '🔺', text: 'Build a whole bridge of triangles!' },
    hint:    { icon: '🔺', text: 'Zig-zag wood beams between the road make triangles.' },
    success: { text: 'A real truss bridge — engineers do this too!' },
  },
});

export const L08 = level({
  id: 'L08', title: 'Balance the Load', phase: 'topic',
  span: 4.0, budget: 55,
  terrain: terrainPair(440, 840, 400, 320),
  anchors: spanAnchors(440, 840, 400, 320),
  rocks: [pillar('P1', 720, 560)],
  vehicles: [{ type: 'truck', spawnAt: 'left', design: { weight: 6, speed: 4, acceleration: 5 } }],
  materials: { road: roadMat(), wood: woodMat() },
  ui: { vehicleSelect: false },
  tutorial: {
    intro:   { icon: '⚖️', text: 'The middle of the bridge carries the most weight.' },
    hint:    { icon: '⚖️', text: 'Build strongest where the bridge glows the most.' },
    success: { text: 'Perfectly balanced!' },
  },
});

export const L09 = level({
  id: 'L09', title: 'Count Your Coins', phase: 'topic',
  span: 4.0, budget: 22,
  terrain: terrainPair(440, 840),
  anchors: spanAnchors(440, 840),
  vehicles: [{ type: 'car', spawnAt: 'left' }],
  materials: { road: roadMat(), wood: woodMat() },
  tutorial: {
    intro:   { icon: '🪙', text: 'Coins are tight! Wood is cheap, road is strong.' },
    hint:    { icon: '🪙', text: 'Big blocks cost more. Where is a small one enough?' },
    success: { text: 'Smart spending — engineering is about trade-offs!' },
  },
});

// ── Phase 3 — Challenge levels ──────────────────────────────────────────────

export const L10 = level({
  id: 'L10', title: 'The Long Crossing', phase: 'challenge',
  span: 7.6, budget: 80,
  terrain: terrainPair(260, 1020),
  anchors: spanAnchors(260, 1020),
  rocks: [pillar('P1', 640, 530)],
  vehicles: [{ type: 'truck', spawnAt: 'left' }],
  materials: { road: roadMat(), wood: woodMat() },
  tutorial: {
    hint:    { icon: '🔺', text: 'Triangles plus the rock pillar — use everything you know.' },
    success: { text: 'The longest crossing yet!' },
  },
});

export const L11 = level({
  id: 'L11', title: 'Heavy Hauler', phase: 'challenge',
  span: 4.8, budget: 60,
  terrain: terrainPair(400, 880),
  anchors: spanAnchors(400, 880),
  vehicles: [{ type: 'tank', spawnAt: 'left', design: { weight: 8, speed: 2, acceleration: 5 } }],
  materials: { road: roadMat(), wood: woodMat() },
  ui: { vehicleSelect: false },
  tutorial: {
    hint:    { icon: '💪', text: 'The tank is the heaviest load there is. Strong beams everywhere it rolls.' },
    success: { text: 'Even the tank made it!' },
  },
});

export const L12 = level({
  id: 'L12', title: 'Master Builder', phase: 'challenge',
  span: 8.0, budget: 90,
  terrain: terrainPair(240, 1040, 380, 300),
  anchors: spanAnchors(240, 1040, 380, 300),
  rocks: [pillar('P1', 520, 560), pillar('P2', 800, 480)],
  vehicles: [{ type: 'truck', spawnAt: 'left', design: { weight: 7, speed: 4, acceleration: 5 } }],
  materials: { road: roadMat(), wood: woodMat() },
  ui: { vehicleSelect: false },
  tutorial: {
    hint:    { icon: '🏆', text: 'Two rocks, two heights — step your bridge across them.' },
    success: { text: 'Master Builder! Can you do it with coins to spare?' },
  },
});

// ── Dev ─────────────────────────────────────────────────────────────────────

export const DEV_STRESS = { /* ←KEEP THE EXISTING DEV_STRESS OBJECT UNCHANGED */ };

export const LEVEL_ORDER = ['L01','L02','L03','L04','L05','L06','L07','L08','L09','L10','L11','L12'];

export const ALL_LEVELS = { L01, L02, L03, L04, L05, L06, L07, L08, L09, L10, L11, L12, DEV_STRESS };

export function menuEntries(allLevels, order) {
  return order.map(id => ({
    id,
    title: allLevels[id].title,
    phase: allLevels[id].phase,
  }));
}
```

The `DEV_STRESS` placeholder above means: paste the current `DEV_STRESS` object from the existing file unchanged (lines 57–126 of the current `leveldata.js`).

> **Note:** the old `L1` export is removed. `tests/leveldata.test.js` and any other test importing `L1` must be updated in this task — change imports of `L1` to `L04` (the closest equivalent: same materials shape, car vehicle) or to `ALL_LEVELS.L04`. Run `npx vitest run` and fix every import error the same way. `src/scenes/LevelScene.js:114` defaults to `'L1'` — change that default to `'L01'` now (one-line edit) so the game still boots.

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/levels.test.js` → PASS.
Run: `npm test` → all suites PASS (after fixing `L1` imports per the note).

- [ ] **Step 5: Commit**

```bash
git add src/data/leveldata.js src/scenes/LevelScene.js tests/
git commit -m "feat(levels): 12-level progression data (L01-L12), LEVEL_ORDER, menuEntries"
```

---

### Task 2: Prebuilt-bridge expansion util

**Files:**
- Create: `src/utils/prebuilt.js`
- Test: `tests/prebuilt.test.js`

- [ ] **Step 1: Write the failing test**

```js
// tests/prebuilt.test.js
import { describe, it, expect } from 'vitest';
import { expandPrebuilt } from '../src/utils/prebuilt.js';
import { ALL_LEVELS } from '../src/data/leveldata.js';

describe('expandPrebuilt', () => {
  it('returns empty result for a level without prebuilt', () => {
    expect(expandPrebuilt(ALL_LEVELS.L01)).toEqual({ joints: [], beams: [], cost: 0 });
  });

  it('expands L03 joints with isAnchor=false and bodyId=id', () => {
    const { joints } = expandPrebuilt(ALL_LEVELS.L03);
    expect(joints).toEqual([
      { x: 560, y: 390, isAnchor: false, bodyId: 'p1' },
      { x: 700, y: 350, isAnchor: false, bodyId: 'p2' },
    ]);
  });

  it('expands beams with resolved material object and per-beam cost', () => {
    const l = ALL_LEVELS.L03;
    const { beams, cost } = expandPrebuilt(l);
    expect(beams).toHaveLength(3);
    expect(beams[0]).toEqual({
      a: 'L', b: 'p1',
      material: l.materials.road,
      cost: l.materials.road.blocks.M.cost,
    });
    const expected = l.prebuilt.beams
      .reduce((s, b) => s + l.materials.road.blocks[b.size].cost, 0);
    expect(cost).toBe(expected);
  });
});
```

- [ ] **Step 2: Run to verify FAIL** — `npx vitest run tests/prebuilt.test.js` → module not found.

- [ ] **Step 3: Implement**

```js
// src/utils/prebuilt.js
// Pure expansion of a level's `prebuilt` block into scene-shaped joints/beams
// plus the total cost (deducted from the level budget at runtime).
export function expandPrebuilt(level) {
  const pb = level.prebuilt;
  if (!pb) return { joints: [], beams: [], cost: 0 };

  const joints = pb.joints.map(j => ({ x: j.x, y: j.y, isAnchor: false, bodyId: j.id }));

  let cost = 0;
  const beams = pb.beams.map(b => {
    const mat = level.materials[b.material === 'road' ? 'road' : 'wood'];
    const c = mat.blocks?.[b.size]?.cost ?? mat.cost;
    cost += c;
    return { a: b.a, b: b.b, material: mat, cost: c };
  });

  return { joints, beams, cost };
}
```

- [ ] **Step 4: Run** — `npx vitest run tests/prebuilt.test.js` → PASS.

- [ ] **Step 5: Commit**

```bash
git add src/utils/prebuilt.js tests/prebuilt.test.js
git commit -m "feat(levels): expandPrebuilt util for prebuilt bridge data"
```

---

### Task 3: Vehicle resolution util

**Files:**
- Create: `src/utils/vehicleDesign.js`
- Test: `tests/vehicleDesign.test.js`

- [ ] **Step 1: Write the failing test**

```js
// tests/vehicleDesign.test.js
import { describe, it, expect } from 'vitest';
import { resolveVehicleDesign } from '../src/utils/vehicleDesign.js';

const PRESETS = [
  { key: 'car',   weight: 3, speed: 7, acceleration: 5 },
  { key: 'truck', weight: 5, speed: 4, acceleration: 5 },
  { key: 'tank',  weight: 8, speed: 2, acceleration: 5 },
];

describe('resolveVehicleDesign', () => {
  it('uses the player-selected preset when the level does not lock the vehicle', () => {
    const level = { vehicles: [{ type: 'car' }] };
    expect(resolveVehicleDesign(level, PRESETS, 'tank'))
      .toEqual({ weight: 8, speed: 2, acceleration: 5 });
  });

  it('uses the level vehicle type when ui.vehicleSelect is false, ignoring selection', () => {
    const level = { ui: { vehicleSelect: false }, vehicles: [{ type: 'truck' }] };
    expect(resolveVehicleDesign(level, PRESETS, 'car'))
      .toEqual({ weight: 5, speed: 4, acceleration: 5 });
  });

  it('applies the level design override on top of the locked preset', () => {
    const level = {
      ui: { vehicleSelect: false },
      vehicles: [{ type: 'truck', design: { weight: 6 } }],
    };
    expect(resolveVehicleDesign(level, PRESETS, 'car'))
      .toEqual({ weight: 6, speed: 4, acceleration: 5 });
  });

  it('falls back to the first preset for an unknown key', () => {
    const level = { vehicles: [{ type: 'car' }] };
    expect(resolveVehicleDesign(level, PRESETS, 'bogus'))
      .toEqual({ weight: 3, speed: 7, acceleration: 5 });
  });
});
```

- [ ] **Step 2: Run to verify FAIL** — `npx vitest run tests/vehicleDesign.test.js`.

- [ ] **Step 3: Implement**

```js
// src/utils/vehicleDesign.js
// Resolves the 1-10 design-scale vehicle params for a test run.
// Locked levels (ui.vehicleSelect === false) always use the level's vehicle;
// otherwise the player's selected preset wins. Level `design` overrides
// individual fields on locked levels.
export function resolveVehicleDesign(level, presets, selectedKey) {
  const v = level.vehicles[0];
  const locked = level.ui?.vehicleSelect === false;
  const key = locked ? v.type : selectedKey;
  const preset = presets.find(p => p.key === key) ?? presets[0];
  const base = { weight: preset.weight, speed: preset.speed, acceleration: preset.acceleration };
  return locked ? { ...base, ...(v.design ?? {}) } : base;
}
```

- [ ] **Step 4: Run** — PASS. **Step 5: Commit**

```bash
git add src/utils/vehicleDesign.js tests/vehicleDesign.test.js
git commit -m "feat(vehicles): resolveVehicleDesign - level data wins on locked levels"
```

---

### Task 4: Tutorial card system

**Files:**
- Create: `src/systems/tutorial.js`
- Test: `tests/tutorial.test.js`

- [ ] **Step 1: Write the failing test**

```js
// tests/tutorial.test.js
// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import tutorial, { shouldShowHint } from '../src/systems/tutorial.js';

describe('shouldShowHint', () => {
  const mk = (phase, hint) => ({ phase, tutorial: hint ? { hint } : undefined });

  it('returns false when the level has no hint', () => {
    expect(shouldShowHint(mk('topic'), 99)).toBe(false);
  });

  it('tutorial phase: hint on first failure', () => {
    const l = mk('tutorial', { text: 'x' });
    expect(shouldShowHint(l, 0)).toBe(false);
    expect(shouldShowHint(l, 1)).toBe(true);
  });

  it('topic and challenge phases: hint after 2 failures', () => {
    for (const phase of ['topic', 'challenge']) {
      const l = mk(phase, { text: 'x' });
      expect(shouldShowHint(l, 1)).toBe(false);
      expect(shouldShowHint(l, 2)).toBe(true);
    }
  });

  it('per-level afterFails override wins', () => {
    const l = mk('topic', { text: 'x', afterFails: 3 });
    expect(shouldShowHint(l, 2)).toBe(false);
    expect(shouldShowHint(l, 3)).toBe(true);
  });
});

describe('tutorial card DOM', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="ui-modals"></div>';
    tutorial.attach();
  });

  it('showIntro renders a card with icon and text', () => {
    tutorial.showIntro({ phase: 'tutorial', tutorial: { intro: { icon: '👆', text: 'Tap!' } } });
    const card = document.querySelector('.tutorial-card');
    expect(card).not.toBeNull();
    expect(card.textContent).toContain('👆');
    expect(card.textContent).toContain('Tap!');
  });

  it('clicking the card dismisses it', () => {
    tutorial.showIntro({ phase: 'tutorial', tutorial: { intro: { text: 'Tap!' } } });
    document.querySelector('.tutorial-card').click();
    expect(document.querySelector('.tutorial-card')).toBeNull();
  });

  it('onFail shows the hint only after the gated count', () => {
    const lvl = { phase: 'topic', tutorial: { hint: { text: 'Try a triangle' } } };
    tutorial.onFail(lvl);                                  // 1 fail — no card
    expect(document.querySelector('.tutorial-card')).toBeNull();
    tutorial.onFail(lvl);                                  // 2 fails — card
    expect(document.querySelector('.tutorial-card').textContent).toContain('Try a triangle');
  });

  it('reset clears the fail count and any card', () => {
    const lvl = { phase: 'tutorial', tutorial: { hint: { text: 'h' } } };
    tutorial.onFail(lvl);
    expect(document.querySelector('.tutorial-card')).not.toBeNull();
    tutorial.reset();
    expect(document.querySelector('.tutorial-card')).toBeNull();
    tutorial.onFail(lvl); // count restarted: 1 fail in 'tutorial' phase → shows again
    expect(document.querySelector('.tutorial-card')).not.toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify FAIL.**

- [ ] **Step 3: Implement**

```js
// src/systems/tutorial.js
// Data-driven tutorial cards rendered into #ui-modals.
// Follows the system lifecycle contract: attach(scene), detach(scene), reset().

const PHASE_HINT_AFTER = { tutorial: 1, topic: 2, challenge: 2 };

export function shouldShowHint(level, failCount) {
  const hint = level.tutorial?.hint;
  if (!hint) return false;
  const after = hint.afterFails ?? PHASE_HINT_AFTER[level.phase] ?? 2;
  return failCount >= after;
}

const tutorial = {
  _root: null,
  _card: null,
  _failCount: 0,

  attach() {
    this._root = typeof document !== 'undefined'
      ? document.getElementById('ui-modals')
      : null;
    this._failCount = 0;
  },

  detach() {
    this.hideCard();
    this._root = null;
  },

  reset() {
    this._failCount = 0;
    this.hideCard();
  },

  showIntro(level) {
    const card = level.tutorial?.intro;
    if (card) this._show(card);
  },

  onFail(level) {
    this._failCount += 1;
    if (shouldShowHint(level, this._failCount)) this._show(level.tutorial.hint);
  },

  hideCard() {
    this._card?.remove();
    this._card = null;
  },

  _show({ icon, text }) {
    if (!this._root) return;
    this.hideCard();
    const el = document.createElement('div');
    el.className = 'tutorial-card';
    const ic = document.createElement('div');
    ic.className = 'tut-icon';
    ic.textContent = icon ?? '';
    const tx = document.createElement('div');
    tx.className = 'tut-text';
    tx.textContent = text ?? '';
    el.append(ic, tx);
    el.addEventListener('click', () => this.hideCard());
    this._root.appendChild(el);
    this._card = el;
  },
};

export default tutorial;
```

- [ ] **Step 4: Run** — PASS. **Step 5: Commit**

```bash
git add src/systems/tutorial.js tests/tutorial.test.js
git commit -m "feat(tutorial): data-driven tutorial card singleton with phase-gated hints"
```

---

### Task 5: `ui:config` / `ui:screen` wiring in the HTML chrome

**Files:**
- Modify: `src/ui-html/components/TopBar.js`
- Modify: `src/ui-html/components/Toolbar.js`
- Modify: `src/ui-html/index.js`
- Modify: `src/ui-html/styles/index.css` (append)
- Test: `tests/ui-html/uiconfig.test.js`

- [ ] **Step 1: Write the failing test** (mirror the setup style of `tests/ui-html/Toolbar.test.js` — check it first and copy its DOM/bus reset pattern; the assertions below are the contract):

```js
// tests/ui-html/uiconfig.test.js
// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { bus } from '../../src/ui-html/bus.js';
import { mountTopBar } from '../../src/ui-html/components/TopBar.js';
import { mountToolbar } from '../../src/ui-html/components/Toolbar.js';

describe('ui:config', () => {
  beforeEach(() => {
    bus._reset();
    document.body.innerHTML = '<header id="t"></header><nav id="n"></nav>';
  });

  it('budgetMeter:false hides the budget chip; default shows it', () => {
    mountTopBar(document.getElementById('t'));
    const chip = document.querySelector('.budget-chip');
    bus.emit('ui:config', { budgetMeter: false });
    expect(chip.style.display).toBe('none');
    bus.emit('ui:config', {});
    expect(chip.style.display).toBe('');
  });

  it('tools whitelist hides non-listed active tools but keeps utility + play', () => {
    mountToolbar(document.getElementById('n'));
    bus.emit('ui:config', { tools: ['road'] });
    const tile = (k) => document.querySelector(`#n [data-tool="${k}"]`);
    expect(tile('road').style.display).toBe('');
    expect(tile('beam').style.display).toBe('none');
    expect(tile('remove').style.display).toBe('none');
    expect(tile('grid').style.display).toBe('');   // utility row untouched
    bus.emit('ui:config', {});                      // no whitelist → all visible
    expect(tile('beam').style.display).toBe('');
  });

  it('REMOVE tile is enabled (not aria-disabled)', () => {
    mountToolbar(document.getElementById('n'));
    const remove = document.querySelector('#n [data-tool="remove"]');
    expect(remove.getAttribute('aria-disabled')).not.toBe('true');
  });
});
```

> If `ToolTile` doesn't set `data-tool`, check `src/ui-html/components/ToolTile.js` and use whatever selector it exposes (the existing `Toolbar.test.js` will show the established way to grab tiles). Adjust the selectors, not the behavior.

- [ ] **Step 2: Run to verify FAIL.**

- [ ] **Step 3: Implement TopBar change** — in `src/ui-html/components/TopBar.js`, replace `root.appendChild(BudgetChip());` with:

```js
  const budgetChip = BudgetChip();
  root.appendChild(budgetChip);
```

and add at the bottom of `mountTopBar` (alongside the other `bus.on` calls):

```js
  bus.on('ui:config', (cfg) => {
    budgetChip.style.display = cfg?.budgetMeter === false ? 'none' : '';
  });
```

- [ ] **Step 4: Implement Toolbar changes** — in `src/ui-html/components/Toolbar.js`:

1. Enable REMOVE: change the `remove` entry in `ACTIVE_TOOLS` to `disabled: false`.
2. Add at the bottom of `mountToolbar`:

```js
  bus.on('ui:config', (cfg) => {
    const allowed = cfg?.tools;
    for (const t of ACTIVE_TOOLS) {
      tiles[t.tool].style.display =
        allowed && !allowed.includes(t.tool) ? 'none' : '';
    }
  });
```

- [ ] **Step 5: Implement index.js changes** — in `src/ui-html/index.js`, add inside `mountUi` after the existing `bus.on('mode:changed', ...)` block:

```js
  bus.on('ui:config', (cfg) => {
    const sidebar = document.getElementById('ui-sidebar');
    if (sidebar) sidebar.style.display = cfg?.vehicleSelect === false ? 'none' : '';
  });

  bus.on('ui:screen', (screen) => {
    root.classList.toggle('screen-menu', screen === 'menu');
  });
```

- [ ] **Step 6: Append CSS** — at the end of `src/ui-html/styles/index.css`:

```css
/* ── Level progression: menu screen hides game chrome ─────────────────── */
#ui-root.screen-menu #ui-topbar,
#ui-root.screen-menu #ui-sidebar,
#ui-root.screen-menu #ui-toolbar,
#ui-root.screen-menu #ui-hud,
#ui-root.screen-menu #ui-size-row { display: none; }

/* ── Tutorial card ─────────────────────────────────────────────────────── */
.tutorial-card {
  position: absolute; left: 50%; bottom: 120px; transform: translateX(-50%);
  background: #16243d; border: 2px solid #f5d400; border-radius: 16px;
  padding: 18px 28px; color: #fff; text-align: center;
  pointer-events: auto; cursor: pointer; max-width: 480px;
  font-family: 'Fredoka', sans-serif;
}
.tutorial-card .tut-icon { font-size: 44px; line-height: 1.1; }
.tutorial-card .tut-text { font-size: 20px; margin-top: 6px; }

/* ── Win result modal ──────────────────────────────────────────────────── */
.result-modal {
  position: absolute; inset: 0; display: flex;
  align-items: center; justify-content: center; pointer-events: auto;
}
.result-card {
  background: #16243d; border: 2px solid #7ab8d8; border-radius: 16px;
  padding: 28px 44px; text-align: center; color: #fff;
  font-family: 'Fredoka', sans-serif;
}
.result-card h2 { margin: 0 0 8px; font-size: 32px; }
.result-card.result-win h2 { color: #5ab942; }
.result-budget { color: #f5d400; font-size: 18px; }
.result-buttons { display: flex; gap: 12px; justify-content: center; margin-top: 16px; }
```

- [ ] **Step 7: Run** — `npx vitest run tests/ui-html/uiconfig.test.js` → PASS; `npm test` → PASS.

- [ ] **Step 8: Commit**

```bash
git add src/ui-html tests/ui-html/uiconfig.test.js
git commit -m "feat(ui): ui:config per-level chrome visibility, ui:screen menu class, enable REMOVE tile"
```

---

### Task 6: ResultModal component

**Files:**
- Create: `src/ui-html/components/ResultModal.js`
- Modify: `src/ui-html/index.js`
- Test: append to `tests/ui-html/uiconfig.test.js` (or new `tests/ui-html/ResultModal.test.js`)

- [ ] **Step 1: Write the failing test**

```js
// tests/ui-html/ResultModal.test.js
// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { bus } from '../../src/ui-html/bus.js';
import { mountResultModal } from '../../src/ui-html/components/ResultModal.js';

describe('ResultModal', () => {
  beforeEach(() => {
    bus._reset();
    document.body.innerHTML = '<div id="m"></div>';
    mountResultModal(document.getElementById('m'));
  });

  it('renders win card with text, budget, and three buttons when hasNext', () => {
    bus.emit('level:result', { won: true, text: 'You did it!', budgetLeft: 5, hasNext: true });
    const card = document.querySelector('.result-card');
    expect(card.textContent).toContain('You did it!');
    expect(card.textContent).toContain('5');
    const labels = [...document.querySelectorAll('.result-buttons button')].map(b => b.textContent);
    expect(labels).toEqual(['TRY AGAIN', 'NEXT LEVEL', 'MENU']);
  });

  it('omits NEXT LEVEL when hasNext is false', () => {
    bus.emit('level:result', { won: true, hasNext: false });
    const labels = [...document.querySelectorAll('.result-buttons button')].map(b => b.textContent);
    expect(labels).toEqual(['TRY AGAIN', 'MENU']);
  });

  it('buttons emit their event and close the modal', () => {
    const onNext = vi.fn();
    bus.on('level:next', onNext);
    bus.emit('level:result', { won: true, hasNext: true });
    [...document.querySelectorAll('.result-buttons button')]
      .find(b => b.textContent === 'NEXT LEVEL').click();
    expect(onNext).toHaveBeenCalled();
    expect(document.querySelector('.result-modal')).toBeNull();
  });

  it('level:result-hide closes the modal', () => {
    bus.emit('level:result', { won: true, hasNext: true });
    bus.emit('level:result-hide');
    expect(document.querySelector('.result-modal')).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify FAIL.**

- [ ] **Step 3: Implement**

```js
// src/ui-html/components/ResultModal.js
import { bus } from '../bus.js';

// Win-result modal. Fail keeps the existing in-canvas overlay + auto-return;
// this modal replaces the win auto-return (spec: success card with Next/Menu).
export function mountResultModal(root) {
  let el = null;

  function hide() {
    el?.remove();
    el = null;
  }

  function button(label, event) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'btn result-btn';
    b.textContent = label;
    b.addEventListener('click', () => { hide(); bus.emit(event); });
    return b;
  }

  bus.on('level:result', ({ won, text, budgetLeft, hasNext }) => {
    hide();
    el = document.createElement('div');
    el.className = 'result-modal';

    const card = document.createElement('div');
    card.className = `result-card ${won ? 'result-win' : 'result-fail'}`;

    const h = document.createElement('h2');
    h.textContent = won ? 'BRIDGE HOLDS!' : 'BRIDGE FAILED';
    card.appendChild(h);

    if (text) {
      const p = document.createElement('p');
      p.textContent = text;
      card.appendChild(p);
    }
    if (won && budgetLeft != null) {
      const b = document.createElement('p');
      b.className = 'result-budget';
      b.textContent = `Coins left: ${budgetLeft}`;
      card.appendChild(b);
    }

    const btns = document.createElement('div');
    btns.className = 'result-buttons';
    btns.appendChild(button('TRY AGAIN', 'level:retry'));
    if (won && hasNext) btns.appendChild(button('NEXT LEVEL', 'level:next'));
    btns.appendChild(button('MENU', 'level:menu'));
    card.appendChild(btns);

    el.appendChild(card);
    root.appendChild(el);
  });

  bus.on('level:result-hide', hide);
}
```

- [ ] **Step 4: Mount it** — in `src/ui-html/index.js`, import and call inside `mountUi`:

```js
import { mountResultModal } from './components/ResultModal.js';
// … inside mountUi, after mountSizeRow:
  mountResultModal(document.getElementById('ui-modals'));
```

- [ ] **Step 5: Run** — PASS, then `npm test`. **Step 6: Commit**

```bash
git add src/ui-html tests/ui-html/ResultModal.test.js
git commit -m "feat(ui): win ResultModal with Try Again / Next Level / Menu"
```

---

### Task 7: MenuScene + boot flow

**Files:**
- Create: `src/scenes/MenuScene.js`
- Modify: `src/scenes/BootScene.js`
- Modify: `src/main.js`

(No new unit test — `menuEntries` is covered by Task 1; scene rendering is verified by the manual feel-check in Task 9.)

- [ ] **Step 1: Create MenuScene**

```js
// src/scenes/MenuScene.js
import Phaser from 'phaser';
import { ALL_LEVELS, LEVEL_ORDER, menuEntries } from '../data/leveldata.js';
import { bus } from '../ui-html/bus.js';

const PHASE_COLORS = { tutorial: 0x2e7d32, topic: 0x1565c0, challenge: 0x7b1fa2 };
const PHASE_LABELS = { tutorial: 'LEARN THE ROPES', topic: 'DISCOVER', challenge: 'PROVE IT' };

export class MenuScene extends Phaser.Scene {
  constructor() {
    super('MenuScene');
  }

  create() {
    bus.emit('ui:screen', 'menu');
    this.cameras.main.setBackgroundColor('#1a1a2e');

    this.add.text(640, 70, 'BRIDGE BUILDER', {
      fontSize: '48px', color: '#ffffff', fontStyle: 'bold',
    }).setOrigin(0.5);
    this.add.text(640, 120, 'Pick a level', {
      fontSize: '18px', color: '#aaaaaa',
    }).setOrigin(0.5);

    const entries = menuEntries(ALL_LEVELS, LEVEL_ORDER);
    const COLS = 4, CW = 270, CH = 108, GX = 26, GY = 38;
    const x0 = 640 - ((COLS - 1) * (CW + GX)) / 2;

    entries.forEach((e, i) => {
      const x = x0 + (i % COLS) * (CW + GX);
      const y = 220 + Math.floor(i / COLS) * (CH + GY);

      const card = this.add.rectangle(x, y, CW, CH, PHASE_COLORS[e.phase] ?? 0x444444)
        .setStrokeStyle(2, 0xffffff, 0.25)
        .setInteractive({ useHandCursor: true });
      this.add.text(x, y - 22, `${i + 1}`, {
        fontSize: '30px', color: '#ffffff', fontStyle: 'bold',
      }).setOrigin(0.5);
      this.add.text(x, y + 14, e.title, {
        fontSize: '17px', color: '#e8e8e8',
      }).setOrigin(0.5);
      this.add.text(x, y + 38, PHASE_LABELS[e.phase] ?? '', {
        fontSize: '11px', color: '#ffffff',
      }).setOrigin(0.5).setAlpha(0.6);

      card.on('pointerdown', () => this.scene.start('LevelScene', { levelId: e.id }));
      card.on('pointerover', () => card.setAlpha(0.8));
      card.on('pointerout',  () => card.setAlpha(1));
    });

    // Dev back door: ?dev in the URL exposes the stress level.
    if (typeof window !== 'undefined' && window.location.search.includes('dev')) {
      const devBtn = this.add.rectangle(640, 660, 300, 44, 0x7b1fa2).setInteractive();
      this.add.text(640, 660, 'DEV — STRESS TEST', { fontSize: '16px', color: '#fff' }).setOrigin(0.5);
      devBtn.on('pointerdown', () => this.scene.start('LevelScene', { levelId: 'DEV_STRESS' }));
    }
  }
}
```

- [ ] **Step 2: Simplify BootScene** — replace the entire `create()` body of `src/scenes/BootScene.js` with:

```js
  create() {
    this.scene.start('MenuScene');
  }
```

(Delete the title text, the `levels` array, and the button loop. `preload()` is unchanged.)

- [ ] **Step 3: Register the scene** — in `src/main.js`:

```js
import { MenuScene } from './scenes/MenuScene.js';
// …
  scene: [BootScene, MenuScene, LevelScene],
```

- [ ] **Step 4: Verify** — `npm test` (no regressions), then `npm run dev` and confirm: menu shows 12 cards in 3 phase colors, clicking card 1 opens L01, the HTML chrome is hidden on the menu and visible in the level.

- [ ] **Step 5: Commit**

```bash
git add src/scenes/MenuScene.js src/scenes/BootScene.js src/main.js
git commit -m "feat(menu): MenuScene level-select grid; BootScene boots straight to it"
```

---

### Task 8: LevelScene integration

**Files:**
- Modify: `src/scenes/LevelScene.js`

All edits reference the current file (1510 lines). After each numbered edit group, run `npm test` — existing suites (`world-boot`, `saveload`, etc.) guard against regressions.

- [ ] **Step 1: Imports + init** — add imports at the top:

```js
import tutorial from '../systems/tutorial.js';
import { expandPrebuilt } from '../utils/prebuilt.js';
import { resolveVehicleDesign } from '../utils/vehicleDesign.js';
import { LEVEL_ORDER } from '../data/leveldata.js';
```

In `init(data)` (line 113): default already changed to `'L01'` in Task 1. Add at the end of `init`:

```js
    this._ui = this.level.ui ?? {};
    this._prebuiltCost = expandPrebuilt(this.level).cost;
    this._applyPrebuilt();
```

And add these two methods (near `clearBridgeData`):

```js
  // Push the level's prebuilt joints/beams into the scene data arrays.
  // Pure data — physics is created by the next rebuildBridge() call.
  _applyPrebuilt() {
    if (!this.level.prebuilt) return;
    const { joints, beams } = expandPrebuilt(this.level);
    this.joints.push(...joints);
    const byId = new Map(this.joints.map(j => [j.bodyId, j]));
    for (const b of beams) {
      const jA = byId.get(b.a);
      const jB = byId.get(b.b);
      if (!jA || !jB) continue;
      this.beams.push({ a: jA, b: jB, material: b.material, cost: b.cost, constraint: null });
    }
  }

  // Budget always starts net of the prebuilt bridge cost (spec).
  _freshBudget() {
    return this.level.budget - this._prebuiltCost;
  }
```

- [ ] **Step 2: Budget reset sites** — replace all three `this._budgetRemaining = this.level.budget` occurrences (create() line 197, hardReset() line 700, toggleTest() build branch line 1186) with:

```js
    this._budgetRemaining = this._freshBudget();
```

- [ ] **Step 3: Prebuilt physics at create + vehicle preset default** — in `create()`:

Replace line 200 `this._vehiclePreset = VEHICLE_PRESETS[0].key;` with:

```js
    this._vehiclePreset = this.level.vehicles[0]?.type ?? VEHICLE_PRESETS[0].key;
```

After the `cam.attach(this);` line (178), add:

```js
    tutorial.attach(this);
    if (this.level.prebuilt) this.rebuildBridge(); // creates constraints for prebuilt beams
```

After the `this.redrawJoints(new Map());` at line 232 (just before the bus-wiring section), add:

```js
    this.redrawBeams();
```

- [ ] **Step 4: clearBridgeData re-applies prebuilt** — at the end of `clearBridgeData()` (after `this._debris = [];`), add:

```js
    this._applyPrebuilt();
```

- [ ] **Step 5: ui:config / ui:screen emit + nav handlers** — in `create()`'s bus section, add to `this._busHandlers`:

```js
      levelRetry: () => { if (this.mode === 'test') this.toggleTest(); },
      levelNext:  () => {
        const i = LEVEL_ORDER.indexOf(this.levelId);
        const next = i >= 0 ? LEVEL_ORDER[i + 1] : null;
        if (next) this.scene.start('LevelScene', { levelId: next });
      },
      levelMenu:  () => this.scene.start('MenuScene'),
```

Wire and unwire them like the others:

```js
    bus.on('level:retry', this._busHandlers.levelRetry);
    bus.on('level:next',  this._busHandlers.levelNext);
    bus.on('level:menu',  this._busHandlers.levelMenu);
```

(and matching `bus.off` calls in the shutdown handler, plus `tutorial.detach(this);` next to the other detaches).

Replace the initial-sync block's `bus.emit('tool:select', 'road');` area so it reads:

```js
    bus.emit('ui:screen', 'level');
    bus.emit('ui:config', this._ui);
    bus.emit('budget:update', this._budgetRemaining);
    bus.emit('vehicle:active', this._vehiclePreset);
    bus.emit('mode:changed', 'build');
    bus.emit('tool:select', 'road');
    bus.emit('layout:load-available', hasSave(this.levelId));
    tutorial.showIntro(this.level);
```

- [ ] **Step 6: UI guards** — three small edits:

In `_handleRightClickDelete` (line 1307), first line of the method:

```js
    if (this._ui.delete === false) return;
```

In `_selectVehicle` (line 646), first line:

```js
    if (this._ui.vehicleSelect === false) return;
```

Keyboard shortcut guard (line 223) — replace the `keydown-B` line with:

```js
    this.input.keyboard.on('keydown-B', () => {
      if (this.level.materials.wood) bus.emit('tool:select', 'beam');
    });
```

And in `_onToolSelect` (line 1192), right after `const mat = this.level.materials[matKey];` add:

```js
      if (!mat) return;
```

> Note: `_loadFromSave` calls `_selectVehicle(data.vehicle)` — on locked levels the guard makes it a no-op, which is correct (the level's vehicle wins anyway).

- [ ] **Step 7: Vehicle enforcement in toggleTest** — replace the `vehicleConfig` construction (lines 1147–1154) with:

```js
      const design = resolveVehicleDesign(this.level, VEHICLE_PRESETS, this._vehiclePreset);
      const vehicleConfig = {
        ...this.level.vehicles[0], // spec §2 rule 3: always an array
        ...vehicleParamsFromDesign(design),
      };
```

The lil-gui vehicle sliders (`_cheatParams.weight/speed/acceleration`) no longer feed the spawn — that's intentional (spec: level data wins). Material/gravity/visual cheat folders still work.

On locked levels the sprite must match the level vehicle: `this._vehiclePreset` is already initialized from `level.vehicles[0].type` (Step 3), and `_selectVehicle` is guarded (Step 6), so no further change.

- [ ] **Step 8: REMOVE tool (tap-delete)** — in `init()`, add `this._removeMode = false;`. In `_onToolSelect`, the `road`/`beam` branch and the `free` branch both gain `this._removeMode = false;` as their first line, and add a new branch before `zoom-in`:

```js
    } else if (toolKey === 'remove') {
      if (this._ui.delete === false) return;
      this._removeMode = true;
      this._blockState = { freeform: false, material: null, size: null, blockLength: 0 };
      this.pendingJointA = null;
      this._ghost.hide();
      bus.emit('sizes:hide');
```

In `handleClick` (line 444), insert the remove branch first:

```js
  handleClick(pointer) {
    if (this.mode !== 'build') return;
    if (isOverHtmlChrome(pointer)) return;
    if (this._removeMode) {
      const target = this._findHoverTarget(pointer.worldX, pointer.worldY);
      if (target?.type === 'beam') this._deleteBeam(target.index);
      else if (target?.type === 'joint') this._deleteJoint(target.index);
      return;
    }
    if (this._blockState.freeform) {
```

(The existing hover highlight already paints the target red via `_findHoverTarget`.)

- [ ] **Step 9: Delete refunds for prebuilt (and post-test) beams** — in `_deleteBeam` (lines 1319–1330), change the refund lookup to fall back to `beam.cost`:

```js
    const undoIdx = this._undoStack.findIndex(e => e.beam === beam);
    let cost = 0;
    let newJoints = [];
    if (undoIdx !== -1) {
      ({ cost, newJoints } = this._undoStack[undoIdx]);
      this._undoStack.splice(undoIdx, 1);
    } else {
      cost = beam.cost ?? 0;
    }
```

And stamp `cost` onto beams at both placement sites so refunds survive the undo-stack wipe at test start:

In `_handleFreeformClick` (line 497): `const beam = { a: this.pendingJointA, b: endpoint, material: this.material, constraint, cost };`
In `_handleBlockPlace` (line 535): `const beam = { a: anchorJoint, b: endJoint, material: mat, constraint, cost };`

- [ ] **Step 10: Win flow — modal replaces auto-return** — replace `showWin()` (lines 1400–1405) with:

```js
  showWin() {
    physics.freezeVehicle();
    this.testEndAt = 0; // no auto-return on win — the modal owns the exit
    cam.follow(null);
    const i = LEVEL_ORDER.indexOf(this.levelId);
    bus.emit('level:result', {
      won: true,
      text: this.level.tutorial?.success?.text ?? '',
      budgetLeft: this._budgetRemaining,
      hasNext: i >= 0 && i < LEVEL_ORDER.length - 1,
    });
    this.winOverlay = { destroy: () => bus.emit('level:result-hide') };
  }
```

(`winOverlay` keeps its sentinel role for `checkWin`/`checkFall` guards; its `destroy()` is called by `toggleTest`/`hardReset` and now closes the modal.)

In `showFail()` (line 1392), add tutorial hook as the first line:

```js
    tutorial.onFail(this.level);
```

Fail keeps the existing overlay + 1.5s auto-return (spec).

In `toggleTest()` test-entry branch, after `this._ghost.hide();` add:

```js
      tutorial.hideCard();
```

- [ ] **Step 11: Run everything**

Run: `npm test` → all PASS.
Run: `npm run dev` → manual smoke: L01 plays with only ROAD tool + giant TEST, no budget chip, no sidebar; L03 spawns with a wonky prebuilt bridge, REMOVE works by tap, deleting a prebuilt beam refunds coins; win on L01 shows the modal, NEXT LEVEL goes to L02, MENU returns to the grid; retest after a fail on L03 still shows the prebuilt bridge.

- [ ] **Step 12: Commit**

```bash
git add src/scenes/LevelScene.js
git commit -m "feat(levels): LevelScene progression integration - ui guards, prebuilt, vehicle lock, remove tool, tutorial hooks, win modal"
```

---

### Task 9: Full verification + tuning feel-check

**Files:** none new — verification only. Tuning edits go to `src/data/leveldata.js`.

- [ ] **Step 1: Full suite** — `npm test` → all PASS. `npm run build` → builds clean.

- [ ] **Step 2: Manual feel-check against the spec** (use `npm run dev`):

| Check | Level | Expect |
|---|---|---|
| One-beam win | L01 | Single L road between anchors wins; no budget chip, no sidebar, only ROAD tool |
| Guaranteed failure | L02 | A flat 2–3 segment deck snaps under the weight-6 car; hint card on 1st fail |
| Prebuilt + delete | L03 | Wonky bridge present at load and after a failed test; REMOVE-tap deletes; coins refund |
| Stress glow teach | L04 | Red glow visible at overload point; hint after 2 fails |
| Pillar discovery | L05 | L04-style flat deck fails on budget alone; pillar route affordable |
| Triangle anti-bypass | L06 | Doubling the deck is unaffordable; wood diagonals fix the sag |
| Asymmetric terrain | L08, L12 | Different wall heights render and collide correctly |
| Vehicle lock | L05/L11/L12 | Sidebar hidden; keys 1/2/3 do nothing; correct vehicle spawns |
| Win modal | any | TRY AGAIN keeps design, NEXT advances, MENU returns; no 1.5s wipe on win |
| Menu round-trip ×5 | menu↔L01 | No duplicate audio/cheat panels, no leaked timeScale (singleton hygiene) |

- [ ] **Step 3: Tune budgets/weights** where a check fails — adjust only numbers in `src/data/leveldata.js` (budget, design.weight, span edges, pillar positions). Re-run `npx vitest run tests/levels.test.js` after each tuning change (it enforces the L05/L06 budget directions).

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat(levels): tuning pass for 12-level progression feel-check"
```

---

## Self-Review Notes

- **Spec coverage:** curriculum data (T1), prebuilt (T2/T8), vehicle enforcement (T3/T8), tutorial cards + hint gating (T4/T8), ui:config + REMOVE + sidebar/budget hiding (T5/T8), win modal replacing auto-return (T6/T8), menu + ui:screen (T7), budget-direction tests (T1), menu↔level hygiene (T9). Universal win condition = existing `checkWin` (vehicle reaches right anchor; snaps alone don't fail) — no code change needed, matches spec.
- **Known intentional behavior:** fail path keeps the 1.5s auto-return + design wipe, but `clearBridgeData` now re-applies prebuilt; player-placed beams are wiped on fail by design (fresh attempt), while RESET SIM (retry from modal / toolbar) keeps the design.
- **Type consistency:** `beam.cost` is set at both placement sites, by `_applyPrebuilt`, and read by `_deleteBeam`; `splitBeam` replacement beams intentionally carry no `cost` (refund via undo entries only, unchanged behavior).
