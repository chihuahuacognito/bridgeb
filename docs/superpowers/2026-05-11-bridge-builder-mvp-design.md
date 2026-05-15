---
Date: 2026-05-11
Content Type: Technical Design Spec
Author: Bridge Builder design team (Claude Opus + user iteration)
Status: Draft v1.0 — post-expert-review, awaiting user approval before writing-plans
Version: 1.0
---

# Bridge Builder MVP — Technical Design Spec (v1 stakeholder demo)

**Companion to:** `F:\newprojects\Soalris\bridge_builder_mvp_gdd.md` — the game design document (what the game IS, level scenarios, BCP-fidelity pillars, success metrics).

**This document:** the technical design — how we build it. Self-contained for the implementer and for the writing-plans step that follows.

**Phase covered:** Phase 1 (Core Mechanics, sessions 1–8.5) primarily; architecture, storage, and data shapes are forward-compatible through Phase 4 (Sandbox editor) and beyond.

---

## 1. Context & scope

### What this is
A 2D physics bridge-building game for browser, stakeholder-demo grade. The v1 demo deliverable is the full Phase-1 to Phase-4 build: 5 curated levels (L1–L2 polished, L3–L5 mechanically working) + a working Sandbox editor with save/replay. Phase 1 alone delivers a single playable L1 with BCP-fidelity physics-feel.

### Locked decisions (do not relitigate)

