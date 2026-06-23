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

## Review Refinements (agent-vetted — binding)

- **One navigation handler, not two.** The in-game Home button (`TopBar.js`) and the result modal's Menu button (`ResultModal.js`) both emit the single bus event `level:menu`, handled once at `LevelScene.js:285` (`levelMenu: () => this.scene.start('MenuScene')`). Repoint that one handler:
  ```js
  levelMenu: () => {
    const m = moduleForLevel(this.levelId);
    if (m) this.scene.start('LevelSelectScene', { moduleId: m });
    else   this.scene.start('ModuleSelectScene');
  }
  ```
  Add `moduleForLevel` to LevelScene's existing `leveldata.js` import (today only `ALL_LEVELS, LEVEL_ORDER`). No edits to TopBar/ResultModal.
- **Scene data via `init(data)`**, mirroring `LevelScene.js:117`. `LevelSelectScene.init(data){ this.moduleId = data?.moduleId || MODULE_ORDER[0]; }`. Create ALL display objects in `create()`, never in `init()`.
- **Per-module level cards:** build from `menuEntries(ALL_LEVELS, MODULES[moduleId].levelIds)` (the helper already takes `(allLevels, order)` — no signature change). Card number = `1 + index within the module`. Cards keep their **per-level** `phase` color/label (`PHASE_COLORS`/`PHASE_LABELS`); modules are intentionally **not** phase-homogeneous (M1 = tutorial×3+topic, M3 = topic+challenge×3) — do not invent a per-module color.
- **AppSelectScene is the root** (BootScene starts it): no Back button. **Locked tiles** (rocket, farm): rendered greyed with a lock badge + "Coming soon", **no `setInteractive` and no pointer handler** (pure visual). Use a text badge (emoji 🔒 acceptable on Windows; plain "LOCKED" is the safe fallback).
- **Atomic rename.** Scene keys are strings, so a mismatch is a silent black screen (no build error). In one commit update: `main.js` import + `scene:[]` array, `BootScene` start target → `AppSelectScene`, the `MenuScene` class/`super()` → `LevelSelectScene`, and `LevelScene.js:285`.
- **L12 terminal & Dev Stress:** unchanged Next logic — L12 shows no Next (`hasNext` false), its Menu → `LevelSelectScene{M3_WEIGHT}`. `DEV_STRESS` → `moduleForLevel` returns `null` → Menu/Home → `ModuleSelectScene`; it has no Next.
- **Test additions:** `APPS.length === 3`, exactly one `locked:false` and its `id === 'bridge'`; no `levelId` appears in two modules and none duplicated within a module; `moduleForLevel('DEV_STRESS') === null` and `moduleForLevel('NOPE') === null`; for every `id` in each module's `levelIds`, `moduleForLevel(id)` equals that module id.

## Risks / Notes

- HTML HUD bleed-through: the new menu scenes must emit `ui:screen','menu'` so `#ui-toolbar`/sidebar stay hidden (same mechanism today's `MenuScene` relies on).
- `MenuScene` is referenced by `BootScene` and `main.js`; renaming to `LevelSelectScene` requires updating both. A safe path: add the new scenes, repoint Boot to `AppSelectScene`, then repurpose `MenuScene`→`LevelSelectScene` last.
