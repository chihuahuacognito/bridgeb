# FX Impact Feedback (Phase 2) Implementation Plan

**Goal:** Add impact juice — a tan **dust** puff when a wheel lands hard on a surface, and a yellow-white **spark** burst at each beam snap point.

**Spec:** `docs/2026-06-23-fx-juice-pass-design.md` (Phase 2 rows)

**Architecture:**
- `fx.js` gains two more persistent emitters (`_dustEmitter`, `_sparkEmitter`) built from procedural textures (`fx-droplet` reused for dust; new `fx-shard` triangle for sparks), plus `fx.dust(x,y,power)` / `fx.spark(x,y)` and a pure `dustParams(power)` helper.
- `physics.js` gains the project's FIRST `collisionstart` listener (registered in `attach`, removed in `detach`, mirroring `_beforeUpdateCb`). It matches `vehicle-wheel` ↔ ground (`terrain`/`rock`/`beam`/`beam-cap`) pairs by **label**, reads the wheel's downward Matter `velocity.y`, debounces per-wheel, and fires `setOnHardLanding({x,y,power})`. Pure helpers `isGroundLabel`, `classifyLandingPair`, `landingPower` are exported and unit-tested directly (mirroring `readStressNormalized`).
- `LevelScene` calls `fx.spark(mx,my)` inside the EXISTING `setOnSnap` handler, and wires `physics.setOnHardLanding(info => fx.dust(info.x, info.y, info.power))`.

**Tuning constants (initial; tune in-app):**
| Constant | Value | Units | Where |
|----------|-------|-------|-------|
| `LANDING_VY_THRESHOLD` | 6 | Matter px/step | physics.js |
| `REF_LANDING_VY` | 14 | Matter px/step | physics.js |
| `LANDING_COOLDOWN_MS` | 150 | ms | physics.js |
| `DUST_MIN/MAX` | 4 / 14 | count | fx.js |
| spark count | 10 | count (fixed) | fx.js |

---

## Task 1: fx.js — dust + spark emitters, textures, pure helper

- `fx-shard` texture: small white triangle (~6px) via `fillTriangle`, guarded by `textures.exists`.
- `dustParams(power)` pure export: `{ count }` scaling DUST_MIN→DUST_MAX (mirror `emitParams`).
- `_dustEmitter`: tan tint `0xc8b48c`, low slow puff (small speed, short lifespan, slight up drift, fade), depth 6.
- `_sparkEmitter`: yellow-white tint `0xfff2a0`, fast shards, gravity, short life, depth 6.
- `dust(x,y,power)`: explode `dustParams(power).count`; `spark(x,y)`: explode fixed count. Both no-op when detached.
- `attach` creates all three emitters; `detach` destroys all; `reset` killAll on all.
- Tests (append to `tests/fx.test.js`): shard texture idempotent; dustParams scaling+clamp; dust/spark explode with expected counts at point; reset clears; detached no-op.

## Task 2: physics.js — setOnHardLanding + collisionstart

- Pure exports + tests (new `tests/hardLanding.test.js`, mirroring stressReader):
  - `isGroundLabel(label)` → true for terrain/rock/beam/beam-cap.
  - `classifyLandingPair(labelA,labelB)` → `'A'|'B'|null` (which body is the wheel landing on ground; null otherwise — e.g. chassis ignored).
  - `landingPower(vy, ref)` → clamp(vy/ref,0,1) for vy>0 else 0.
- State: `_onHardLandingCallback`, `_wheelLandAt: new Map()`, consts above.
- `setOnHardLanding(cb)`.
- `attach`: register `_collisionStartCb = (e)=>this._handleCollisions(e)` on `'collisionstart'`.
- `_handleCollisions(event)`: for each pair, `classifyLandingPair`; wheel = matched body; `vy = wheel.velocity.y`; if `vy > LANDING_VY_THRESHOLD` and not within `LANDING_COOLDOWN_MS` of this wheel's last fire → fire `{x: wheel.position.x, y: wheel.position.y, power: landingPower(vy, REF_LANDING_VY)}`, record `_wheelLandAt.set(wheel.id, now)`.
- `detach`: `world.off('collisionstart', cb)`; `reset`: `_wheelLandAt.clear()`; also clear in `detach`.
- Integration test via mock scene (capture the registered handler; invoke with synthetic pairs; assert fires above threshold, ignores below, ignores chassis pair, debounces within cooldown).

## Task 3: Wire into LevelScene

- Import `fx.dust`/`fx.spark` are methods on default `fx` (already imported).
- In existing `setOnSnap` handler (line ~199) add `fx.spark(mx, my);`.
- Near it, add `physics.setOnHardLanding((info) => fx.dust(info.x, info.y, info.power));`.
- Verify `npm test` (no new failures) + `npm run build`; in-app check via user screenshot.
