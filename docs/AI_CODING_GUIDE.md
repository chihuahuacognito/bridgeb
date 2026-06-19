# AI Coding Guide — Bridge Builder

Read this before touching code. It is not generic advice — every rule here
comes from a real bug that cost real rework in this repo. The same mistakes
keep recurring. Don't be the next model to repeat them.

CLAUDE.md tells you *how the system is built*. This file tells you *how to
work on it without breaking it*.

---

## 0. The one rule that prevents most rework

**Diagnose by running the app, not by guessing.**

This is a Phaser + Matter.js game. Its behavior lives at runtime — in scene
transitions, physics steps, DOM/canvas input layering, and event timing. You
**cannot** reason your way to a root cause by reading code alone, and every
time a model has tried, it has burned multiple turns on wrong fixes.

### Case study — the "NEXT LEVEL button does nothing" bug
A model guessed twice and shipped both guesses before finding the truth:
1. ❌ Guess: CSS `z-index` was blocking the click → added `z-index: 100`. Wrong.
2. ❌ Guess: a post-win beam snap re-triggered fail → added a `winOverlay`
   guard. Plausible, also not the actual bug.
3. ✅ Only after driving the real app with Playwright did the console reveal:
   `TypeError: Cannot read properties of null (reading 'off')` in
   `physics.detach()`. The click *was* firing; `scene.start()` threw during
   teardown and silently aborted the transition. (See §3.)

The fix took five minutes once observed. The guessing took an hour.

### How to actually run it
`playwright` is a dev dependency. The harness pattern that works:

```js
// Temporarily expose handles in src/main.js for a debug session:
//   window.__game = new Phaser.Game(config);
//   window.__bus  = bus;
// Then drive from a throwaway script:
import { chromium } from 'playwright';
const page = await (await chromium.launch()).newPage();
page.on('console',   m => console.log('[browser]', m.type(), m.text()));
page.on('pageerror', e => console.error('[PAGE ERROR]', e.message, e.stack));
await page.goto('http://localhost:5176');           // check the dev-server port
// click the level on the canvas, emit bus events, call scene.showWin(), etc.
```

- `page.on('pageerror')` is the whole game — a thrown error mid-transition is
  invisible in the UI but loud in that handler. **Always** attach it.
- Drive the **real surface**: click the canvas / DOM buttons, emit real bus
  events. Do not `import` a function and call it in Node — that proves nothing
  about the running game.
- **Clean up after**: remove the `window.__game`/`window.__bus` exposure, any
  `console.log` you added, and any throwaway script/screenshots before you
  finish. The repo currently has stray `verify_*.png` and an unrelated
  `AI_CONCEPTS.md` at root from past sessions — don't add to the pile.

Tests (`npm test`) verify physics/units headlessly. They are necessary but
**not** a substitute for running the game — most bugs here live in the
Phaser/DOM seam that jsdom tests never exercise.

---

## 1. Understand the domain model before you change it

Misreading the domain produced the second-worst time sink in this repo. The
user had to correct the model three times because it conflated game concepts.

### Road ≠ Wood/Beam — they are two different materials
- **ROAD** (`materials.road`, tool `'road'`): the drivable deck. Gets a
  kinematic collision body wheels roll on. This is what the vehicle touches.
- **WOOD/BEAM** (`materials.wood`, tool `'beam'`): support members only. A
  stress constraint with **no** collision body. Vehicles **cannot** land on
  wood. Wood exists to brace the road into triangles.

A "bridge" is usually *both*: a road deck plus wood beams underneath. If a
model says "the beams are the bridge" or treats road and wood as
interchangeable, it has already lost. Triangulation = wood diagonals between
road joints and a lower anchor (terrain or rock).

### Know the schema before editing `leveldata.js`
A level is a contract. `CLAUDE.md` has the full schema. The fields that
matter most for "does this level make sense":
- `materials` — which materials *exist*.
- `ui.tools` — which tool tiles are *enabled*. A material with no tool is
  unreachable by the player.
- `budget` — coins per material. A tool with no budget is useless.
- `rocks` / `anchors` — the attach points. Without a low anchor, the player
  **cannot** build a triangle even if wood is enabled.
- `prebuilt` — beams the level starts with (expanded via `utils/prebuilt.js`).

---

## 2. Level invariant — the tutorial promise must be physically buildable

This is the bug class behind L02 ("add more beams" with no beam tool and no
rock to brace against). **Before editing or reviewing any level, check that
its config can satisfy its own tutorial text.**

For every level, the goal stated in `tutorial.{intro,hint}` must be
achievable with what the level provides:

