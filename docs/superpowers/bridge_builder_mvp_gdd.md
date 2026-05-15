# Bridge Builder — MVP Game Design Document

**Status:** Design spec for stakeholder-demo prototype (v1) and full MVP (v2). Vibe-coded with Claude Code.
**Target:** Browser-first (desktop + mobile-web). Android port via Capacitor is post-demo work.
**North Star:** **Bridge Constructor Portal fidelity** — weighty physics, dramatic collapses, polished feel.
**Anchor grade:** 4–5 (mechanics scale up/down via difficulty multipliers in v2; v1 demo ships a single Standard band).
**Demo audience:** Stakeholders (not children, in v1). Demo must read as a "real game," not a school product.

---

## 1. Design Pillars — Bridge Constructor Portal Fidelity

The four non-negotiable pillars. Every breadth-vs-polish tradeoff resolves in favor of these. They override scope on any session that puts them at risk.

### 1.1 Physics-feel

- Beams visibly sag and flex under load — soft constraints, not rigid sticks.
- Vehicles have inertia, rock on uneven decks, and suspension visibly compresses on heavy loads.
- Failures cascade: one snap → neighbors overload → chain reaction is dramatic and clearly visible. **Cascades are staggered (80–120ms between snaps, scaled by `timeScale`) — not instantaneous.** Each snap fires its own particle + audio.
- Slow-motion auto-engages on the first beam snap: **~50ms freeze-frame at snap tick** → lerp 1.0 → **0.17** over 250ms → **hold while cascade is active** (chain-settled threshold 200ms) → lerp back over 400ms. NaN watchdog gates timeScale changes.
- Gravity tuned to feel weighty, not floaty (suggested 1.5–2× Matter.js default; validated by feel-checks, not numbers).
- Cables sag visibly when slack, twang taut when loaded, never push.

### 1.2 Visual language

- Flat-cartoon canyon backdrops with parallax (foreground rocks, mid canyon, sky).
- Material textures on beams: wood grain (warm brown), steel hatching (cool grey), cable braid (thin lines with rope shading).
- Stress visualization is **glow + thickness shimmer**, not pure color tint — preserves clarity for colorblind students (CVD-safe).
- **Predictive snap cue:** at stress > 0.85 the beam adds a 1–2px sinusoidal wobble at 8–12Hz plus a material-specific creak audio loop. This is the "this beam is about to go" tell.
- Physics-driven debris on collapse: chunks fall with rotation, splash water, kick up dust.
- Vehicles have personality (small bounce on each wheel; tilt on inclines; exhaust puffs).

### 1.3 Camera

- Edit mode: auto-frames the bridge anchors + buildable area.
- Test mode: follows the vehicle with smooth lag (Phaser camera follow + lerp).
- Punch-in zoom on snap events: 1.2× zoom + camera lerp to the snap midpoint during the slow-mo hold; releases on cascade settle.
- Screen-shake on collapse, intensity scaled by `mass × velocity`.

### 1.4 Audio behavior

- Material-specific: wood creak under load, steel ping under tension, cable twang on snap, low-end thud on collapse. **Each snap material has ≥3 variants with randomized pitch** — prevents the third demo collapse sounding identical to the first.
- **Audio ducking on slow-mo:** music + ambient drop −12 dB while slow-mo is active; the snap SFX owns the mix.
- Vehicle engine pitch correlated to weight (heavier = lower pitch).
- Success chime musically tied to the last successful beam (e.g., chord rooted in beam count modulo a scale).
- Ambient canyon: wind, distant water, optional birds.

**Feel-check gate:** at the end of every implementation session in Phase 1, the team plays the latest build with these pillars in mind. If any pillar regresses, the session is not "done."

---

## 2. Game Overview

A 2D physics-based bridge construction game embedded in the Educational App. Children progress through **5 curated levels**, each teaching one core Physics or Math concept, then unlock a **full Sandbox Editor** (BCP-style) where they design and play their own levels locally.