| Decision | Lock |
|---|---|
| **Stack** | Phaser 3 + Matter.js (via Phaser's Matter plugin in v1), Vite, npm, ESLint, Vitest |
| **Repo** | New sibling directory `F:\newprojects\bridge-builder` + new GitHub repo. Not yet scaffolded. |
| **Save layer** | IndexedDB via the `idb` library (Jake Archibald, ~1KB gzipped, promise-wrapped) |
| **Target device** | Desktop browser (Chrome / Edge), mouse input, mobile-friendly hit zones. 1080p–1440p resolution. |
| **North star** | Bridge Constructor Portal physics-fidelity — see GDD §1 for the four pillars: physics-feel, visual language, camera, audio |
| **v1 audience** | Stakeholders (not children) |
| **Asset sourcing** | Programmatic primitives (Phaser `Graphics`) for bridge structural elements; **Kenney CC0** for vehicles, backdrops, UI; **Freesound CC0 + CC-BY** for SFX. Zero external assets in Phase 1. |
| **Implementation approach** | "A with Phase-1 escape hatch to B." **Approach A** = Phaser's `scene.matter.*` plugin (unified API, fastest start). **Approach B** = standalone `matter-js` engine with manual step, Phaser used only as renderer. Start with A; migrate `systems/physics.js` to B at session 8.5 if the plugin fights slow-mo or sub-stepping. |

### In scope for v1 demo (Phases 1–4)
- L1–L5 curated levels (L1–L2 polished to demo grade; L3–L5 mechanically working)
- Working Sandbox editor with Environment / Anchor / Vehicle / Constraint modes
- My Levels save/replay loop with thumbnail
- Draft autosave to survive tab close mid-edit
- Single difficulty band (Standard)
- BCP-fidelity §1 pillars sustained on the demo path

### Out of v1 scope
- **Game mechanics**: hazards (acid pool, falling rocks, wind gusts, weight triggers), checkpoint platforms, difficulty bands (Easy/Hard), grading scaling.
- **Engineering**: Capacitor / Android wrap, voice-over, Hindi / regional language, telemetry/analytics, cloud sync, export/import.
- **Storage hardening**: quota UI, `navigator.storage.persist()`, schema validators + corrupted-records store, migration race coordination, `crypto.randomUUID()` polyfill.

(The storage cuts are deliberate per "this is a prototype" guidance — see Decision Log §8.)

### Glossary

| Term | Definition |
|---|---|
| **BCP-fidelity** | Bridge Constructor Portal-style physics-feel + visual polish; the demo's quality bar. Concrete pillars in GDD §1. |
| **Feel-check** | End-of-session manual playthrough scoring each §1 pillar 1–5. Protocol in §5.2. |
| **Cascade-active** | State during which a snap occurred in last 200ms OR `pendingSnaps` is non-empty. Determines slow-mo hold per §3.6. |
| **pendingSnaps** | Queue of constraints scheduled for staggered removal during a cascade. See §3.7. |
| **Soft-restart** | Restore body positions/velocities from level-start snapshot. Used by NaN watchdog (§3.15). Does NOT call `Engine.clear`. |
| **Phase 1 / 2 / 3 / 4** | GDD §8 build sequence. Phase 1 = Core mechanics; Phase 2 = Levels & progression; Phase 3 = Tutorials & polish; Phase 4 = Sandbox editor. |
| **Approach A / B** | Implementation approaches (defined above in locked decisions). |
| **Stagger tick** | Wall-clock interval (80–120ms × `timeScale`) between consecutive snaps during a cascade. See §3.7. |

### In scope for Phase 1 specifically (sessions 1–8.5)
A single playable L1 with the build → first-try fail → rebuild → win loop, BCP-fidelity §1 pillars held. Pure programmatic primitives — zero external assets. See §6 for the full Phase-1 done-criteria.

---

## 2. Architecture

### Scene graph

```
┌────────────────────────────────────────────────────────────────────┐
│  Phaser Game (Vite-bundled, fullscreen <canvas>)                   │
│                                                                    │
│  ┌────────┐  ┌────────┐  ┌─────────┐  ┌─────────────┐  ┌────────┐  │
│  │  Boot  │→ │  Menu  │→ │  Level  │  │SandboxEdit  │  │MyLevels│  │
│  └────────┘  └────────┘  └─────────┘  ├─────────────┤  └────────┘  │
│                              ↑        │SandboxPlay  │      ↑       │
│                              │        └─────────────┘      │       │
│                              │  playloop.js (composed)     │       │
│                              └─────────────────────────────┘       │
└────────────────────────────────────────────────────────────────────┘
```

### Modules

```
bridge-builder/
  index.html
  vite.config.js
  package.json
  .eslintrc.js
  src/
    main.js                        # Phaser config, scene registration
    scenes/
      BootScene.js                 # asset loading + loading-bar contract
      MenuScene.js                 # level select
      LevelScene.js                # parameterised play scene (L1–L5)
      SandboxEditScene.js          # editor (Environment/Anchor/Vehicle/Constraint)
      SandboxPlayScene.js          # solves a sandbox-authored level (~95% LevelScene)
      MyLevelsScene.js             # saved levels library
    systems/
      physics.js                   # Matter setup, beam/cable factory, stress reader.
                                   # ★ THE ONLY FILE THAT CALLS scene.matter.*
      playloop.js                  # shared build/test/win/fail loop
      camera.js                    # edit/test framing, follow, punch-in zoom
      juice.js                     # screen shake, slow-mo, flash, particle pool
      audio.js                     # material SFX, weight-correlated engine pitch
      tutorial.js                  # hint/tutorial card system (Phase 3)
      progression.js               # unlocks, save state
      storage.js                   # IndexedDB save/load (schema-versioned)
    data/
      leveldata.js                 # the 5 level configs as JSON
  tests/
    headlessWorld.js               # Matter-only headless fixture for Vitest
    stressReader.test.js
    cascade.test.js
    cable.test.js
  assets/                          # Kenney + Freesound (Phase 2+)
  releases/                        # demo-v1.zip pin for rollback
  BUGS.md                          # chronological, [BLOCKER]/[IMPACT]/[COSMETIC]
  FEEL_LOG.md                      # session-end feel-check scores
```

### Locked architecture rules

Each prevents a specific failure mode flagged in the architect review (§8 decision log).

1. **Physics seam rule.** Scene code never calls `scene.matter.*`. Every Matter operation routes through `systems/physics.js`. _Prevents:_ Phase-1 escape-hatch turning into a 5–8-file refactor; keeps the standalone-Matter migration cost at one file.
2. **System lifecycle contract.** Every singleton in `src/systems/` exposes `attach(scene)`, `detach(scene)`, `reset()`. Scenes call `attach` from `create`, `detach` from `shutdown`, `reset` from `destroy`. _Prevents:_ zombie audio loops, leaked `timeScale=0.3` into other scenes, particle emitters firing into destroyed scenes.
3. **Vehicle list is always an array.** `level.vehicles: [{ type, spawnAt, weight, speed }]`. L1–L4 have arrays of length 1; L5 has length 3. _Prevents:_ L5 forking into its own scene by session 14.
4. **Sandbox is two sibling scenes.** `SandboxEditScene` (no physics ticking, drag-to-place input) and `SandboxPlayScene` (physics running, vehicle-follow camera). Shared playloop logic via `systems/playloop.js`. _Prevents:_ `if (this.mode === 'edit')` checks at every callsite.
5. **Storage is IndexedDB v1.** Schema-versioned per record via `storage.js`. _Prevents:_ synchronous `QuotaExceededError` at 50–80 saved levels.
6. **Stress reader uses Hooke's law on the constraint** — see §3.3. _Prevents:_ beams glowing when the vehicle accelerates, not when they're loaded.
7. **Perf budget.** 200 active Matter bodies max. Debris uses an object pool. NaN watchdog per tick. _Prevents:_ collapse cascades dropping frame rate; constraint NaN freezing the world.

### File-size discipline
Split files only when one exceeds ~400 lines. Likely first balloon: `LevelScene.js` (UI overlay + input + lifecycle). Plan to extract `LevelUI.js` and `LevelInput.js` when it crosses ~350 lines.

---

## 3. Physics & feel model

The section that has to be right for the §1 BCP-fidelity pillars to land. Concrete formulas, tuning targets, and failure-cascade behavior.

### 3.1 Body model

| Entity | Matter representation | Collision category |
|---|---|---|
| Anchor | `Bodies.rectangle({ isStatic: true })`, label `'anchor'` | `ENVIRONMENT` |
| Beam endpoint (node) | Small dynamic circle (r=4, low mass) | `BRIDGE` |
| Beam (rigid `length>0`) | `Constraint` between two endpoints | (constraint, no category) |
| Cable | `Constraint` with conditional stiffness per frame (see §3.2) | (constraint) |
| Vehicle | Compound: chassis rectangle + N wheel circles via low-stiffness suspension constraints. `body.mass = vehicle.weight` per config. | `VEHICLE` |
| Debris | Pooled circle bodies | `DEBRIS` |

**Collision filtering** — bitmask categories: `VEHICLE | BRIDGE | DEBRIS | ENVIRONMENT`. `DEBRIS` does **not** collide with `VEHICLE` (prevents wheel-jams). `VEHICLE` does **not** collide with the bridge constraint nodes directly (the deck constraint carries the load).

### 3.2 Cable one-way logic (verified Matter pattern)

A **single** engine-level event walks all cable constraints. No per-constraint callbacks exist in Matter — that API doesn't exist.

```js
Matter.Events.on(engine, 'beforeUpdate', () => {
  for (const c of cableConstraints) {
    const cur = Vector.distance(c.bodyA.position, c.bodyB.position);
    c.stiffness = cur > c.length ? c.material.tensionStiffness : 0;
  }
});
```

### 3.3 Stress reader

The single most-fragile formula in the codebase. Read off the constraint, never off the bodies.

```js
const MIN_REST_LEN = 4; // px
const SNAP_ABS_PX  = 8; // px, for length=0 rigid joints

// Called per constraint per tick, in the engine 'afterUpdate' phase
// (so cable §3.2 mutation has already applied for this frame).
function readStressNormalized(c) {
  const cur = Matter.Vector.magnitude(
    Matter.Vector.sub(c.bodyA.position, c.bodyB.position)
  );

  // Rigid pin-joint path: length === 0 uses absolute deviation
  if (c.length === 0) {
    const raw = c.stiffness * cur / SNAP_ABS_PX;
    return Math.min(1, Math.max(0, raw / c.material.snapThreshold));
  }

  // Hooke's-law proxy path
  const denom = Math.max(c.length, MIN_REST_LEN);
  // c.stiffness is the LIVE value: equals c.material.tensionStiffness
  // for beams, and is mutated by §3.2 cable logic (0 when slack,
  // tensionStiffness when taut). Reading it LIVE is correct:
  // a slack cable IS unloaded and SHOULD read zero stress.
  const raw = c.stiffness * Math.abs(cur - c.length) / denom;
  return Math.min(1, Math.max(0, raw / c.material.snapThreshold));
}

// Smoothed over 5 frames to kill Gauss-Seidel oscillation
function readStressSmoothed(c) {
  const raw = readStressNormalized(c);
  c._stressHistory.push(raw);
  if (c._stressHistory.length > 5) c._stressHistory.shift();
  return c._stressHistory.reduce((a, b) => a + b, 0) / c._stressHistory.length;
}
```

**Edge cases handled:**
- Very short rest length → `denom = max(restLength, 4px)` prevents division-blow-up.
- Constraint hasn't converged yet → 5-frame moving average dampens transient spikes.
- `length=0` rigid joints → absolute-deviation fallback against `SNAP_ABS_PX`.
- Slack cable → `c.stiffness === 0`, so `raw === 0`, so stress reads zero. Correct behavior; the cable is unloaded.

### 3.4 Solver settings

```js
engine.positionIterations   = 8;   // defensive headroom — §3.5 caps materials at 0.85
                                   // (where 6 iterations would suffice), but 8 leaves
                                   // room to push stiffness to 0.9+ in v2 without retuning
engine.velocityIterations   = 6;
engine.constraintIterations = 4;
engine.gravity.y            = 1.5; // 1.5× default for weight feel
engine.timing.timeScale     = 1.0;
engine.enableSleeping       = false; // sleeping kills cascade evaluation
```

At 200 dynamic bodies + 50 constraints on a midrange laptop in Chrome: ~4–6 ms physics budget per frame, comfortable 60 fps.

### 3.5 Material tuning (Phase-1 starting values; tune via feel-check)

| Material | Stiffness | Snap threshold | Notes |
|---|---:|---:|---|
| Wooden beam (L1 demo bridge) | **0.75** | **0.7** | Relaxed for the "saggy but holds" beat |
| Wooden beam (L2+) | 0.7 | 0.6 | Brittle for difficulty |
| Steel beam | 0.85 | 0.85 | Capped 0.85 max (stability) |
| Truss leg (each) | 0.7 | 0.6 | Strength comes from geometry |
| Steel cable (tension) | 0.85 | 0.75 | Capped 0.85 max |
| Steel cable (compression) | 0 | — | Slack via §3.2 |
| Counterweight block | static | — | Just mass |

| Vehicle | Mass (kg-equiv) | Wheels |
|---|---:|---:|
| Bicycle | 50 | 2 |
| Car | 200 | 4 |
| Delivery truck | 350 | 4 |
| School bus | 400 | 6 |
| Convoy (3 cars) | 600 | 12 |

### 3.6 Slow-mo curve (cascade-aware)

First snap of a test fires the sequence:

```
t=0ms       FREEZE-FRAME for 50ms — timeScale=0, render frozen, ALL audio suspended.
            §3.10 audio ducking does NOT start during the freeze (no audio playing).
t=50ms      Lerp timeScale 1.0 → 0.17 over 250ms.
            §3.10 audio ducking starts here: music + ambient lerp −12 dB over 100ms.
t=300ms     HOLD at 0.17 while cascade is active.
            cascade-active = any snap in last 200ms OR pendingSnaps non-empty.
t=cascade+200ms  Lerp 0.17 → 1.0 over 400ms.
                 §3.10 audio ducking lerps back to 0 dB over 100ms.
```

Total duration depends on cascade length — typically 1.0–2.5 s. NaN watchdog runs **before** any `timeScale` mutation; on NaN, force `timeScale=1.0` and trigger soft-restart.

### 3.7 Failure cascade (deferred + staggered + iteration-safe)

```
1. Stress evaluation pass (READ-ONLY on world):
   for each constraint c:
     if normalizedStress(c) >= 1.0: pendingSnaps.add(c)

2. AFTER iteration completes:
   sort pendingSnaps by stress (highest first)

3. Process one snap per "stagger-tick" (80–120ms wall-time, scaled by timeScale):
   - Matter.Composite.remove(world, c)
   - Endpoint nodes become dynamic (if not anchors)
   - Emit particle burst + audio variant
   - Re-evaluate stress on **neighbouring constraints** (defined as: any
     constraint that shares an endpoint body with the just-removed constraint —
     topological neighbours, not spatial).
   - If new candidates, append to pendingSnaps

4. Runaway-cascade guard: cap the number of *new candidates appended to pendingSnaps from a single stagger-tick's re-evaluation* at 5. If a single snap causes 30+ neighbours to over-threshold (bug or pathological structure), the cascade caps at 5 new per stagger-tick — drops the rest of that batch with a 'cascade-truncated' debug log. Prevents a frame-time cliff under bad data. This is not recursion (queue, not stack); it's a per-iteration append limit.
```

Produces dominoes-falling drama with staggered audio/visual beats — the BCP signature. Synchronous in-tick recursion was rejected: would corrupt Matter's `Composite.constraints` array during iteration AND would read as instant collapse rather than drama (both reviews converged on this).

### 3.8 Predictive snap cue

At `normalizedStress > 0.85`:
- Beam adds 1–2px sinusoidal wobble at 8–12 Hz (rendered, not physics-driven — purely cosmetic).
- Material-specific creak audio loop starts; volume scales with stress; ends on snap or stress-drop.

### 3.9 Camera punch-in

On first snap of a cascade: `camera.zoomTo(1.2)` + `camera.lerpTo(snapMidpoint)` over 200 ms. Releases on `cascadeSettled` event.

### 3.10 Audio ducking

Activates when timeScale lerps below 1.0 (i.e., **after** the §3.6 freeze-frame ends at t=50ms — during the freeze, all audio is suspended). Music + ambient lerp −12 dB over 100 ms. Restores to 0 dB over 100ms on `slowMoEnd`.

### 3.11 Snap audio variants

≥3 variants per material × per material-pair. Pairs in v1: wood/wood, wood/steel, wood/cable, steel/steel, steel/cable. Truss legs share wood SFX (they ARE wood beams arranged geometrically). Counterweight is static, has no snap SFX. Randomised pitch ±5% on playback. Prevents demo-collapse audio repetition.

### 3.12 Build-mode stress preview ghost-line

On hover over the **Test** button: run 30 silent physics ticks, capture per-constraint stress, render ghost-glow on each beam. Releases on mouse-leave. Reuses the §3.3 stress reader; no new physics code.

### 3.13 Replay-of-failure (P2 stakeholder polish)

3-second rolling buffer of body positions captured at 30 Hz during test. On collapse, after slow-mo + cascade settle, replay the buffer at 0.5× in a windowed inset. Stakeholder demo's "wow."

### 3.14 Constraint pre-warm

At level start, run 30 silent physics ticks (no render, no audio) before exposing the bridge to the player. Settles initial constraint jitter from solver initialisation.

### 3.15 NaN watchdog

```js
// bodySnapshots: Map<Matter.Body, { position: {x,y}, velocity: {x,y} }>
//   Lifecycle:
//     - Bulk-captured by physics.captureSnapshot() at TEST START
//       (immediately after §3.14 pre-warm, before the player hits Play).
//       Build-mode placements do NOT incrementally snapshot — too noisy;
//       the snapshot is a single coherent frame of the bridge at rest.
//     - Debris pool entries snapshot lazily on first activation.
//     - NEVER updated during play — that defeats the rollback point.
//     - Cleared on scene shutdown via physics.detach(scene).

function tickWatchdog() {
  for (const body of dynamicBodies) {
    if (isNaN(body.position.x) || isNaN(body.position.y)) {
      softRestart(); break;
    }
  }
}

function softRestart() {
  engine.timing.timeScale = 1.0; // bail out of any active slow-mo
  for (const [body, snap] of bodySnapshots) {
    Matter.Body.setPosition(body, snap.position);
    Matter.Body.setVelocity(body, { x: 0, y: 0 });
  }
  // NEVER Engine.clear() — loses event listeners (cable §3.2 hook, etc.)
}
```

Runs once per tick (in `Matter.Events.on(engine, 'beforeUpdate')`, ordered to fire **before** the §3.6 timeScale mutation handler).

### 3.16 Tuning protocol

Starting values above are starting guesses, **not** commitments. End-of-session §1 feel-check (see §5.2) validates pillars; tuning lives in `physics.js` and material config, never in scenes. Concrete fix directions for common feel-check failures:

| If it feels… | Adjust |
|---|---|
| Floaty / bouncy | ↑ gravity, ↑ damping. Iteration counts (§3.4) are not a tuning knob in v1. |
| Rigid / dead | ↓ stiffness (esp. wood), ↓ damping |
| Snaps too easily | ↑ snap thresholds |
| Slow-mo feels stilted | shorter hold (700→400 ms), faster ramp |

---

## 4. Save schema (prototype-grade)

Trimmed to what matters for the demo flow. Three IndexedDB stores via `idb`. Defensive engineering (validators, quota UI, persist(), export/import, migration race coordination) is explicitly cut per prototype-grade scope — rationale and the full cut list are in §8.4.

### 4.1 Stores

| Store | Keying | Purpose |
|---|---|---|
| `progress` | single record, key `'main'` | Curated-level unlocks + best scores |
| `sandbox_levels` | by UUID (`crypto.randomUUID()`) | Saved (proof-of-solved) sandbox levels, indexed by `createdAt` |
| `sandbox_drafts` | single record, key `'current'` | In-progress sandbox edit — protects against tab close |

### 4.2 Data shapes

```js
// progress (key 'main')
{
  version: 1,
  unlockedLevels: ['L1'],   // grows L1 → L2 → ... → 'sandbox' after L5
  bestScores: {
    L1: { stars: 3, beamCount: 6, completedAt: 1731000000 },
    // ...
  },
  sandboxUnlocked: false,
  lastPlayedAt: 1731000600,
  totalPlaytimeMs: 1840000,
}

// sandbox_levels[i]
{
  version: 1,
  id: 'a3f4-...',
  title: 'My Hard Canyon',
  thumbnailBlob: Blob,       // 128×72 JPEG q=0.7, ~3-5 KB. NOT a data URL.
  createdAt: 1731001000,
  lastPlayedAt: 1731001500,
  bestCompletionMs: 8400,    // null until first solve
  environment: {
    // canyonWalls is an array (not a {left,right} map) for consistency with
    // anchors, vehicles, pillars — variable-count + per-item side identifier.
    canyonWalls: [
      { side: 'left',  x, y, height },
      { side: 'right', x, y, height },
    ],
    pillars: [{x,y,height}],
    waterY: 540,
  },
  anchors: [{ x, y, type: 'fixed' | 'optional' }],
  vehicles: [{ type, spawnAt: 'left'|'right', weight, speed }],
  constraints: {
    budget: 800,
    allowedMaterials: ['wood','steel','cable','truss','counterweight'],
  },
  solveProof: {              // required to save (per GDD §5)
    completedAt: 1731001000,
    beamCount: 14,
    cost: 700,
  },
}

// sandbox_drafts (key 'current')
{
  version: 1,
  environment, anchors, vehicles, constraints,  // partial OK
  // no solveProof required
}
```

### 4.3 Two non-negotiables for the demo flow

1. **Atomic transactions** — compound updates like "L5 complete AND unlock sandbox" use `db.transaction([...], 'readwrite')`. Without this, the stakeholder demo can land in partial-unlock state on refresh.
2. **Draft autosave** — `SandboxEditScene` saves to `sandbox_drafts` every 5 seconds or on significant change. On scene re-entry, prompt *"continue your draft?"*. Promote draft → `sandbox_levels` on first solve, delete draft. Prevents losing 20 minutes of on-stage authoring if the stakeholder accidentally hits Menu.

### 4.4 Solve-proof enforcement at storage boundary

`storage.saveSandboxLevel(level)` throws `UnsolvedLevelError` if `level.solveProof === undefined`. `storage.saveDraft(d)` has no such gate. This is the GDD §5 contract enforced at the storage layer, not in scene code.

### 4.5 Thumbnail pipeline

Captured via `this.game.renderer.snapshot(callback)` (Phaser 3 instance method on the WebGL/Canvas renderer) after the proof-of-solve playthrough. Downscaled to 128×72, JPEG quality 0.7 → ~3–5 KB per thumbnail. Stored as `Blob` (not data URL — base64 is 33% bigger AND forces full-record reads for grid rendering). Rendered via `URL.createObjectURL(blob)`; revoked on unmount.

### 4.6 Schema versioning

Per-record `version: 1` field with an empty migration runner. Costs ~10 lines, buys forward-compat for v2 schema changes. No race-coordination, no idempotency contract — single-tab prototype.

### 4.7 API surface

```js
storage.attach(scene);  storage.detach(scene);  storage.reset();

storage.getProgress(): Promise<Progress>
storage.saveProgress(progress): Promise<void>

storage.listSandboxLevels(): Promise<SandboxLevel[]>   // sorted createdAt desc
storage.getSandboxLevel(id): Promise<SandboxLevel>
storage.saveSandboxLevel(level): Promise<void>         // throws UnsolvedLevelError
storage.deleteSandboxLevel(id): Promise<void>

storage.getDraft(): Promise<Draft | null>
storage.saveDraft(draft): Promise<void>
storage.clearDraft(): Promise<void>

storage.transaction(stores, fn): Promise<R>            // compound-op escape hatch
```

**Test coverage for storage:** no dedicated Vitest tier (IDB tests are slow and the visible failure modes are already covered by manual tests). The API surface is exercised by:
- §5.3.4 refresh-survival across three moments (build, slow-mo, mid-cascade) — covers `saveProgress` / `getProgress` / `saveDraft` / `getDraft`.
- §5.3.6 incognito-mode smoke — covers the in-memory fallback path (§4.9).
- The L5→sandbox-unlock flow during stakeholder demo rehearsal — covers `storage.transaction`.
- `saveSandboxLevel` throwing `UnsolvedLevelError` is hit during sandbox-edit playtesting.

### 4.8 Explicitly cut from v1 (per prototype-pragmatism)

- Quota UI, soft warnings, `navigator.storage.persist()`
- Schema validators + corrupted-records store
- Migration race coordination, idempotency contract
- Export / import JSON
- `crypto.randomUUID()` polyfill (Chrome 92+, Edge 92+, Safari 15.4+ — all current evergreens)

### 4.9 Incognito / IDB-denied fallback (the one exception)

Stakeholder may open incognito to "test fresh" — IDB throws → white screen. **One try/catch** around `storage.init()` falls back to an in-memory shim with the same API surface (no persistence, but the demo arc still runs). Surface a small "memory mode" toast. This is the only defensive item that survived the prototype-pragmatism cut, because the failure mode is *visible* and catastrophic.

---

## 5. Testing & feel-check protocol

Three tiers. Heavy on the cheapest tests that protect the most fragile code, plus the manual gates the §1 pillars require.

### 5.1 Tier 1 — Vitest unit tests on physics utils

Three fixtures, ~150 lines total, run on `npm test`. Phaser is not unit-tested (renderer required, scenes too coupled to GameLoop — flaky headless).

```
tests/
  headlessWorld.js              # helper: Matter-only world, no Phaser
                                # MUST: engine.enableSleeping = false
                                # MUST: fixed delta 16.666ms, explicit step()
                                # Comment the gotchas so nobody "optimises" them
  stressReader.test.js          # 3-beam triangle, known load, ±5% tolerance
                                # Covers §3.3 — the formula the architect P0'd
  cascade.test.js               # A→B→C cascade setup; trigger A's snap
                                # Asserts: pendingSnaps order, depth cap (5),
                                # staggered intervals (80–120ms × timeScale)
  cable.test.js                 # cable at restLength then stretched
                                # Asserts: stiffness=0 in compression,
                                # tensionStiffness in tension
```

**What is NOT tested:** scene transitions, input handling, audio playback, UI rendering, IndexedDB save/load. Validated manually.

### 5.2 Tier 2 — Manual feel-check (§1 pillar gate)

End of every Phase-1 session, run in fresh browser tab on the demo laptop (no devtools open — they throttle the loop).

| Pillar | Score 1–5 | Anchor language |
|---|---|---|
| 1.1 Physics-feel | | 3 = beams snap but cascade feels mushy. 4 = snap-and-cascade reads as causal. 5 = stakeholder gasps. |
| 1.2 Visual language | | 3 = stress glow reads but is generic. 4 = glow + shimmer + debris feels intentional. 5 = stakeholder asks "what engine is this?" |
| 1.3 Camera | | 3 = follows the action. 4 = punch-in lands the snap moment. 5 = the camera tells the story of the failure. |
| 1.4 Audio | | 3 = SFX play. 4 = creak + snap + thud are distinct and ducking feels right. 5 = the audio sells the weight. |

**Rules:**
- Any pillar <3 = session is not closed. Tune up to 1 hour. Phase 2+ tuning budget: 30 min.
- Pillar <3 after tuning budget → log in `FEEL_LOG.md` (committed alongside code) and proceed to the next session. Don't block on perfection.
- **Phase-1 exit (§6.2) requires every pillar ≥3/5.** Any logged <3 items from intermediate sessions must be resolved before Phase 1 closes. The escape valve above is for keeping intermediate sessions unblocked — not for shipping below bar.

### 5.3 Tier 3 — Pre-demo rehearsal (§10 GDD gate)

Before the demo lands in the stakeholder room:

1. **Three unfamiliar observers** play the demo arc unsupervised. Driver records: time to first build, time to first failure-understanding, time to first win, frustration moments.
2. **Pass criteria** (GDD §10): ≥2 of 3 finish L1 without help. All 3 say physics felt "real" or "weighty."
3. **Ten full demo runs back-to-back, zero crashes.** Watch `performance.memory.usedJSHeapSize` between runs — flat or sawtooth is fine; monotonic climb = P0 leak.
4. **Refresh-survival, three moments:**
    - Refresh during sandbox-edit → draft restores cleanly.
    - Refresh during slow-mo → `timeScale` does not persist.
    - Refresh mid-cascade → `pendingSnaps` does not corrupt state.
5. **Tab-focus-loss mid-cascade:** start a cascade, alt-tab 10 seconds, return. Cascade completes cleanly or cancels — never explodes.
6. **Incognito-mode smoke:** open incognito tab; demo runs in memory-mode with toast.
7. **Battery-saver test:** unplug demo laptop, verify slow-mo still feels right at the throttled rAF (Chrome throttles to 30 fps on battery).

### 5.4 Known-good build pin

`git tag demo-v1` + `releases/dist-demo-v1.zip` checked into the repo (or Drive). One-line recovery if the build breaks 30 min before demo: unzip, `python -m http.server`, done. Re-zip on every stable build.

### 5.5 `BUGS.md` discipline

Single file at repo root. Chronological. Each entry: `[YYYY-MM-DD] [SEVERITY] description`. Severities: `[BLOCKER]` (demo can't run), `[IMPACT]` (demo runs but a §1 pillar drops), `[COSMETIC]` (rough edge, ship as-is). T-48h triage filters on severity.

### 5.6 Explicitly not doing (per prototype-pragmatism)

- E2E tests (Playwright / Puppeteer) — Phaser is flaky headless.
- Visual regression / screenshot diffing.
- Coverage targets or CI gates.
- Phaser scene unit tests.
- Perf-benchmark automation (manually verify 60 fps on the demo laptop).

---

## 6. Phase-1 deliverable definition

What "done with Phase 1" actually means.

### 6.1 What ships at end of Phase 1

> **Note on session boundaries:** Mapping the deliverable rows below to specific sessions (1–8.5) is the role of the writing-plans output, not this spec. The GDD §8 Phase 1 sequence is the starting reference; the implementation plan adjusts as feel-checks dictate.


A single playable L1 (Forces & Gravity) — **build → first-try fail → rebuild → win** loop. All programmatic primitives: rectangles, circles, gradients. **Zero external assets.**

| Feature | In Phase 1? |
|---|:---:|
| Canyon walls + anchors + water plane (flat shapes) | ✅ |
| Tap-to-place beam, 20px joint snap | ✅ |
| Single material (wood, L1-relaxed: stiffness 0.75 / snap 0.7) | ✅ |
| Matter physics with §3.4 tuned constants | ✅ |
| Stress reader §3.3 + 5-frame smoothing | ✅ |
| Stress glow + shimmer + predictive wobble + creak audio | ✅ |
| Deferred + staggered cascade with `pendingSnaps[]`, depth-5 cap | ✅ |
| Slow-mo §3.6 (freeze-frame → 0.17 hold → 400 ms restore) | ✅ |
| Camera punch-in (1.2× zoom + lerp) | ✅ |
| Screen shake on collapse (mass × velocity) | ✅ |
| Minimum audio: wood creak + snap + thud + ambient wind + ducking | ✅ |
| NaN watchdog + soft-restart from snapshot | ✅ |
| Single Car (200kg) compound body with suspension wheel constraints (stiffness 0.5, tune by feel — see §7.3) | ✅ |
| Vehicle list as array, length 1 (forward-compat shape) | ✅ |
| Win condition (car reaches right anchor) + fail (beam snapped) | ✅ |
| System lifecycle (attach/detach/reset) on scene change | ✅ |
| Three Vitest fixtures passing | ✅ |
| Steel, cable, truss, counterweight materials | ❌ → Phase 2 |
| Tutorial cards / HUD / budget meter | ❌ → Phase 3 |
| L2–L5 mechanics | ❌ → Phase 2 |
| Sandbox edit/play/library scenes | ❌ → Phase 4 |
| Capacitor / Android wrap | ❌ post-demo |

### 6.2 "Done" criteria (all must hold)

1. **Feel-check ≥ 3/5** on every §1 pillar in a fresh browser tab, on the demo laptop.
2. **60 fps held** during a 5-beam cascade collapse.
3. **Three Vitest tests pass** on `npm test`.
4. **Ten back-to-back playthroughs**, zero crashes, no monotonic memory climb.
5. **Refresh during all three moments** (build, slow-mo, mid-cascade) recovers cleanly.
6. **Tab-focus-loss mid-cascade** completes cleanly or cancels — never explodes.

### 6.3 The "Approach A → B" decision moment

End of session 8.5 (the camera + juice pass) is when we know if Phaser's Matter plugin is fighting the slow-mo / sub-step tuning.

**Stay on A** if: all 6.2 criteria hold without fighting the plugin abstraction.

**Migrate to B** (standalone Matter, Phaser for render only) if any of:
- `engine.timing.timeScale` doesn't behave as documented under Phaser's wrapper.
- Sub-step tuning gated behind plugin internals.
- Cascade timing visibly jitters and we can't access the underlying Matter event loop.

If migrating: rewrite `physics.js` only (the §2 seam-discipline rule guarantees this). Budget: 1 session, sequenced as session 8.6.

### 6.4 Known unknowns going into Phase 1

1. **Cascade stagger value.** 80–120 ms is a guess. May need 60 ms (more frantic) or 150 ms (more readable). Tune at session 7.
2. **Slow-mo floor.** 0.17 is the agent recommendation. May need 0.2 (less motion-sicknessy) or 0.13 (more dramatic).
3. **Wood tuning.** stiffness 0.75 / snap 0.7 is the L1-relaxed pair. If L1 still frustrates more than delights, push to 0.8 / 0.75.
4. **Phaser-Matter slow-mo behavior.** We don't know if the plugin honours `timeScale` cleanly mid-cascade. This is the §6.3 A/B decision input.

---

## 7. Open questions (deferred — do not block Phase 1)

1. **Steel beam capped at 0.85 vs. 0.95.** Originally 0.95; simulation review forced cap to 0.85 for stability. If 0.85 doesn't read as "steel-feel" different from wood (0.75), revisit by adding visual distinction (texture, audio) rather than re-raising stiffness.
2. **Replay-buffer at 30 Hz vs. 60 Hz capture.** 30 is cheaper; 60 is smoother. Stakeholder-perceptible? Decide post-implementation.
3. **Vehicle suspension stiffness exact value.** Not specified yet — start at 0.5, tune by feel.
4. **Tutorial copy.** GDD §3 has placeholder copy. Final wording deferred to Phase 3.
5. **Audio source coordination.** Freesound has thousands of options; curate a 30-minute style match pass before Phase 2.
6. **Asset license bookkeeping.** Each Kenney / Freesound asset's CC0 / CC-BY attribution belongs in a single `assets/LICENSES.md`. Set this up at the start of Phase 2.

---

## 8. Decision log

The reviews that shaped this spec.

### 8.1 Architect review (Plan agent)
**Outcome:** Verdict was "Revise" — two P0s, four P1s.

Applied:
- System lifecycle contract (`attach` / `detach` / `reset`) on every singleton — prevents zombie state across scene transitions.
- Physics seam rule — only `physics.js` calls `scene.matter.*`.
- Sandbox split into two sibling scenes — `SandboxEditScene` + `SandboxPlayScene`.
- IndexedDB v1 (not LocalStorage) — quota cliff would bite Phase 4.
- Vehicle list as array — prevents L5 forking into its own scene.
- Stress reader formula corrected — Hooke's-law on constraint, not body forces.
- Perf budget (200 bodies, debris pool, NaN watchdog).

### 8.2 Game-design review (general-purpose role: senior BCP-experience designer)
**Outcome:** Verdict was "decent-but-school as written → BCP-grade with P0 fixes." Three P0s, four P1s, five P2s — all applied.

Applied:
- Staggered cascade with 80–120 ms inter-snap delay (scaled by `timeScale`) — was instant-collapse.
- Slow-mo curve: ~50 ms freeze-frame at snap, lerp to 0.17 over 250 ms, HOLD while cascade active, restore over 400 ms — was 0.3 floor for 1s flat.
- Predictive snap cue: wobble + creak at `stress > 0.85` — was missing.
- L1 wood relaxed to stiffness 0.75 / snap 0.7 — was brittle 0.7 / 0.6.
- Camera punch-in 1.2× zoom + lerp to snap midpoint during slow-mo hold.
- Audio ducking −12 dB during slow-mo.
- Snap audio variants (3+ per material × material-pair, pitch ±5%).
- Replay-of-failure 3-second buffer at 0.5×.
- Build-mode stress preview ghost-line.

### 8.3 Simulation review (general-purpose role: Matter.js specialist)
**Outcome:** Verdict was "Numerically sound with critical gaps." Three P0s, three P1s, two P2s — all applied.

Applied:
- Cable mutation via single engine-level `Matter.Events.on(engine, 'beforeUpdate')` — was a non-existent per-constraint callback.
- Cascade as deferred queue with `pendingSnaps[]` and post-iteration removal — was same-tick recursion that would corrupt the `Composite.constraints` array.
- Solver iterations bumped to `positionIterations=8, velocityIterations=6, constraintIterations=4` — was sub-steps=4 which would oscillate at stiffness ≥ 0.9.
- Stress formula edge case: `denominator = max(restLength, 4px)`; absolute-deviation fallback for `length=0` rigid joints.
- NaN watchdog runs before `timeScale` mutation; soft-restart via `Body.setPosition` + zero velocity from snapshot (never `Engine.clear`).
- Collision filtering: bitmask categories `VEHICLE | BRIDGE | DEBRIS | ENVIRONMENT`.
- Constraint pre-warm: 30 silent ticks at level start.

### 8.4 Storage review (general-purpose role: web-storage engineer)
**Outcome:** Verdict was "Revise" — three P0s, three P1s, three P2s. **User then scoped to prototype-grade**, which cut most of the hardening.

Applied:
- Thumbnail as `Blob` (not data URL) — eliminates base64 overhead.
- `sandbox_drafts` store + autosave — protects against tab close mid-edit.
- `storage.transaction(stores, fn)` escape hatch for compound ops.
- Incognito / IDB-denied in-memory fallback (the one defensive item that survived because the failure mode is visible to the stakeholder).

Cut (per prototype-pragmatism):
- Quota handling UI / soft warnings / `navigator.storage.persist()`.
- Schema validators + corrupted-records store.
- Migration race coordination, idempotency contract.
- Export / import JSON.
- `crypto.randomUUID()` polyfill (target browsers all support it natively).

### 8.5 QA review (general-purpose role: browser-game QA)
**Outcome:** Verdict was "Protects the demo with critical gaps." Four P0s, three P1s, two P2s — all applied.

Applied:
- Headless Matter fixture hardening: `enableSleeping = false`, fixed delta, explicit step, commented gotchas.
- Refresh-survival across three distinct moments (sandbox-edit, slow-mo, mid-cascade).
- Incognito / IDB-denied path tested (overlaps with §8.4 storage fix).
- Known-good build pin: `git tag demo-v1` + `releases/dist-demo-v1.zip`.
- Bumped to 10 back-to-back demo runs with `performance.memory` monitoring.
- Tab-focus-loss mid-cascade test (the #1 live-demo bug in browser games).
- Pillar score anchors with concrete language for 3 / 4 / 5.
- `BUGS.md` severity tags `[BLOCKER] / [IMPACT] / [COSMETIC]`.
- Battery-saver test (Chrome throttles rAF to 30fps on battery).

---

## 9. Next step

Once this spec is reviewed and approved, the **writing-plans** skill consumes it to produce a session-by-session implementation plan for Phase 1 (sessions 1–8.5). The plan should:

- Use **§6.1 deliverable table** to identify what each session contributes.
- Reference **§6.2 done-criteria as the Phase-1 exit gate** (not per-session — intermediate sessions can ship work-in-progress, e.g., a <3 pillar logged in `FEEL_LOG.md` per §5.2, as long as Phase-1 exit hits all six criteria).
- Honor **§2 architecture rules as invariants** that hold at every session boundary (e.g., the seam rule applies session 1 onward; the lifecycle contract is required as soon as a second scene exists).
- Surface the **Approach A→B decision moment (§6.3)** as the session-8.5 gate.