| If the hint says…              | The config MUST provide…                              |
|--------------------------------|-------------------------------------------------------|
| "add beams / supports"         | `ui.tools` includes `'beam'` **and** `materials.wood` **and** `budget.wood > 0` |
| "use the rock / pillar"        | a `rocks: [pillar(...)]` whose top sits *below* the deck so diagonals reach it |
| "make triangles"               | a lower attach point (rock or terrain) **plus** wood — a flat deck alone can't triangulate |
| "use REMOVE"                   | `ui.delete` not false (REMOVE tool available)         |
| locked vehicle (`design`)      | `ui.vehicleSelect: false` so the selector doesn't lie |

If you change a tutorial string, re-check the config. If you change config,
re-check the string. They drift apart silently and the test suite won't catch
it — only a human playing the level will.

---

## 3. Scene lifecycle — teardown runs in an order that will surprise you

`scene.start(...)` (NEXT LEVEL, MENU, retry) tears the old scene down. The
trap that has bitten this code:

> **Phaser nulls `scene.matter.world` and `scene.cameras.main` *before* the
> scene's `shutdown` event fires.** So any system `detach()`/`reset()` that
> runs on `shutdown` must null-guard the scene sub-objects it touches.

Pattern to follow (already applied in `physics.js` and `camera.js`):

```js
reset() {
  if (this._scene?.matter?.world) {        // guard — may be gone during teardown
    this._scene.matter.world.remove(bodies);
  }
}
detach() {
  if (this._scene && this._beforeUpdateCb && this._scene.matter?.world) {
    this._scene.matter.world.off('beforeupdate', this._beforeUpdateCb);
  }
  // ...
}
```

A single unguarded deref here throws mid-`scene.start()`, which aborts the
transition **silently** — the symptom looks like "the button does nothing,"
not "an error occurred." If a scene transition appears to no-op, suspect a
throw in teardown first and check `page.on('pageerror')`.

### System lifecycle contract
Every singleton in `src/systems/` follows `attach(scene)` / `detach(scene)` /
`reset()`. They are **singletons reused across scenes** — `attach` must clear
any stale state from the previous scene (see `tutorial.attach()` dropping a
stale card). When you add a system, register its `detach` in the scene's
`shutdown` handler and unregister every `bus.on` you added.

---

## 4. The hard architectural rules (don't relearn these the hard way)

These are in CLAUDE.md too; they are repeated here because violating them
produces baffling, hard-to-trace bugs.

- **Physics iron law:** `physics.js` is the ONLY file that calls
  `scene.matter.*`. LevelScene calls physics singleton methods. If you find
  yourself typing `this.matter` outside `physics.js`, stop.
- **One Matter universe:** never `import 'matter-js'` in game code — use
  Phaser's bundled Matter. Two copies = two unconnected physics worlds.
  (Exception: `tests/headlessWorld.js` imports `matter-js` directly *on
  purpose* for headless unit tests. That's the only place.)
- **`beam.constraint` staleness:** after `rebuildBridge()`, update each
  `beam.constraint` to the new constraint or the next `splitBeam` leaves ghost
  bodies. (CLAUDE.md "Scene-Side Bridge Data".)
- **Bus cleanup:** every `bus.on(...)` in a scene needs a matching `bus.off`
  in `shutdown`, or handlers stack across scene restarts and fire N times.

---

## 5. Make the smallest change that fixes the actual cause

- Fix the **root cause**, not the symptom. The `z-index` "fix" addressed a
  cause that didn't exist; the real fix was a null guard three files away.
- Don't pile speculative fixes on top of each other. If a previous fix was
  wrong, **revert it** rather than layering another guess. (The user
  explicitly asked for the wrong `clearBridgeData` change to be reverted.)
- Match the surrounding code's style and idiom. This codebase uses singleton
  systems, a synchronous event bus, and dense explanatory comments on
  non-obvious physics decisions — write in that register.
- When you remove a feature (e.g. the redundant PLAY button), also remove its
  now-dead imports and CSS. Leave no orphans.

---

## 6. Pre-flight checklist

Before saying you're done:

- [ ] Did I **run the game** and watch the change happen — including
      `page.on('pageerror')` — not just read code or run unit tests?
- [ ] For a level change: does the config (tools, materials, budget, rocks)
      actually let the player do what the tutorial text promises?
- [ ] For a systems change: are `detach`/`reset` null-guarded against
      teardown, and is every `bus.on` matched by a `bus.off`?
- [ ] Did I touch `scene.matter.*` outside `physics.js`? (Undo it.)
- [ ] Did I revert any earlier wrong guess instead of layering on top of it?
- [ ] Did I remove debug logs, `window.__*` exposures, throwaway scripts, and
      screenshots?
