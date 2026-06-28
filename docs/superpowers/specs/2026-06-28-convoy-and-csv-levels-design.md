---
Date: 2026-06-28
Content Type: Design Spec
---

# Convoy Vehicles + CSV Level Design — Design Spec

Two related features for Bridge Builder:

1. **Convoy** — a level can send multiple vehicles across in sequence (a time-gapped
   convoy, mixed types), instead of the single vehicle used today.
2. **CSV game-design doc** — a build-time CSV pipeline so per-level *knobs* (budgets,
   vehicle convoy, block sizes, tools, gravity, span) can be authored/tuned in a
   spreadsheet that overrides the code defaults.

They are one spec because the CSV's `vehicles` column authors the convoy. They ship as
**two implementation plans** (convoy first — it defines the schema the CSV generates).

> Verified against `main` @ `17710a8` (post lesson-structure rework). All file:line
> references below are current as of this scan.

## North Star

Bridge Constructor Portal fidelity: a convoy crossing tests *cumulative* load — several
vehicles on the deck at once — and the drama is whether the bridge holds for the whole
column, not just one car. The CSV is the balance sheet a designer tunes that drama from.

---

# Feature 1 — Convoy (multiple vehicles in sequence)

## Behavior (decided)

- **Sequential with a time gap.** Vehicle *i+1* spawns `convoyGapMs` after vehicle *i*
  spawns, so multiple vehicles can be on the bridge simultaneously.
- **Win = every vehicle reaches the checkpoint.** **Fail = the instant any vehicle drops
  below the world.** (Same `_checkpointX` / fall threshold as today, applied per vehicle.)
- **Camera frames the whole bridge** during the run (already the behavior since `34a5c30`).
- A vehicle that has crossed keeps driving off the far side and is **despawned once fully
  off-screen** so it can't pile up and block followers.
- Mixed types allowed (`car`, `truck`, `tank`), each with its own resolved design.
- **Progress indicator:** during the run a small "N/total across" counter is shown (HUD,
  via the bus) and updates as each vehicle crosses `_checkpointX`; the win modal still
  fires only after the last one crosses. For a length-1 convoy the counter is hidden so
  single-vehicle levels look exactly as they do today.

## The core change: single vehicle → array

Today `physics._vehicle` is one object and every physics method assumes it
(`physics.js`: `spawnVehicle` 391–444, `driveVehicle` 446–478, `freezeVehicle` 371–379,
`removeVehicle` 381–389, `getVehicleChassisPosition` 526–528, `applyVehicleLoad` 726–753,
`reset` 114–132). This is the heart of the feature.

### `physics.js` (still the ONLY file that calls `scene.matter.*`)

- `this._vehicle` → `this._vehicles = []`. Each entry: `{ id, chassis, wheelA, wheelB,
  axleA, axleB, config }` (unchanged shape, now many).
- **`spawnVehicle(config)`** pushes a new entry and returns it. It accepts an optional
  `config.id` (caller-supplied stable id); otherwise assigns an incrementing one.
  **Collision group** becomes `-(2 + index)` so each vehicle's own chassis↔wheels never
  collide, but *different* vehicles fall back to category/mask and **can rear-end each
  other** (category `VEHICLE 0x0001`, masks already allow vehicle↔vehicle).
- **`driveVehicle()`** iterates all vehicles, applying the existing per-chassis force +
  angular damping to each (drive direction from each `config.spawnAt`).
- **`applyVehicleLoad()`** iterates all vehicles, distributing each one's mass onto the
  beam it is currently over (the existing scalar-projection logic, per vehicle).
- **`freezeVehicle(id?)`** freezes one vehicle by id, or all when `id` omitted.
- **`removeVehicle(id)`** removes one by id (chassis+wheels+axles); `reset()` removes all
  and clears the array (null-guarded per teardown rules in AI_CODING_GUIDE §3).
- **New `getVehicles()`** → `[{ id, position: {x,y}, config }]` for scene-side win/fail.
  `getVehicleChassisPosition()` stays (returns the **lead** vehicle, or null) for the
  cheat HUD / debug; new code uses `getVehicles()`.
- **`getDebugInfo()`** reports the lead vehicle (index 0) as today.

### New pure module `src/systems/convoy.js` (no Phaser — unit-tested)

A `makeConvoyController({ vehicles, gapMs })` returning a controller with one method
`tick(nowMs, vehicleStates) → { toSpawn: [...], won: bool, failed: bool, crossedCount,
total }` where `vehicleStates` is `[{ id, x, y, crossed }]` from the scene. It owns:

- the spawn schedule (which queued vehicles are due at `nowMs`),
- the **win** decision (all queued spawned AND every spawned vehicle `crossed`),
- the **fail** decision (any vehicle `y > worldHeight + 40`).