### The Core Loop

```
PLAY → 5 curated levels (linear unlock)
   → each level teaches 1 concept via build-test-iterate
   → completion unlocks materials + next level

UNLOCK SANDBOX (after L5 cleared)
   → place anchors, hazards, vehicle entry/exit
   → choose materials available
   → save level locally
   → replay your own saved levels anytime
```

### Why this design

- **Linear PLAY → unlock CREATE** mirrors Bridge Constructor Portal's proven model
- Each level introduces ONE concept (the cardinal rule of educational game design)
- Sandbox is the reward, which keeps engagement high through the curriculum
- Saved levels become a personal library the child returns to

---

## 3. The 5 Topics & Levels

3 Physics levels + 2 Math levels, ordered for difficulty progression.

| # | Topic | Type | Core Concept | Unlocks |
|---|-------|------|--------------|---------|
| L1 | Forces & Gravity | Physics | Weight pulls down; bridges sag and break under load | Wooden beam |
| L2 | Geometry & Triangles | Math | Triangles distribute force; rectangles deform | Triangular truss |
| L3 | Tension & Compression | Physics | Cables pull, beams push; different materials for different jobs | Steel cable |
| L4 | Balance & Center of Mass | Physics | Where weight sits affects stability | Counterweight block |
| L5 | Budget Optimization | Math | Trade-offs: cost vs strength vs weight | Mixed materials + Sandbox |

### Level 1 — Forces & Gravity

**Concept taught:** Gravity pulls everything down. A bridge must resist this downward pull. More weight = more force.

**Scenario:** A narrow chasm. Two fixed wooden anchor points on opposite walls. A **Car (200 kg)** must cross.

**Available materials:**
- Wooden beam only (one material — keeps focus on concept)

**Constraints:**
- Budget: ₹500 (each beam ₹50)
- Vehicle weight: 200 kg (Car — matches §6 asset library; visible weight feel)
- Bridge span: 6 metres

**Environmental objects:**
- Canyon walls (left, right)
- Water below (visual only — losing means the car falls in)
- Wind indicator (static for L1, will be active later)

**Teaching elements:**
- Intro tutorial card: "Watch what happens if the bridge is too thin. Add beams until the car makes it across."
- On-failure prompt: "Where did it break? That's where the force was strongest."
- Post-success summary: "You used 6 beams to hold up 200 kg. That's engineering."

**Win condition:** Car reaches the right anchor with no beam broken.

**Stress visualization:** Beams glow green (low load) → yellow (50%) → red (90%) → snap. **Glow halo + thickness shimmer** accompanies the colour change for CVD-safe readability.

---

### Level 2 — Geometry & Triangles (Math)

**Concept taught:** A triangle is the only polygon that holds its shape under load. Rectangles collapse into parallelograms; triangles don't.

**Scenario:** Wider chasm (10m). The naive solution from L1 (straight beams) will visibly sag. Player must discover triangulation.

**Available materials:**
- Wooden beam
- Triangular truss preset (3 beams placed at once — unlocked at start of L2 after a short tutorial)

**Constraints:**
- Budget: ₹800
- Vehicle weight: 150 kg
- Bridge span: 10 metres

**Environmental objects:**
- Higher canyon walls
- A central rock pillar in the chasm (optional support point — teaches that triangles can anchor to multiple points)

**Teaching elements:**
- Tutorial overlay before build: animated demo of a square deforming into a parallelogram, then a triangle staying rigid.
- On-failure hint card: "Try adding a diagonal beam. What shape does it make?"

**Math angle (literal):** Info panel shows the angle of each placed beam. Hint: "Beams at 30–60° are strongest for this distance."

**Win condition:** Truck crosses. Bonus stars for using ≤3 triangular trusses.

---

### Level 3 — Tension & Compression (Physics)

