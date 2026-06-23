---
Date: 2026-06-23
Content Type: Design Spec
Status: Approved (architecture + module mapping)
---

# Lesson Structure — App Shell + Bridge Builder Modules

## Goal

Introduce a lesson-based navigation shell. A new top-level **App Select** screen
offers three apps; only **Bridge Builder** is unlocked. Bridge Builder opens a
**Module Select** screen with three STEM modules plus the Dev Stress Test. Each
module groups four of the existing twelve levels by rising mechanical complexity.

## Flow

```
AppSelectScene ── Bridge Builder ──▶ ModuleSelectScene ── module ──▶ LevelSelectScene ── level ──▶ LevelScene
   │  (Rocket Launch 🔒, My Farm 🔒 — non-interactive)        │  (Dev Stress Test ─────────────────────────▶ LevelScene: DEV_STRESS)
```

`BootScene` boots to `AppSelectScene` (today it boots to `MenuScene`).

## Scope

In scope:
- `AppSelectScene` (new) — three app tiles; Bridge Builder unlocked, the other two locked.
- `ModuleSelectScene` (new) — three module cards + a Dev Stress Test option + Back.
- `LevelSelectScene` — generalize today's `MenuScene` to render one module's levels + Back.
- A `MODULES` data table + `APPS` data table in `leveldata.js`, plus a `moduleForLevel()` helper.
- Back/Home navigation wiring across the new tiers.

Out of scope (explicit per approval):
- No unlock gating or progress persistence inside Bridge Builder — every module and level is playable.
- Rocket Launch / My Farm are visual-only locked tiles (no app behind them yet).
- No changes to gameplay, level data content, or level names — levels are only regrouped.

## Decisions (approved)

- **Three-tier scene chain** (scene-per-tier), extending the existing `Boot → Menu → Level` pattern rather than a mega-scene or HTML overlays.
- **Everything open** inside Bridge Builder — no per-level/module locks, no persistence.
- **Module mapping (4-4-4, increasing complexity), level content unchanged:**

| Module id | Title | Topic blurb | levelIds |
|-----------|-------|-------------|----------|
| `M1_GRAVITY` | Gravity & Falling | Things fall — span the gap before gravity wins | L01, L02, L03, L04 |
| `M2_SHAPES` | Strong Shapes | Triangles and load paths make bridges strong | L05, L06, L07, L08 |
| `M3_WEIGHT` | Weight & Engineering | Carry heavy loads on a budget | L09, L10, L11, L12 |

`MODULE_ORDER = ['M1_GRAVITY','M2_SHAPES','M3_WEIGHT']`. The concatenation of module `levelIds` equals the existing `LEVEL_ORDER` (L01..L12), so cross-level "Next" still works globally.

## Architecture

### Data (`src/data/leveldata.js`)
- `APPS`: `[{ id:'bridge', title:'Bridge Builder', locked:false }, { id:'rocket', title:'Rocket Launch', locked:true }, { id:'farm', title:'My Farm', locked:true }]`.
- `MODULES`: map of `{ id, title, blurb, levelIds:[...] }` as above; `MODULE_ORDER`.
- `moduleForLevel(levelId)`: returns the module id containing a level, or `null` (e.g. `DEV_STRESS`).
- Keep `ALL_LEVELS`, `LEVEL_ORDER`, `menuEntries` (still used for level cards).

### Scenes (`src/scenes/`)
- `AppSelectScene`: three centered app tiles. Bridge Builder → `scene.start('ModuleSelectScene')`. Locked tiles render greyed with a 🔒 badge + "Coming soon" and are non-interactive. Emits `bus.emit('ui:screen','menu')` on create (hides the in-game HTML HUD).
- `ModuleSelectScene`: title "Bridge Builder", three module cards (title + blurb), a Dev Stress Test button (→ `LevelScene { levelId:'DEV_STRESS' }`), and a Back button → `AppSelectScene`. Card → `scene.start('LevelSelectScene', { moduleId })`. Emits `ui:screen`,`menu`.
- `LevelSelectScene` (generalized `MenuScene`): receives `{ moduleId }`, shows the module title and that module's level cards (reusing the existing card style + `PHASE_COLORS`/`PHASE_LABELS`), numbered 1–4 within the module. Card → `LevelScene { levelId }`. Back → `ModuleSelectScene`. Emits `ui:screen`,`menu`. The old flat 12-card grid + the scene name `MenuScene` are retired (file renamed/repurposed).
- `LevelScene` (minimal change): the in-game **Home** action and the result modal's **Menu** action go to the current level's module via `moduleForLevel(levelId)` → `LevelSelectScene { moduleId }`; if `null` (Dev Stress Test) → `ModuleSelectScene`. **Next Level** keeps using global `LEVEL_ORDER` (unchanged), so progression flows across module boundaries.

### Wiring
- `src/main.js` scene list: `[BootScene, AppSelectScene, ModuleSelectScene, LevelSelectScene, LevelScene]`.
- `BootScene` final `scene.start(...)` target changes to `AppSelectScene`.
- Find current Home/Menu navigation targets in `LevelScene` and the result-modal handler and repoint them per above.

## Testing

Scene transitions and Phaser-canvas rendering are verified in-app (per `docs/AI_CODING_GUIDE.md`). Unit-testable data invariants (new `tests/modules.test.js`, mirroring `tests/levels.test.js`):
- Every `MODULE_ORDER` id exists in `MODULES`; each module has exactly 4 `levelIds`.
- Every level in `LEVEL_ORDER` appears in exactly one module; no module references an unknown level id.
- Concatenated module `levelIds` (in `MODULE_ORDER`) equals `LEVEL_ORDER`.
- `moduleForLevel(id)` returns the correct module for each level and `null` for `DEV_STRESS`.
- `APPS` has exactly one unlocked app (`bridge`).

## Risks / Notes

- HTML HUD bleed-through: the new menu scenes must emit `ui:screen','menu'` so `#ui-toolbar`/sidebar stay hidden (same mechanism today's `MenuScene` relies on).
- `MenuScene` is referenced by `BootScene` and `main.js`; renaming to `LevelSelectScene` requires updating both. A safe path: add the new scenes, repoint Boot to `AppSelectScene`, then repurpose `MenuScene`→`LevelSelectScene` last.
