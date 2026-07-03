# Material Variety — Road & Beam Types (Design)

**Date:** 2026-07-03 · **Status:** Approved, ready for planning · **Branch:** `feat/material-variety`

## 1. Goal

Give the player a **palette of 5 road materials and 5 beam materials**, each with a
distinct physical character *and* a distinct look, chosen from a smart, minimal
submenu that expands off the existing bottom-toolbar ROAD / BEAM tiles. Materials
read as "closer to real life" but stay legible to the kid demographic and reinforce
the three learning modules (Gravity & Falling → Strong Shapes → Weight & Engineering).

This is a **data + light-plumbing** feature. No physics rewrite: every property is
expressible with existing constraint params plus one small promotion (per-material
friction). The one genuinely new subsystem is the material **submenu UI**.

## 2. The material lineup

Ordered cheap-weak → pricey-strong. Numbers below are **directional**; final values
are tuned in-app with the cheat-panel weight slider per `LEVEL_AUTHORING.md`
("verify empirically, don't compute").

### Roads — drivable deck (`category: 'road'`, gets a collision body; friction matters)

| id | Name | cost | stiffness | snapThreshold | friction / static | Character & lesson |
|----|------|:---:|:---:|:---:|:---:|---|
| `dirt`     | Dirt       | 1 | 0.05 | 0.02  | 0.20 / 0.25 | Saggy, weak, loose grip. Cheapest — "cheap deck can't hold weight." |
| `tar`      | Tar        | 2 | 0.07 | 0.025 | 0.15 / 0.20 | Budget blacktop, **slippery** on ramps. |
| `asphalt`  | Asphalt    | 4 | 0.09 | 0.03  | 0.60 / 0.50 | The balanced **default** road. |
| `concrete` | Concrete   | 6 | 0.14 | 0.05  | 0.80 / 0.70 | Stiff, strong, grippy, heavy, pricey. |
| `steel-deck`| Steel Deck| 9 | 0.20 | 0.08  | **0.30 / 0.35** | Strongest & stiffest — but **slick metal**. "Strongest ≠ best." |

### Beams — structural brace (`category: 'beam'`, no collision body; friction irrelevant)