Keeping this pure isolates the gnarly sequencing from the 1700-line scene and makes spawn
cadence / win / fail trivially testable. `nowMs` is passed in (scene clock), never read
inside — so tests drive time deterministically.

### `src/utils/vehicleDesign.js` — convoy resolution

Add `resolveConvoy(level, presets, selectedKey)` →
`[{ type, spawnAt, ...vehicleParamsFromDesign(resolvedDesign) }]`, one per convoy entry.

- **Locked levels** (`ui.vehicleSelect === false`, the common case): use each
  `level.vehicles[i].type` + its `design` override on top of the preset (extends the
  existing `resolveVehicleDesign` logic from one vehicle to many).
- **Unlocked levels** (sandbox / `DEV_STRESS`): single player-selected vehicle as today
  (the cheat-panel sliders still drive it). Convoys are a locked-level construct.

The existing `resolveVehicleDesign` stays for back-compat; `resolveConvoy` is the new
multi-entry entry point. Both share a private `resolveOne(vehicleEntry, presets, key,
locked)` helper.

### `LevelScene.js`

- **`toggleTest` build→test** (1292–1333): instead of spawning `vehicles[0]`, build the
  convoy via `resolveConvoy(...)`, create `this._convoy = makeConvoyController({ vehicles,
  gapMs: level.convoyGapMs ?? DEFAULT_GAP })`, spawn vehicle #1 immediately, and reset
  per-vehicle crossed state. (For unlocked levels the convoy is length-1, so behavior is
  identical to today.)
- **`update` test loop** (1476–1518): build `vehicleStates` from `physics.getVehicles()`
  (tagging `crossed` once `x >= _checkpointX`), call `this._convoy.tick(now, states)`:
  spawn any `toSpawn`, despawn crossed-and-off-screen vehicles, and on `won`/`failed`
  call the existing `showWin()` / `showFail()`. `checkWin`/`checkFall` are replaced by the
  controller's verdict (their single-vehicle bodies are removed).
- **Sprites**: `_vehicleSprite` (single) → `this._vehicleSprites = new Map(id → sprite)`.
  `redrawVehicle()` iterates `physics.getVehicles()`, drawing one sprite per live vehicle
  using *that vehicle's* type texture (keeping the existing sink-fade + squash per
  vehicle). Sprites for despawned vehicles are destroyed; all cleared on reset/build.
- **Cheat panel**: unchanged for unlocked single-vehicle levels; ignored for true convoys
  (each vehicle uses its level design). One comment notes this.

### Level schema additions

- `level.convoyGapMs` (number, optional; default `1500`).
- `level.vehicles` stays an array; convoy levels list 2+ entries `{ type, spawnAt,
  design? }`. No breaking change — every existing single-entry level keeps working.

---

# Feature 2 — CSV game-design-doc pipeline

## Precedence model (decided)

Code (`leveldata.js`) defines geometry **and** sane defaults for every level. The CSV
**overrides knobs** where present. A level with no CSV row keeps its code values. The CSV
is an optional balance sheet layered on top of code — it never blanks a value by omission.

## Source files (pre-seeded from current levels)

`export:levels` writes these from the current `ALL_LEVELS` so they start as an exact
mirror of today's config (you edit from there). **Refuses to overwrite existing files
unless run with `--force`**, so it can't clobber later edits.

1. **`gdd/levels.csv`** — one row per level:

| column | meaning | example |
|---|---|---|
| `id` | matches a code level id | `L05` |
| `vehicles` | ordered convoy as a type list (length = count, repeats = per-type count) | `car,car,truck` |
| `spawn_at` | side all vehicles enter from | `left` |
| `convoy_gap_ms` | gap between spawns | `1500` |
| `budget_road` / `budget_wood` | coins per material | `20` / `12` |
| `road_sizes` / `wood_sizes` | which block sizes exist | `M,L` / `S,M,L` |
| `tools` | enabled tool tiles | `road,beam` |
| `span` | span value | `4.4` |
| `gravity_y` / `gravity_label` | gravity knob | `1.5` / `Normal` |
| `vehicle_select` / `delete` / `budget_meter` / `stress_glow` | optional bools | `false` |

A blank cell means "don't override; keep the code default."

2. **`gdd/vehicle_designs.csv`** — *sparse* per-type design overrides (only rows that need
   a custom-weight vehicle):

| `level_id` | `type` | `weight` | `speed` | `acceleration` |
|---|---|---|---|---|
| `L05` | `truck` | `6` | `4` | `5` |

Any `(level, type)` not listed uses the preset defaults; within a level every vehicle of
that type picks up the override.

## Build step — `npm run gen:levels`

