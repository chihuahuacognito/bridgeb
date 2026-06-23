# FX Character (Phase 3) Implementation Plan

**Goal:** Give the vehicle character — a brief **squash-and-stretch** on hard landings, and a celebratory **victory** shard fountain when a level is won.

**Spec:** `docs/2026-06-23-fx-juice-pass-design.md` (Phase 3 rows + Squash section)

**Architecture:**
- `redrawVehicle()` runs every frame and calls `setDisplaySize(120,72)`, which overwrites `scaleX/scaleY` — so a tween on the sprite scale is stomped. Instead `fx` owns a squash state `{ sx, sy }` driven by a short internal tween (squashed → 1,1). `redrawVehicle` reads it via `fx.getSquash()` and applies `setDisplaySize(120*sx, 72*sy)` (sprite path) / scales the procedural half-extents (fallback path).
- New persistent `_victoryEmitter` (upward shard fountain, depth 6) + `fx.victory(x,y)`.
- Triggers: squash on `setOnHardLanding` (power-scaled), victory from `showWin()` using `getVehicleChassisPosition()` (sprite may be hidden).

**Tuning constants (initial):**
| Constant | Value | Where |
|----------|-------|-------|
| `SQUASH_MAX` | 0.35 | fx.js (max squash/stretch fraction at power 1) |
| squash restore duration | 200ms, `Back.out` | fx.js |
| `VICTORY_COUNT` | 28 | fx.js |

---

## Task 1: fx.js — squash state + victory emitter

- Pure `squashParams(power)` export → `{ sx: 1+k, sy: 1-k }`, `k = SQUASH_MAX*clamp01(power)`.
- State `_squash = { sx: 1, sy: 1 }`; `squash(power)` sets the squashed target then tweens `_squash` back to `{1,1}`; `getSquash()` returns it; `reset()` restores `{1,1}`.
- `_victoryEmitter` (4th emitter): yellow-white shards, upward cone, gravity (fountain arc), longer life, depth 6. `victory(x,y)` explodes `VICTORY_COUNT`. No-op when detached.
- Update existing lifecycle test (now 4 emitters), add squashParams/squash/getSquash/victory tests.

## Task 2: LevelScene wiring

- `redrawVehicle`: `const { sx, sy } = fx.getSquash();` → sprite `setDisplaySize(120*sx, 72*sy)`; procedural `hw*sx`, `hh*sy`. Keep sink-fade alpha.
- In the `setOnHardLanding` handler add `fx.squash(info.power)` alongside `fx.dust(...)`.
- In `showWin()`: `const p = physics.getVehicleChassisPosition(); if (p) fx.victory(p.x, p.y);`.
- Verify `npm test` + `npm run build`; in-app via user screenshot.