**Concept taught:** Materials behave differently. Beams push (compression). Cables pull (tension). A real bridge uses both.

**Scenario:** A deep canyon, too wide to span with beams alone (15m). Player must build a suspension-style bridge using cables anchored above.

**Available materials:**
- Wooden beam
- Triangular truss
- Steel cable (new) — cheaper than beam, but only works in tension (snaps if compressed)
- Overhead anchor point (pre-placed on top of canyon walls)

**Constraints:**
- Budget: ₹1200
- Vehicle weight: 200 kg
- Bridge span: 15 metres

**Environmental objects:**
- Tall canyon walls with cable anchor points at the top
- Wind (light — introduces dynamic load)

**Teaching elements:**
- Tutorial animation: tug-of-war demo showing "A rope can pull but it can't push. Cables are like ropes."
- Live tagging during test: beams turn blue when in tension (wrong material), red when overloaded (wrong); cables turn blue when in tension (correct).

**Visual physics teaching:**
- Cables show as thin lines, glow blue under tension
- Beams show as thick rectangles, glow orange under compression
- Wrong material in wrong place visibly fails (cable goes slack and snaps if compressed)

**Win condition:** Truck crosses using at least one cable.

---

### Level 4 — Balance & Center of Mass (Physics)

**Concept taught:** Where weight sits on a bridge changes how it loads. A heavy truck in the middle stresses the centre most. Counterweights and arch shapes redistribute load.

**Scenario:** Asymmetric canyon — left wall lower than right wall. A heavier vehicle (a school bus) crosses. The bridge must handle uneven loading.

**Available materials:**
- All previous (beam, truss, cable)
- Counterweight block (new) — heavy static object that can be placed to balance the structure

**Constraints:**
- Budget: ₹1500
- Vehicle weight: 400 kg (school bus)
- Bridge span: 12 metres asymmetric

**Environmental objects:**
- Uneven canyon walls
- Centre-of-mass indicator (visual: a glowing dot showing where the bus is heaviest)
- Test mode shows the bus pausing at the middle for 2 seconds — peak load moment

**Teaching elements:**
- Pre-build animation: a seesaw with a heavy kid on one side, showing how a counterweight balances it
- During test: live arrow showing where the load is concentrated
- Hint card: "The bus is heaviest in the middle. Build strongest where it sits longest."

**Win condition:** Bus crosses without bridge tilt exceeding 15°. Bonus for using a counterweight.

---

### Level 5 — Budget Optimization (Math)

**Concept taught:** Real engineering is about trade-offs. Cheap solutions fail; expensive solutions waste money. Find the minimum cost that works.

**Scenario:** A canyon with three possible crossing points (low/medium/high). Player picks the route. Three vehicles must cross sequentially: a bike (50 kg), a car (200 kg), a truck (500 kg).

**Available materials:**
- All previous
- Cost displayed prominently per material
- Each material now has a Strength rating (visible in tooltip)

**Constraints:**
- Budget: ₹2000 (will fail if used naively)
- Three vehicles must all cross
- An efficiency score is shown post-success

**Environmental objects:**
- Three crossing points at different heights and widths
- A scoreboard tracking efficiency (% of budget unused)

**Teaching elements:**
- Hint card: "You don't need the strongest material everywhere. Where will the weakest beam be enough?"
- Post-success summary: "You finished with ₹X to spare. Try again to beat your best score?"

**Win condition:** All three vehicles cross. **Sandbox unlocks** on success.

**Math angle (literal):** A summary screen shows cost-per-vehicle, cost-per-metre, and the child's personal best. This is the math reflection.

---

## 4. Difficulty Scaling Across Grades

**Status for v1 demo:** Out of scope. v1 ships a single **Standard** band only. Multi-band scaling reintroduces in v2 after stakeholder validation.

Since target is "mixed grades," each level has three difficulty bands gated by a single multiplier in config:

