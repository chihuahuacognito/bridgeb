# Bridge Builder — Claude Code Guide

> **Before changing code, read [`docs/AI_CODING_GUIDE.md`](docs/AI_CODING_GUIDE.md).**
> It captures the mistakes models keep repeating here — diagnose by running the
> app (not guessing), road vs. wood are different materials, tutorial text must
> match level config, and guard scene teardown. This file is *how the system is
> built*; that file is *how to work on it without breaking it*.

## Project

Poly Bridge-style 2D physics bridge builder. Run with `npm run dev`. Tests: `npm test`.

**North star:** Bridge Constructor Portal fidelity — weighty physics, dramatic cascading collapses, polished feel. Every tradeoff resolves in favor of this.

## Tech Stack

- **Phaser 3.90** (renderer + scene management + Matter.js integration)
- **Matter.js** via Phaser's bundle — do NOT import a second copy from `matter-js` in game code or you get two separate physics universes
- **Vite** (bundler), **Vitest** (tests), **lil-gui** (dev cheat panel)
- Matter config: `positionIterations: 8, velocityIterations: 6, constraintIterations: 4, gravity.y: 1.5`

## File Structure

```
src/
  main.js              — Phaser game config + scene list
  data/leveldata.js    — Level definitions (L1, DEV_STRESS, ALL_LEVELS)
  scenes/
    BootScene.js       — Asset loading
    LevelScene.js      — All game UI, build/test mode, vehicle selection, draw loops
  systems/
    physics.js         — THE ONLY FILE that calls scene.matter.*  (see iron law below)
    audio.js           — Sound system singleton
    juice.js           — Slow-mo, screen-shake, camera punch singleton
    camera.js          — Camera follow singleton
  utils/
    snapGeometry.js    — nearestPointOnSegment, findBeamSnap (pure geometry, no Phaser)
tests/                 — Vitest unit tests (jsdom, headless Matter)
docs/superpowers/      — Specs and implementation plans
```

## Physics Iron Law

**`physics.js` is the ONLY file that calls `scene.matter.*`**. LevelScene calls physics singleton methods; it never touches `scene.matter` directly. Violating this breaks the seam between game logic and physics.

## Collision Categories

```
0x0001  VEHICLE  — chassis + wheels
0x0002  JOINT    — joint-circle bodies (mask: 0x0000 — collide with nothing)
0x0004  BEAM     — kinematic road rectangle bodies
0x0008  WORLD    — terrain + rock static bodies
```

Key mask rules:
- **Chassis**: `mask: 0xFFFF & ~0x0002 & ~0x0004` — collides with world/vehicle but NOT joints or beams
- **Wheels**: `mask: 0xFFFF & ~0x0002` — collides with beams (road surface) but NOT joints
- **Beam bodies**: `mask: 0x0001` — collide ONLY with vehicle
- **Beam bodies group**: `-1` — adjacent beams sharing a joint never shove each other

## Beam System

Road beams get **two physics objects**:
1. A **stress constraint** between two joint nodes (measures separation, drives snap)
2. A **kinematic static rectangle** collision body (what wheels roll on)

Non-road (wood) beams get only a stress constraint — no collision body. Vehicles cannot land on wood beams.

**Kinematic beam bodies** (`buildBeam`):
- Created as static rectangles sized `restLength + 2 * BEAM_OVERHANG` wide, 30px thick
- Repositioned every `beforeupdate` via `_updateKinematicBeams()` — sets position + angle + **resizes** to `currentDist + 2*BEAM_OVERHANG`
- Resize is done by direct vertex coordinate manipulation (setAngle to 0, move left/right vertices to ±newHalfWidth, then setPosition + setAngle re-orient and re-bound). Do NOT use `Phaser.Physics.Matter.Matter.Body.scale` — that path is unreliable and was silently failing.
- `_scaledLength` on each `_beamConstraints` entry tracks the body's current width for the resize delta
- `BEAM_OVERHANG = 6` — 6px per end = 12px junction overlap so 10px-radius wheels never fall through seams between segments. Must be maintained even as heavy vehicles stretch beams, hence the per-frame resize.
- Beam top edge lies along the joint-to-joint line (body shifted perpendicular-down by `thickness/2`)

**Anchor-to-anchor beams** are static (never move), thinner (10px), and don't resize.

## Vehicle System

Spawned by `physics.spawnVehicle(config)`:
- **Chassis**: 80×24 rectangle, density from config, mask excludes beams (`~0x0004`)
- **Two wheel circles**: radius 10px, density 0.003 (fixed), ±26px from chassis center, mask excludes joints
- **Axle constraints**: zero-length stiffness-1 constraints pinning wheels to chassis corners

Presets (LevelScene.js):
| Key   | density | driveSpeed |
|-------|---------|------------|
| car   | 0.003   | 5          |
| truck | 0.008   | 3          |
| tank  | 0.020   | 2          |

Drive force applied each tick to chassis; angular velocity damped to 30% per frame so chassis doesn't spin but can tilt on slopes.

## Level Data Schema

```js
{
  id, title, span, budget, worldWidth, worldHeight,
  terrain: {
    left:  { verts: [{x,y},...], physRect: {x,y,width,height}, color },
    right: { verts: [{x,y},...], physRect: {x,y,width,height}, color },
    waterY: number,
  },
  rocks: [{ id, verts, physRect, color, anchors: [{id,x,y},...] }],
  anchors: [{ id, x, y, side }],   // terrain attach points
  vehicles: [{ type, spawnAt, weight, speed }],  // ALWAYS an array (§2 rule 3)
  gravity: { y, label },
  materials: { road: {...}, wood: {...} },
}
```

`physRect` is a simplified rectangle used for the Matter.js static collision body. `verts` are the visual polygon. Rocks with `anchors` get joint nodes auto-created so players can attach beams to them.

## Scene-Side Bridge Data

LevelScene maintains two arrays mirroring the physics world:

- `this.joints` — `[{ bodyId, x, y, isAnchor }]`
- `this.beams`  — `[{ a, b, material, constraint }]`

`constraint` is the raw Matter.js constraint returned by `physics.buildBeam`. **After `rebuildBridge()`, `beam.constraint` must be updated** to the new constraint or the next `splitBeam` call will use a stale pointer and leave ghost collision bodies in the world.

`splitBeam(beamIndex, splitPoint)` removes a beam, inserts a new mid-joint, and pushes two replacement beams (each with their `constraint` field set).

## Key Invariants

- `physics.reset()` wipes all nodes, beam constraints, canyon bodies, and vehicle. Call `buildTerrain` + `buildRocks` + rebuild joints + rebuild beams after every reset.
- `buildRocks` is call-once per physics session (guarded). Calling it twice accumulates bodies.
- `ensureJointNode` is idempotent — safe to call multiple times with the same `jointId`.
- `rebuildBridge()` in LevelScene rebuilds from `this.joints` + `this.beams` on every test→build transition.

## Dev Commands

```bash
npm run dev      # Vite dev server
npm test         # Vitest (headless, jsdom)
npm run build    # Production bundle
```

Toggle `debug: true` in `main.js` Matter config for collision shape overlay.