| id | Name | cost | stiffness | snapThreshold | Character & lesson |
|----|------|:---:|:---:|:---:|---|
| `rope`   | Rope   | 1 | 0.06 | 0.30 | Floppy, weak, pulls only. Cheapest brace. |
| `wood`   | Wood   | 2 | 0.15 | 0.18 | Classic all-rounder (today's default beam). |
| `cable`  | Cable  | 3 | 0.08 | 0.45 | Taut in tension, floppy in compression. Teaches tension vs. compression. |
| `steel`  | Steel  | 5 | 0.30 | 0.22 | Stiff, strong workhorse. |
| `girder` | Girder | 8 | 0.45 | 0.28 | Rock-rigid I-beam, strongest & heaviest. Expert tier. |

Grip lesson lands at both ends of the road ladder (Tar cheap-slick, Steel Deck
premium-slick); the stiff-vs-strong lesson lands via Cable (strong, floppy) vs.
Girder (strong, rigid).

## 3. Data model

Today materials are per-level ad-hoc objects built by `roadMat()` / `woodMat()` in
`leveldata.js`, keyed loosely as `road` / `wood`. We introduce a single registry.

**`src/data/materials.js`** — new module, the source of truth:

```js
export const MATERIALS = {
  dirt:  { id:'dirt', name:'Dirt', category:'road', cost:1,
           stiffness:0.05, snapThreshold:0.02,
           friction:0.20, frictionStatic:0.25, thickness:30,
           visual:{ base:0x8a6a3e, edgeTop:0x9c7a4a, edgeBottom:0x6b4f2c,
                    motif:'speckle', centerLine:false } },
  // …one entry per material above
};
export const ROAD_MATERIALS = Object.values(MATERIALS).filter(m => m.category==='road');
export const BEAM_MATERIALS = Object.values(MATERIALS).filter(m => m.category==='beam');
```

Material object fields:

- `id`, `name` — identity (name shown on the submenu tile).
- `category` — `'road'` (drivable) | `'beam'` (brace). **Replaces the old binary
  `type`.** Everywhere the code branches on `material.type === 'road'`, it branches
  on `material.category === 'road'`. Drivability = `category === 'road'`.
- `cost` — base coins for the material. Retains a per-size **`blocks`** map
  (`{S,M,L,XL}: {length, cost}`) exactly as `roadMat()`/`woodMat()` build today; the
  submenu tile shows a representative unit cost, the size row shows per-size cost. The
  material's relative price scales its whole `blocks` cost column.
- `stiffness`, `snapThreshold` — constraint tuning (unchanged meaning).
- `friction`, `frictionStatic` — **new**, promoted from the hardcoded `0.6` / default
  in `physics.buildBeam` (§4). Only meaningful for roads but stored on all for
  uniformity (ignored for beams, which have no collision body).
- `thickness` — promoted from the hardcoded `10 | 30`. Lets Girder read chunky and
  Cable/Rope read thin. Beams keep their structural-only rendering thickness.
- `visual` — see §6.

**Backwards compatibility.** `roadMat()` / `woodMat()` become thin adapters that
return `MATERIALS.asphalt` / `MATERIALS.wood` (preserving existing level defaults) so
untouched levels keep working. `level.materials` may now list any subset of material
ids; a level's `ui.tools` gains the notion of which materials are offered per category
(§5). Existing prebuilt beams referencing `material: 'road' | 'wood'` map to
`asphalt` / `wood`.

## 4. Physics changes (`physics.js`)

The **iron law holds** — all edits stay inside `physics.js`.

1. In `buildBeam`, read from the material instead of constants:
   - road collision body (`~:256`): `friction: material.friction`,
     `frictionStatic: material.frictionStatic`, keep `restitution: 0`.
   - **cap circles (`~:270`) must use the same** `friction`/`frictionStatic` or grip
     is inconsistent at every joint.
   - `thickness` from `material.thickness` (fallback to current 10/30 by static-ness).
2. `const isRoad = material.category === 'road'` (was `material.type === 'road'`).
3. No change to the stress/snap model — `stiffness`/`snapThreshold` already flow
   through per material.

Explicitly **out of scope:** wheel-torque drive. Friction in the current
chassis-force model is a strong lever for slope grip / skid / coast and a weak one
for top-speed / launch — that is acceptable and documented in the spec history.

## 5. Budget model

Move from the two hardwired pools (`_budgetRoad` / `_budgetWood`) to a **single money
pool** `_budget`, because a palette of 10 materials can't map to two pools and the
approved UX is "each material has its own cost, one total budget shown top."

- LevelScene keeps one `this._budget` number. Every place that currently picks
  `_budgetRoad` vs `_budgetWood` (init `:230`, freeform `:675`, block `:708`, undo
  `:793`, emit `:811`, reset `:897`, rebuild `:1443`, remove `:1644`, HUD `:1701`)
  collapses to the single pool. Cost deducted = `material.cost` × block-size factor.
- `bus.emit('budget:update', …)` now sends `{ total, spent }` (or just `total`
  remaining). The top-bar **BudgetChip** shows the single total (green accent),
  matching the approved mockup. The old `budget-chip--road` / `--wood` variants are
  retired.
- **Level schema migration:** `level.budget: { road, wood }` → `level.budget: { total }`.
  A compat shim reads legacy `{road, wood}` as `total = road + (wood||0)` so existing
  CSV/level data loads until migrated. `gdd/levels.csv` gains a `budget_total` column;
  `budget_road`/`budget_wood` remain readable for one migration cycle.

## 6. Rendering — distinct, "realistic", on-style

**Resolving the tension:** `STYLE_SPEC.md` forbids faking the 3D hero look
(vehicles/terrain/water) with code — those are pre-rendered sprites. But **beams and
roads are already drawn in-canvas** with `Phaser.Graphics` (flat fills at
`LevelScene.js:575-582`, debris `:1219`). So per-material distinction is legitimately
a canvas job. "Realistic" here means **realistic-reading** (you can instantly tell tar
from concrete from steel), rendered in the existing **chunky toy/claymation style** —
distinct hue + 2–3-tone shading (top highlight, base, bottom shade) + a light surface
**motif**, *not* photoreal texture.

Each material's `visual` descriptor drives all its rendering:

```js
visual: {
  base, edgeTop, edgeBottom,   // 3-tone body shading (already the road-strip pattern)
  motif: 'speckle'|'grain'|'sheen'|'twist'|'segments'|'plate'|null,
  centerLine: true|false,       // dashed centre line (roads only)
}
```

Motif catalogue (cheap canvas primitives, drawn once per beam segment):
- `speckle` — scattered darker dots (dirt, tar, concrete aggregate).
- `grain` — a few lengthwise stroke lines (wood).
- `sheen` — a bright thin highlight band offset along the top (steel, steel-deck, girder metal).
- `twist` — short diagonal hatch marks (rope, cable — the braided look).
- `segments` — periodic cross-ticks (bamboo, if adopted).
- `plate` — panel seams at intervals (steel-deck).

Rendering touch-points that read the descriptor instead of constants:
- The placed-beam redraw loop (road deck fill + edges + centre line).
- `drawRoads()` cliff-top cosmetic strip (uses the *active/starting* road material so
  the approach road matches the deck).
- `_spawnDebris` color (`:1219`) → `material.visual.base` shaded.

Fallback: any missing `visual` field falls back to today's asphalt/wood colors, so a
half-authored material still renders.

## 7. Submenu UI (approved mockup)

Reproduce the interactive mockup already validated with the user
(`.superpowers/brainstorm/…/toolbar-submenu.html`):

- Clicking the **ROAD** or **BEAM** toolbar tile expands a material submenu that
  floats above that tile (same `#ui-size-row` visual language: white card,
  `--shadow-float`, `--r-md`), with a **spring-in / pop-out** animation (staggered
  tile scale-fade). Clicking the tile again, or the other category, closes/swaps.
- Each material tile: color **swatch** + **name** + gold **`$cost`** (mirrors
  `size-tile`), blue active state. Hover → one-line personality tooltip.
- The submenu header shows the active pick's unit price ("Concrete · $7/block").
- **Total budget stays in the top-bar chip**, unchanged; it flashes when a material's
  cost is applied.
- New component `src/ui-html/components/MaterialSubmenu.js`; new events on the bus:
  `materials:show {category, list, current}`, `material:select {id}`. Toolbar's
  `tool:select` for `road`/`beam` toggles the submenu instead of directly setting a
  size row. Selecting a material sets the active placing material (LevelScene) and
  then the existing size row (S/M/L/XL) still applies on top.

Interaction order per approved flow: **tool (ROAD/BEAM) → material → size.** Size row
behavior is unchanged; it now shows sizes for the chosen material's `blocks`.

## 8. Level authoring & migration

- `level.materials` becomes `{ road: [ids…], beam: [ids…] }` — the materials offered
  in each category's submenu for that level (progression: early levels offer 1–2,
  later levels the full palette). Default when omitted: `['asphalt']` / `['wood']`
  (today's behavior).
- `gdd/levels.csv` gains `road_materials` / `beam_materials` (`;`-lists of ids) and
  `budget_total`. `genLevels.mjs` / `levelKnobs.js` parse them. Legacy columns remain
  readable one cycle (§5).
- Existing 12 levels: default to `asphalt` + `wood` so nothing changes until a level
  is intentionally opened up to the palette.

## 9. Invariants & risks (from `AI_CODING_GUIDE.md`)

- **Physics iron law:** only `physics.js` touches `scene.matter.*`. All friction /
  thickness edits stay there.
- **Constraint pointer refresh:** after `rebuildBridge()` / `splitBeam`, `beam.constraint`
  must be updated — unchanged, but material now rides on the constraint, so verify
  material survives a split (the new mid-beams inherit the parent's material).
- **Scene teardown null-guards:** new submenu bus handlers must be `bus.off`'d in
  `shutdown`, matching the existing pattern, or handlers stack across restarts.
- **Idempotent builders** unchanged.
- **Tutorial-buildable contract:** any level that references a material in its tutorial
  text must actually offer that material (`ui.materials`) — extend the pre-flight check.

## 10. Testing

- **Unit (Vitest):** material registry integrity (every id has required fields;
  categories partition correctly); budget accounting on the single pool
  (place/undo/remove/clear conserve coins); legacy `{road,wood}` budget shim; CSV
  parse of new columns round-trips (`export:levels` ↔ `gen:levels`).
- **Manual (must run the app, per the guide):** place each of the 10 materials, confirm
  distinct look; drive a vehicle over Tar vs Concrete vs Steel Deck and confirm the
  slope-grip/skid difference; confirm a Girder-braced deck holds a tank a Rope-braced
  one drops; confirm submenu open/close animation and total-budget flash.

## 11. Out of scope (possible follow-ups)

- Wheel-torque drive (dramatic wheelspin/launch tied to grip).
- Photoreal / pre-rendered **sprite** assets for materials (asset pipeline;
  see `docs/asset-generation-prompts.md`).
- Per-material **audio** (distinct creak/snap) and skid particle FX.
- Bamboo as a "bendy-but-tough" beam swap for Rope.

## 12. Phasing (implementation order)

1. **Registry + physics** — `materials.js`, promote friction/thickness/category in
   `buildBeam`, adapters keep old levels working. (Unit-testable, no UI.)
2. **Budget unification** — single `_budget` pool + compat shim + BudgetChip.
3. **Rendering** — `visual` descriptor drives deck/beam/debris; motif primitives.
4. **Submenu UI** — `MaterialSubmenu.js`, bus events, toolbar toggle, size-row after.
5. **Authoring** — CSV columns, `leveldata.js` per-level material lists, open up a few
   levels to showcase the palette.

Each phase ends by running `npm test` and (where it affects feel/looks) `npm run dev`
and playing the affected levels.