| Band | Grade fit | Budget | Vehicle weight | Hint frequency |
|------|-----------|--------|---------------|----------------|
| Easy | 3–4 | ×1.5 (generous) | ×0.7 | High — hints after every failure |
| Standard | 4–5 (anchor) | ×1.0 | ×1.0 | Medium — hints after 2 failures |
| Hard | 6–7 | ×0.7 (tight) | ×1.3 | Low — hints only after 3 failures |

A single difficulty slider in settings exposes this. Level design is identical — only the constraints scale.

---

## 5. The Sandbox Editor (Unlocked after L5)

**Status for v1 demo:** **In scope.** The sandbox is part of the stakeholder demo per project direction — it is the BCP-style "unlimited content" proof. To make this achievable, the v1 sandbox ships with a reduced mode set (see §12 demo slice). Hazards and checkpoints are deferred to v2.

A full BCP-style level editor. The child can design their own levels, save them locally, and replay them anytime from a personal library.

### Editor Modes

**Environment mode** — place terrain, hazards, and structural elements:
- Canyon walls (left + right, height adjustable by drag)
- Rock pillars (mid-chasm supports)
- Water level (visual + fail condition)
- Wind zones (low/medium/high, optional) — **v2**

**Anchor mode** — place attachment points for the bridge:
- Fixed anchor (red glow — bridge must connect here)
- Optional anchor (yellow glow — connection helps but isn't required)

**Vehicle mode** — define what crosses:
- Entry point (left side)
- Exit point (right side)
- Vehicle type: bike / car / truck / bus / convoy of multiple
- Speed (slow / normal / fast)

**Hazard mode** — add challenge: — **v2**
- Acid pool (truck fails on contact — homage to BCP)
- Falling rocks (timed obstacles)
- Wind gusts (periodic horizontal force on the bridge)
- Weight increase trigger (truck gets heavier mid-cross)

**Checkpoint mode** — segment the journey: — **v2**
- Mid-bridge platforms the truck must briefly stop on
- Each checkpoint stresses the bridge at a different point

**Constraint mode** — set the rules for the bridge:
- Budget (₹100–₹5000 slider)
- Material whitelist (which of the 5 materials are allowed)
- Time limit (optional — for speedrun-style levels) — **v2**

### The Build-Solve-Save Flow

```
EDIT  → Place environment, anchors, vehicle path, hazards, constraints
SOLVE → Switch to Solve mode → Build a bridge in the level you just designed
        → Run the test → See if your design is playable
SAVE  → Name it → Stored locally in "My Levels"
REPLAY → Open "My Levels" anytime → Pick a saved level → Play it again
```

Saving requires successfully solving once — this ensures a level the child returns to later is actually playable, not just an unfinished sketch.

### "My Levels" Library

A simple local list of every level the child has designed and saved. Each entry shows:
- Custom title
- Thumbnail screenshot of the layout
- Best completion time
- Date created
- Replay button + Edit button + Delete button

No sharing, no online sync, no feed — purely a personal scrapbook on the device.

---

## 6. Asset Library (MVP Scope)

### Bridge materials (5 total)
1. Wooden beam — straight, brown, compression-only
2. Triangular truss preset — 3 beams placed as triangle
3. Steel cable — thin, grey, tension-only
4. Counterweight block — grey square, static heavy object
5. Mixed road deck — laid on top of beams, the truck rolls on this

### Vehicles (5 total)
1. Bicycle (50 kg) — narrow, fast
2. Car (200 kg) — medium **— used in L1**
3. Delivery truck (350 kg) — wider
4. School bus (400 kg) — long, slow, pauses mid-cross
5. Convoy (3 cars in sequence) — tests sustained load

### Environmental objects (8 total)
1. Canyon wall (resizable)
2. Rock pillar
3. Water plane
4. Wind zone
5. Acid pool — **v2**
6. Falling rock spawner — **v2**
7. Checkpoint platform — **v2**
8. Decorative tree/cloud (cosmetic)

### Hazards (4 total) — **v2**
1. Acid pool
2. Falling rocks (timed)
3. Wind gust trigger
4. Mid-cross weight increase

**Total asset count: ~22 unique sprites.** All sourceable from Kenney (free, CC0) with style pass.

### Sourcing strategy (locked)

| Category | Source | Notes |
|---|---|---|
| Beams, cables, anchors, trusses | **Programmatic** (Phaser `Graphics`) | Stress visualisation (glow + thickness shimmer) needs runtime control — sprites would fight us. |
| Vehicles (car, bus, truck, bike) | **Kenney** (CC0) — `Cars`, `Platformer Pack Redux`, `Cartoon Transportation` | Side-view sprites with wheels attachable to Matter.js bodies. |
| Canyon backdrops (parallax) | **Kenney** (CC0) — `Background Elements`, `Platformer Pack Redux` | Combined with a flat gradient sky layer. |
| Particles (debris, dust, splash, sparks) | **Programmatic** (Phaser Particle Emitter) | Emit at runtime on collapse / splash / snap. |
| UI (buttons, panels, HUD) | **Kenney UI Pack** (CC0) | Restyled with a small palette pass. |
| Material textures (wood grain, steel hatch, cable braid) | **Kenney Pattern Pack** (CC0) or hand-painted | Tile-able patterns applied to programmatic beams. |
| SFX (creak, snap, thud, twang, engine, ambient) | **Freesound.org** (CC0 + CC-BY) + `SFXr`/`Bfxr` for synthetic snaps | Material-specific; weight-correlated engine pitch via runtime modulation. |
| Music stings | **Kenney Music Loops** (CC0) | Short success / failure cues. |

**Phase 1 (sessions 1–8.5) ships with zero external assets** — pure programmatic primitives. External-asset work begins in Phase 2.

---

## 7. Tech Stack

### Core
- **Phaser 3** — 2D game framework. Excellent Matter.js integration, mature, well-documented.
- **Matter.js** — physics engine. Native constraints (joints between bodies) = beams. Native distance constraints with one-way stiffness = cables. Built into Phaser.
- **Vanilla JavaScript** — keeps vibe-coding sessions fast (no compile step).
- **Capacitor** — wraps the web build into a native Android app. Same code runs in browser during dev. **Post-demo.**
- **IndexedDB** (raw or via small wrapper) — saves level data, sandbox levels, thumbnails, and progress locally on device. No backend. LocalStorage explicitly avoided: thumbnails + level JSON hit the ~5MB quota cliff at 50–80 sandbox levels, and `QuotaExceededError` is synchronous + corrupts in-flight writes.

### Matter.js tuning for BCP-feel (not defaults)
- `positionIterations=8, velocityIterations=6, constraintIterations=4` — required for cable/steel stiffness ≥ 0.9 to converge without visible ringing. Sub-step count is well within CPU budget on a midrange laptop.
- Constraint `stiffness` tuned per material (wood ~0.7, steel beam ~0.9, cable ~0.95 in tension, 0 in compression).
- Sleeping thresholds **disabled** for active vehicles to keep collapse motion alive.
- Custom stress reader: **`stiffness × |constraint.currentLength − constraint.length|`** per tick, smoothed (Hooke's-law proxy read off the constraint itself). _Note: do NOT measure body forces — that tracks vehicle acceleration, not beam load, and would make the stress-glow pillar visibly wrong._
- Slow-mo: scale `engine.timing.timeScale` to 0.3 on snap event; lerp back over 1s once motion stabilises.

### Why not Godot/Unity
- Slower iteration loop (compile → export → test)
- Browser-based gives instant feedback per save
- Easier context retention in code-editing tools

### Project structure (start flat)
```
bridge-builder/
  index.html
  game.js                  ← Phaser config, scene registration
  scenes/
    BootScene.js           ← asset loading + loading-bar contract
    MenuScene.js           ← level select
    LevelScene.js          ← parameterised play scene (handles all 5 levels)
    SandboxEditScene.js    ← editor (Environment/Anchor/Vehicle/Constraint modes)
    SandboxPlayScene.js    ← solves a sandbox-authored level (composes playloop.js, ≈95% LevelScene logic)
    MyLevelsScene.js       ← saved levels library
  systems/
    physics.js             ← beam/cable factory, stress reader, tuned constants — the ONLY file that calls scene.matter.*
    playloop.js            ← shared build/test/win/fail loop; composed by LevelScene + SandboxPlayScene
    camera.js              ← edit/test framing, follow, punch-in zoom
    juice.js               ← screen shake, slow-mo, flash, particle hooks
    audio.js               ← material-specific SFX, weight-correlated pitch
    tutorial.js            ← hint/tutorial card system
    progression.js         ← unlocks, save state
    storage.js             ← IndexedDB save/load (schema-versioned)
    leveldata.js           ← the 5 level configs as JSON
  assets/
    sprites/               ← Kenney + custom
    audio/                 ← collapse sfx, success chime, ambient
```

Split files only when one exceeds ~400 lines.

### Architecture rules (locked after architect review)

- **Physics seam rule.** Scene code never calls `scene.matter.*` directly. Every Matter operation routes through `systems/physics.js`. Reason: if the Phase-1 feel-check shows Phaser's Matter plugin is fighting us on slow-mo / sub-stepping, the migration to standalone Matter touches one file, not five.
- **System lifecycle contract.** Every singleton in `src/systems/` exposes `attach(scene)`, `detach(scene)`, `reset()`. Scenes call `attach` from `create`, `detach` from `shutdown`. Reason: prevents zombie audio loops, leaked `timeScale = 0.3` into other scenes, and particle emitters firing into destroyed scenes when the player hits Menu mid-collapse.
- **Vehicle list is always an array.** `level.vehicles: [{ type, spawnAt, weight }]`. L1–L4 have arrays of length 1; L5 has length 3. Reason: L5's multi-vehicle scenario is not a special case, just longer data.
- **Sandbox is two scenes, not one.** `SandboxEditScene` (no physics ticking, drag-to-place input) and `SandboxPlayScene` (physics running, vehicle-follow camera). Shared playloop logic via `systems/playloop.js`, not state-machine `if` branches inside one scene.
- **Perf budget.** 200 active Matter bodies maximum. Debris uses an object pool, not allocation. NaN watchdog: each tick, `isNaN(body.position.x)` on all dynamic bodies; on detect, force `timeScale=1.0`, restore positions/velocities from level-start snapshot via `Body.setPosition` + `Body.setVelocity({x:0,y:0})`. **Never** `Engine.clear()` — loses event listeners.
- **Cascade processing.** Snaps collected in a `pendingSnaps[]` set during stress evaluation; constraint removal happens in a second pass *after* iteration completes. Stagger inter-snap by 80–120ms (scaled by `timeScale`), cap recursion depth at 5/tick.
- **Cable one-way logic.** Mutated via a single engine-level `Matter.Events.on(engine, 'beforeUpdate')` callback that walks all cable constraints; per-constraint callbacks don't exist in Matter.
- **Collision filtering.** Bitmask categories: `VEHICLE`, `BRIDGE`, `DEBRIS`, `ENVIRONMENT`. Debris doesn't collide with vehicles (prevents wheel-jams); vehicles don't collide with the bridge they're rolling on (uses the deck constraint instead).
- **Constraint pre-warm.** 30 silent physics ticks at level start before the bridge is shown — settles initial jitter from constraint initialization.

---

## 8. MVP Build Sequence (Vibe Coding Sessions)

Each session = one clear, working improvement. Don't move on until the previous is solid.
**Feel-check gate (Phase 1+):** at the end of each session, the build is played end-to-end against the §1 pillars. If any pillar regresses, the session is not done.

### Phase 1 — Core Mechanics (Sessions 1–8.5) — _zero external assets_
1. Phaser scene with canyon walls + chasm. Static, no physics.
2. Tap two points → a sphere (joint) appears at each, beam between them.
3. Joint snapping within 20px of existing joints.
4. Matter.js physics ON. Beams become constraints. Gravity pulls. **Sub-steps tuned, stiffness tuned.**
5. Static anchor points (don't fall). Beams attach to them.
6. Truck body (Matter.js rectangle) rolls across using applied force. **Suspension feel pass.**
7. Stress reading per beam → glow + thickness shimmer interpolation.
8. Win/fail detection. Truck reached exit = win. Beam broke = fail.
8.5. **Juice & camera pass:** screen shake on collapse, slow-mo on snap, camera follow + punch-in zoom, basic audio hooks (creak, snap, thud).

**End of Phase 1: A single playable level that feels BCP-grade.**

### Phase 2 — Levels & Progression (Sessions 9–14.5)
9. Level config system — load level params from JSON.
10. Level 1 polished (Forces & Gravity).
11. Cable material (Matter.js stiff constraint, snaps if compressed).
12. Levels 2 and 3.
13. Counterweight + asymmetric canyon (Level 4).
14. Budget + multi-vehicle (Level 5).
14.5. **Material polish pass:** wood/steel/cable textures, material-specific audio, vehicle-weight-correlated engine pitch.

**End of Phase 2: 5 working levels, no Sandbox yet.**

### Phase 3 — Tutorials + Polish (Sessions 15–18)
15. Tutorial card system — text bubbles and overlay animations, triggered by events.
16. Per-level tutorial scripts (pre-build intro, on-failure hints, success summary).
17. HUD: budget meter, weight meter, beam count.
18. Ambient audio (wind, water), success chime, final polish pass.

**End of Phase 3: 5 polished levels with tutorials.**

### Phase 4 — Sandbox Editor (Sessions 19–25)
19. Mode switcher (Environment / Anchor / Vehicle / Constraint — hazards/checkpoint deferred to v2).
20. Environment placement (drag walls, pillars).
21. Anchor placement.
22. Vehicle entry/exit + type picker.
23. Constraint mode (budget + material whitelist).
24. Solve mode (toggle from edit to play in the level you just built).
25. Local save (schema-versioned) + "My Levels" library scene (list, replay, edit, delete).

**End of Phase 4: v1 demo complete. Stakeholder slice (§12) is achievable.**

### Phase 5 — Mobile Wrap (Sessions 26–28) — **Post-demo**
26. Capacitor setup, Android build.
27. Touch input verification (replace mouse with finger).
28. Performance pass on low-end Android (object count caps, draw call check).

**Total: ~26 vibe coding sessions for the v1 demo (Phases 1–4); +3 for Android wrap.**

---

## 9. What's NOT in MVP

Explicitly excluded to keep scope contained:

- **Multiplayer / co-build** — single-player only
- **Publishing / sharing levels** — saved levels are local-device only
- **Online feed / discover / community** — no social layer at all
- **Cloud sync** — local save only; if device is lost, levels are lost
- **Custom material creation** — only the 5 pre-built materials
- **Free-form curve drawing** — bridges are always beam + cable networks
- **Animation rigging for vehicles** — vehicles are simple Matter.js bodies
- **Voice-over for tutorials** — text-only cards in MVP
- **More than 5 curated levels** — Sandbox covers infinite variety
- **3D anything** — fully 2D side-view
- **Hazards & checkpoints in sandbox v1** — deferred to v2 (acid pools, falling rocks, wind gusts, weight triggers, checkpoint platforms)
- **Difficulty bands in v1** — single Standard band only; multi-band scaling is v2

---

## 10. Success Metrics for MVP

### v1 stakeholder demo
1. **Three unfamiliar observers** play the demo unsupervised; ≥2 of 3 finish L1 without help.
2. All three observers say the physics felt **"real"** or **"weighty"** — the BCP-fidelity bar.
3. A stakeholder watching unannounced reads it as **"a real game,"** not **"a school product."**
4. Live sandbox demo: a stakeholder builds and saves a one-anchor, one-vehicle level on stage in under 3 minutes.

### v2 child playtest (post-demo)
1. They complete all 5 levels in one session (~30–45 mins)
2. They can articulate one physics concept they learned ("triangles are strong because…")
3. They build at least one Sandbox level without prompting
4. They return to replay one of their own saved levels at least once

If 3 of 4 v1 criteria hit, the demo is validated. If 3 of 4 v2 criteria hit, the MVP is validated.

---

## 11. Open Questions for Production

These don't block MVP build but need answers before launch:

1. **Tutorial voice-over** — recorded VO vs text-only. When to upgrade?
2. **Save state durability** — LocalStorage is fragile on mobile; should we use IndexedDB from day one?
3. **Saved level cap** — how many levels can a child save? (Storage budget on low-end Android)
4. **Curriculum alignment** — NCERT, CBSE, state board, or curriculum-agnostic?
5. **Accessibility scope** — beyond CVD-safe stress visualisation, what motor/cognitive accessibility ships?
6. **Telemetry-without-backend** — should we log play events to localStorage for export, even with no server?

---

## 12. Stakeholder Demo Slice (v1)

The ≤20-minute on-stage experience built from Phases 1–4 above.

### The arc
1. **Open on Menu** — five level cards, only L1 unlocked. Sandbox card locked with a teaser tooltip.
2. **L1: Build → first-try fail → rebuild → win** — the BCP hook. First build sags too much; one beam snaps; slow-mo + screen shake fire. Rebuild with one more beam; car crosses; success chime; stars fill.
3. **L2 unlock animation** — material reveal (triangular truss); brief tutorial of triangles being rigid.
4. **L2: quick guided win** — driver shows triangulation, succeeds in ≤90 seconds.
5. **Time-skip card:** "After completing L3, L4, L5…" — segue (avoids building all five in the slice but proves the curriculum arc exists).
6. **Sandbox unlock** — celebration animation; new card appears in menu.
7. **Sandbox demo** — driver places: one canyon, two anchors, one car entry/exit, budget ₹500, wood-only whitelist. Switches to Solve mode; builds a bridge; tests; succeeds; saves as "Stakeholder Demo".
8. **My Levels** — driver opens the library; the saved level is there with a thumbnail; replays it.
9. **Close** — driver hits Menu; the L2/L3/L4/L5 cards are visible-but-locked; the Sandbox card is unlocked; the loop is complete.

### What ships in the demo build (v1 cut of the GDD)
- Levels L1–L5 mechanically working; L1–L2 polished to demo-grade.
- Sandbox with **4 modes** (Environment, Anchor, Vehicle, Constraint) — hazards and checkpoints stubbed-out or hidden.
- Save / load / replay loop working with schema-versioned storage.
- BCP-fidelity pillars (§1) holding on the demo path.
- One band of difficulty (Standard).
- Audio: material SFX, vehicle engine, ambient, success chime.

### Definition of "ready for the stakeholder room"
- Three unfamiliar observers play the demo unsupervised; ≥2 of 3 finish without help.
- All three observers say the physics felt good.
- Run the full demo arc 5 times in a row with zero crashes.
- The save-and-replay loop survives a browser refresh.

### Out of demo scope (deferred to v2)
- Hazards (acid pool, falling rocks, wind gust, weight trigger), checkpoint platforms, time limits.
- Difficulty bands (Easy / Hard).
- Capacitor / Android wrap.
- Voice-over.
- Hindi / regional language layer.
- Telemetry / analytics.