`scripts/genLevels.mjs`:
- Parses both CSVs, **validates** (id exists in code; vehicle types ∈ presets; sizes ∈
  S/M/L/XL; numbers parse; tools known). Bad data → **fail loudly with row + column**. A
  *missing* level row is fine (falls through to code).
- Emits committed, hand-readable `src/data/levelOverrides.generated.js` exporting
  `{ L05: { budget, vehicles, convoyGapMs, materials, ui, span, gravity, stressGlow }, … }`.
- No CSV parser ships in the runtime bundle — generation is offline.

## Seed step — `npm run export:levels`

`scripts/exportLevels.mjs` reads `ALL_LEVELS`, serializes each level's knobs into the two
CSV shapes, and writes them (refusing existing files without `--force`). Run once to seed.

## Merge — pure `src/data/levelKnobs.js`

`mergeLevelKnobs(baseLevel, knobs)` (no Phaser) deep-merges overrides onto a code level,
expanding: the `vehicles` type-list → the real `vehicles` array (with design overrides),
`road_sizes`/`wood_sizes` → `roadMat()/woodMat()` material objects, and scalar columns →
their level fields. `leveldata.js` resolves `ALL_LEVELS` through this at module load
(merging `levelOverrides.generated.js`). Also export `parseLevelsCsv` / `parseDesignsCsv`
(shared by the gen script and tests).

## Round-trip guarantee

`export:levels` → `gen:levels` → `mergeLevelKnobs` over the same code base must reproduce
today's levels. A test asserts this so the seeded CSV is a faithful starting mirror.

---

# Files

| Action | Path | Purpose |
|---|---|---|
| new | `src/systems/convoy.js` | pure `makeConvoyController` (spawn cadence, win/fail) |
| edit | `src/systems/physics.js` | `_vehicle` → `_vehicles[]`; per-vehicle group; iterate drive/load/freeze/remove; `getVehicles()` |
| edit | `src/utils/vehicleDesign.js` | `resolveConvoy()` + shared `resolveOne()` |
| edit | `src/scenes/LevelScene.js` | convoy wiring in `toggleTest`/`update`; sprite Map; controller-driven win/fail/despawn |
| edit | `src/data/leveldata.js` | `convoyGapMs`; resolve `ALL_LEVELS` through `mergeLevelKnobs` |
| new | `src/data/levelKnobs.js` | pure `mergeLevelKnobs` + CSV parse helpers |
| new | `src/data/levelOverrides.generated.js` | committed, emitted by gen script |
| new | `gdd/levels.csv`, `gdd/vehicle_designs.csv` | committed, seeded from current levels |
| new | `scripts/genLevels.mjs` | `npm run gen:levels` (CSV → generated overrides) |
| new | `scripts/exportLevels.mjs` | `npm run export:levels` (levels → CSV, `--force` to re-seed) |
| edit | `package.json` | `gen:levels`, `export:levels` scripts |

`gdd/` is hand-authored design source, so it sits at repo root (per the global rule,
`docs/` is for generated docs/reports, not source data).

# Tests (Vitest, headless)

- `convoy.test.js` — spawn cadence (gap timing), win only after all cross, fail on first
  fall, despawn-after-crossed, length-1 convoy == single-vehicle behavior.
- `levelKnobs.test.js` — merge precedence (blank = keep default), `vehicles` list
  expansion, design overrides, size-list → material objects, validation errors.
- `roundtrip.test.js` — export → gen → merge equals current `ALL_LEVELS`.
- Extend `physics`-level coverage: two vehicles coexist and both drive (headless world).
- Existing `tests/levels.test.js` / `tests/vehicleDesign.test.js` must stay green.

# Verification (per AI_CODING_GUIDE §0)

Run the app and watch a real convoy: multiple vehicles spawn at the gap, several on the
deck at once, win only when all cross, fail when one drops. Watch `page.on('pageerror')`
across a scene transition. (Playwright isn't currently installed; if it stays uninstalled
this is a manual eyeball check.)

# Out of scope

- Distance-based gaps, partial-credit "quota" wins, all-at-once spawning (considered,
  rejected in brainstorming).
- CSV-authored geometry (terrain verts, rock/anchor positions stay in code).
- Runtime CSV loading / dev import panel (build-time generation only).
- Apps/Modules authoring via CSV (the lesson structure stays in code).

# Phasing

- **Plan A — Convoy runtime** (physics array, `convoy.js`, `resolveConvoy`, scene wiring,
  sprites, win/fail). Independently shippable; defines the vehicle schema.
- **Plan B — CSV pipeline** (`levelKnobs.js`, gen/export scripts, seeded CSVs, generated
  overrides, round-trip test). Depends on A's finalized `vehicles`/`convoyGapMs` schema.
