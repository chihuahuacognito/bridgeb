# Material Variety — Road & Beam Types (Design v2)

**Date:** 2026-07-03 · **Status:** Approved after 3-agent review, ready for planning · **Branch:** `feat/material-variety`

> **v2 changes** (post-review, per user decisions): roads trimmed to **3** (Dirt/Asphalt/
> Concrete), beams **3** (Rope/Wood/Steel); **friction is entirely out of scope** ("we
> barely use it"); **all materials available from the start** (no per-module gating).
> These delete the friction blocker, the `type→category` rename, skid FX, tutorial-card
> coupling, and per-level material lists. Remaining real work: a material **registry**,
> **single-budget** unification, per-material **rendering**, the **submenu UI**, and
> **save/load** migration. See §13 for the full review-findings disposition.

## 1. Goal

Give the player **3 road materials and 3 beam materials**, each with a distinct
physical character (sag, strength, price) and a distinct look, chosen from a smart,
minimal submenu that springs off the existing bottom-toolbar ROAD / BEAM tiles. A
single total budget is spent across all materials, each with its own per-block price.
Audience is kids (bright toy/claymation style); the set reinforces the Weight &
Engineering learning theme by making cheap-weak vs. pricey-strong a real trade-off.

This is a **data + light-plumbing** feature. `physics.js` is essentially untouched.

## 2. The material lineup

Numbers are **directional**; final values are tuned in-app with the cheat-panel weight
slider per `LEVEL_AUTHORING.md` ("verify empirically, don't compute"). **No friction
fields** — roads differ by sag/strength/price/look only.

### Roads — drivable deck (`type: 'road'`)

| id | Name | cost | stiffness | snapThreshold | Character & lesson |
|----|------|:---:|:---:|:---:|---|
| `dirt`     | Dirt     | 1 | 0.05 | 0.018 | Saggy, weak, cheapest. "A cheap deck can't hold weight." |
| `asphalt`  | Asphalt  | 4 | 0.09 | 0.03  | The balanced **default** road (today's `road`). |
| `concrete` | Concrete | 6 | 0.14 | 0.05  | Stiff, strong, heavy, pricey. Holds trucks on long gaps. |

### Beams — structural brace (`type: 'beam'`)

| id | Name | cost | stiffness | snapThreshold | render thickness | Character & lesson |
|----|------|:---:|:---:|:---:|:---:|---|
| `rope`  | Rope  | 1 | 0.06 | 0.30 | thin  | Floppy, weak, cheapest brace. |
| `wood`  | Wood  | 2 | 0.15 | 0.18 | normal| Classic all-rounder (today's `wood`). |
| `steel` | Steel | 5 | 0.30 | 0.22 | normal| Stiff, strong workhorse. |

Both ladders read weak/cheap → strong/pricey, in parallel. Beam **render** thickness is
a canvas-only value (beams have no collision body) — it is *not* a physics field.

## 3. Data model

Today materials are per-level objects built by `roadMat()`/`woodMat()` in `leveldata.js`,
keyed `road`/`wood`. Introduce one registry as the source of truth.

**`src/data/materials.js`** (new):

```js
export const MATERIALS = {
  dirt:    { id:'dirt', name:'Dirt', type:'road', cost:1, stiffness:0.05, snapThreshold:0.018,
             blocks: blocksFor('road'), visual:{ base:0x8a6a3e, edgeTop:0x9c7a4a, edgeBottom:0x6b4f2c, motif:'speckle', centerLine:false } },
  asphalt: { id:'asphalt', name:'Asphalt', type:'road', cost:4, stiffness:0.09, snapThreshold:0.03,
             blocks: blocksFor('road'), visual:{ base:0x3b4047, edgeTop:0x4c535b, edgeBottom:0x23262a, motif:'speckle', centerLine:true } },
  concrete:{ id:'concrete', name:'Concrete', type:'road', cost:6, stiffness:0.14, snapThreshold:0.05,
             blocks: blocksFor('road'), visual:{ base:0xb8bcc2, edgeTop:0xcfd3d8, edgeBottom:0x95999f, motif:'speckle', centerLine:true } },
  rope:    { id:'rope', name:'Rope', type:'beam', cost:1, stiffness:0.06, snapThreshold:0.30, thickness:5,
             blocks: blocksFor('beam'), visual:{ base:0xc8a86a, edgeTop:0xdcc088, edgeBottom:0xa5824a, motif:'twist' } },
  wood:    { id:'wood', name:'Wood', type:'beam', cost:2, stiffness:0.15, snapThreshold:0.18,
             blocks: blocksFor('beam'), visual:{ base:0xa9772f, edgeTop:0xc08f44, edgeBottom:0x835a20, motif:'grain' } },
  steel:   { id:'steel', name:'Steel', type:'beam', cost:5, stiffness:0.30, snapThreshold:0.22,
             blocks: blocksFor('beam'), visual:{ base:0x8a94a3, edgeTop:0xc2ccd8, edgeBottom:0x5f6875, motif:'sheen' } },
};
export const ROAD_MATERIALS = Object.values(MATERIALS).filter(m => m.type==='road');
export const BEAM_MATERIALS = Object.values(MATERIALS).filter(m => m.type==='beam');
```

- **`type` is KEPT** (`'road'`|`'beam'`) — it is still the drivability discriminator, so
  **no `type→category` rename** (this deletes review Major-4 and its blast radius). Every
  existing `material.type === 'road'` branch keeps working unchanged.
- New fields: `id`, `name` (submenu label), `visual` (§6), optional `thickness` (render).
- `cost` + per-size `blocks{S,M,L,XL}:{length,cost}` are built by a `blocksFor(type)`
  helper (same shape `roadMat`/`woodMat` produce today); a material's `cost` scales its
  blocks cost column.
- **Registry objects are treated immutable.** Any per-level tuning override or cheat-panel
  edit operates on a shallow **clone**, never the registry entry (see §9, review Minor-6).

**Offered palette:** with "all available from start," the submenu always lists
`ROAD_MATERIALS` / `BEAM_MATERIALS` — **no per-level material list** is needed. An
optional `ui.materials:{road:[ids],beam:[ids]}` override may be added later to restrict a
level, but is out of scope here.

**Back-compat:** `roadMat()`/`woodMat()` become thin adapters returning
`MATERIALS.asphalt` / `MATERIALS.wood` (a clone if a level passes size overrides), so the
existing 12 levels behave exactly as today. Prebuilt beams referencing `material:'road'`/
`'wood'` resolve to `asphalt`/`wood`.

## 4. Physics (`physics.js`) — essentially no change

- `buildBeam` already reads `material.stiffness`, `material.snapThreshold`, and
  `material.type` — new materials flow through untouched.
- **Friction/thickness for roads: unchanged.** Road collision body + caps keep the
  hardcoded `friction: 0.6`; road thickness stays `30`. (Not promoting road thickness
  sidesteps review Blocker-2; not touching friction sidesteps Blocker-1.)
- Beam **render** thickness (Rope thin, etc.) lives in the renderer (§6), not physics —
  beams have no collision body.
- `splitBeam` already carries `beam.material` into both halves (verified
  `LevelScene.js:740-757`) — per-material snap/stiffness survive a split. No change.
- **Iron law:** no new `scene.matter.*` call sites are introduced.

## 5. Budget model — single total pool

Replace the two hardwired pools (`_budgetRoad`/`_budgetWood`) with a single money pool
`_budget`. Each material deducts `material.cost × block-size factor`; the top bar shows one
total, as the user specified ("just show the total budget, each material has its own price").

Touch-points (verified by review — complete list):
- Pools: `LevelScene.js:230, 675, 708, 793, 811, 897, 1443, 1644, 1701`.
- **Also** (review Major-4, initially missed): `_freshBudget()` `:1551-1556` and
  `_prebuiltCost` `:137`, whose source `expandPrebuilt()` returns `{road,wood}`
  (`prebuilt.js:6,10,15`) — collapse to one `total`.
- `_flashBudget(material.type)` `:835` + `BudgetChip.js:35-39` + `TopBar.js:32-33,57-63`
  (two chips → one total chip) + the `budget:update` payload (`{road,wood}` → `{total,spent}`).
- **Level schema migration (one commit, symmetric):** every `RAW_LEVELS` budget
  `{road,wood}` → `{total: road + (wood||0)}` **and** `gdd/levels.csv` gains `budget_total`
  (legacy `budget_road/wood` readable one cycle) — applied to `RAW_LEVELS`, the generated
  overrides, and the shim together, or `roundtrip.test.js` (deep-equals all 12) breaks
  (review Major-6).

## 6. Rendering — distinct, on-style

`STYLE_SPEC.md` forbids faking the 3D hero look (vehicles/terrain/water — those are
sprites), but **beams/roads are already `Phaser.Graphics`** (`LevelScene.js:575-582`,
debris `:1219`). So per-material distinction is a legit canvas job. "Realistic" =
**realistic-reading** (tell dirt from concrete from steel at a glance), rendered in the
existing **chunky, high-contrast toy style** — distinct hue + 3-tone shading + a light
**motif**, never photoreal. Keep motifs bold; a motif that can't read as cheerful-toy at a
glance gets dropped (review Minor-7). `segments` motif is cut.

`visual = { base, edgeTop, edgeBottom, motif, centerLine }`. Motif catalogue (cheap
canvas primitives): `speckle` (dirt/asphalt/concrete aggregate), `grain` (wood),
`sheen` (steel highlight band), `twist` (rope braid), `plate` (metal seams — reserved).
The validated look is in the mockup `.superpowers/brainstorm/…/materials-visuals.html`.

Rendering sites that read `visual` instead of constants:
- The placed-beam redraw loop (`redrawBeams`, `LevelScene.js:987`) — deck fill/edges/centre-line.
- `drawRoads()` `:567-586` cliff-top strip — uses the active/starting road material so the approach matches.
- `_spawnDebris` color `:1219` — from `material.visual.base`.
- **`GhostBeam.js:146`** (review Major-3, not in v1) — the placement ghost's color/thickness reads `material.visual`.

Fallback: any missing `visual` field → today's asphalt/wood colors.

**Stress-glow caveat (review Major-3):** Rope's `snapThreshold` 0.30 vs. the global
`VISUAL_FULL_STRAIN = 0.05` means rope reads full-red long before it fails. Make
`VISUAL_FULL_STRAIN` a per-material derived value (~`0.8 × snapThreshold`) or accept &
document. Low priority; note in testing.

## 7. Submenu UI (approved mockup)

Reproduce the validated mockup (`.superpowers/brainstorm/…/toolbar-submenu.html`):

- Clicking **ROAD**/**BEAM** expands a material submenu floating above that tile (same
  `#ui-size-row` language: white card, `--shadow-float`, `--r-md`), spring-in/pop-out
  animation. Click the tile again / the other category to close/swap.
- Each material tile: canvas **swatch** (its actual `visual`) + **name** + gold `$cost`,
  blue active state; hover → one-line personality tooltip. Header shows the active pick's
  unit price ("Concrete · $6/block").
- **Total budget** stays in the top-bar chip; flashes when a cost applies.
- New `src/ui-html/components/MaterialSubmenu.js`; new bus events `materials:show
  {type,list,current}`, `material:select {id}`. Toolbar `tool:select` for road/beam
  toggles the submenu; the existing size row (S/M/L/XL) still applies after, now showing
  the chosen material's `blocks`. Flow: **tool → material → size**.
- Teardown (review Minor-8): LevelScene owns the `material:select` handler in its
  `_busHandlers` map + `shutdown` `bus.off` (mirrors the existing 12). `MaterialSubmenu`
  mounts once for app lifetime like other UI components.

## 8. Save/load migration (review Blocker-2)

`saveload.js:11` persists `material.type`; storing the new set unchanged would (a) lose
*which* material a beam was, and (b) already only round-trips road/wood. Fix:
- Persist **`material.id`**; bump save `version` to 2.
- On load (`LevelScene.js:1806-1808`) resolve `MATERIALS[savedBeam.id]`; legacy shim maps
  old `'road'→asphalt`, `'wood'→wood`.
- Update `tests/saveload.test.js`.

## 9. Invariants & risks (`AI_CODING_GUIDE.md` + review)

- **Iron law** intact — no new `scene.matter.*` sites.
- **Constraint-pointer refresh** after `rebuildBridge`/`splitBeam` unchanged; material rides
  on the constraint and is verified to survive a split.
- **Scene teardown** null-guards + `bus.off` for the new handler (§7).
- **Registry immutability** — clone before any per-beam/cheat mutation; `updateBeamMaterial`
  (`physics.js:592-597`) must not write through to registry objects (review Minor-6).

## 10. Testing

- **Unit (Vitest):** registry integrity (every id has required fields; `type` partitions
  road/beam); single-pool budget accounting (place/undo/remove/clear conserve coins);
  legacy `{road,wood}`→`total` shim; save/load id round-trip + legacy shim; CSV
  `budget_total` round-trip.
- **Must update (review Major-5/6):** `tests/saveload.test.js`, `tests/levels.test.js`
  (budget-direction + materials-blocks asserts), `tests/prebuilt.test.js` (single-pool
  return), `tests/roundtrip.test.js` (symmetric migration), `tests/ui-html/BudgetChip.test.js`,
  `tests/Toolbar.test.js` (submenu). 
- **Manual (run the app):** place all 6 materials, confirm distinct look; a Dirt deck sags/
  snaps under a truck where Concrete holds; a Steel-braced deck holds where a Rope-braced one
  drops; submenu open/close animation + budget flash; load an old save (legacy shim).

## 11. CSV pipeline (review Minor-7)

Append new columns at the **end** of `LEVEL_HEADER` (`levelKnobs.js:11-15`) to avoid
positional desync; update the three in-sync spots (`LEVEL_HEADER`, parse `:71-97`,
serialize `:126-143`) together. Only `budget_total` is needed now (no per-level material
columns, since all materials are always available). Keep `road_sizes/wood_sizes` semantics.

## 12. Out of scope

Friction/grip differences & skid FX; wheel-torque drive; per-module material gating;
per-level material restriction (`ui.materials`); pre-rendered sprite assets; per-material
audio; a 4th+ material per category.

## 13. Review-findings disposition (3-agent review, 2026-07-03)

| Finding | Disposition |
|---|---|
| Physics Blocker-1: `frictionStatic` combines as MAX (dead numbers) | **Moot** — friction cut from scope. |
| Physics Blocker-2: road thickness breaks kinematic reposition | **Avoided** — road thickness unchanged; beam thickness is render-only. |
| Physics Major-3: high snapThreshold decouples stress glow | **Accepted** — §6 caveat, low priority. |
| Physics Major-4: `type→category` not a blanket sweep | **Moot** — `type` kept, no rename. |
| Physics Minor-6: `updateBeamMaterial` mutates registry | **Adopted** — §9 immutability rule. |
| Fit Blocker-1: `level.materials` shape collision | **Avoided** — registry holds tuning; no per-level id-list. |
| Fit Blocker-2: save/load persists `type` | **Adopted** — §8 persist `id` + shim + version. |
| Fit Major-3: missed `.type`/render touch-points (GhostBeam etc.) | **Adopted** — §6 lists GhostBeam; `type` kept so most are no-ops. |
| Fit Major-4/5/6: budget plumbing + test fallout | **Adopted** — §5, §10 enumerate. |
| Fit Minor-7: CSV positional desync | **Adopted** — §11 append-at-end. |
| Design M1: gate materials per module | **Overridden by user** — all available from start. |
| Design M2: bind tutorial cards + skid FX | **Moot** — friction/grip out of scope. |
| Design M3: cut Tar/Cable, trim lineup | **Adopted & extended** — user set 3 roads + 3 beams. |
| Design M4: authoring combinatorics | **Reduced** — 3+3, no size-explosion vs. the 5+5 concern. |
| Design m5: rename Girder | **Moot** — Girder/I-Beam not in the final set. |

## 14. Phasing

1. **Registry + adapters** — `materials.js`, `roadMat`/`woodMat` adapters, prebuilt/material
   resolution by id. Keep `type`. Unit-test registry + back-compat (12 levels unchanged).
2. **Budget unification** — single `_budget`, `_freshBudget`/`_prebuiltCost`/`expandPrebuilt`,
   `RAW_LEVELS` + CSV `budget_total` migration, BudgetChip/TopBar single chip, tests.
3. **Rendering** — `visual` motifs drive deck/beam/debris/ghost; motif primitives.
4. **Submenu UI** — `MaterialSubmenu.js`, bus events, toolbar toggle, size row after, teardown.
5. **Save/load migration** — persist `id`, legacy shim, version bump, tests.

Each phase ends with `npm test`; phases 3–4 also need `npm run dev` play-through.
