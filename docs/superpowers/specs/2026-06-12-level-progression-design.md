# Level Progression System — Design

**Date:** 2026-06-12 (revised same day after multi-agent review)
**Status:** Approved design, pending implementation plan
**Audience:** Children ages 5–10 (full spread: tutorials playable by 5-year-olds, later levels assume reading and basic math)

## Goal

A PolyBridge-style progression of 12 levels of increasing complexity, teaching game controls/UI, the GDD's Physics & Math topics (minus cables — existing mechanics only), and finishing with mastery challenges built on game-design principles (escalation, tension, no new teaching).

## Constraints

- **Existing mechanics only:** road/wood beams, block sizes (S/M/L/XL), budget, vehicle presets (car/truck/tank), rock pillars, terrain spans, stress glow. No cables, trusses, counterweights, convoys, or mid-cross vehicle pauses.
- **All levels open:** every level selectable from the menu from the start; layout suggests order. No unlock gating, no progress persistence, no stars.
- **Difficulty is data:** span, vehicle preset/weight, budget, terrain asymmetry, pillar placement, material/size whitelist. No new physics mechanics.

## Universal Win/Fail Conditions

- **Win:** the vehicle reaches the right-side exit zone. Beam snaps during the crossing do not fail the run by themselves.
- **Fail:** the vehicle falls (into water / off the bridge) or flips and cannot proceed.
- The success card always shows budget remaining.

## Level Keys & Ordering

- Level keys are `L01`–`L12` in `data/leveldata.js`; an ordered `LEVEL_ORDER` array drives the menu. Titles carry the phase framing (tutorial/topic/challenge); the T1–T3 labels below are design shorthand for L01–L03.
- The existing `L1` definition is retired (its canyon is reused by L04/L05). `DEV_STRESS` is kept but excluded from the menu (dev flag only).

## Curriculum Content Breakdown

### What gets taught, and where

| Strand | Items to teach | Levels |
|---|---|---|
| Controls & UI | Tap/click to place a beam, ghost-beam preview, the Test button | T1 (L01) |
| Controls & UI | Build → test → fail → retry loop; failure is safe (snapped beam glows red — soft stress-glow intro) | T2 (L02) |
| Controls & UI | Delete (tap-to-select + trash button), block sizes (S/M/L/XL), wood vs road materials, reading the budget meter | T3 (L03) |
| Physics | Gravity pulls down; the stress glow formally read as "where force is strongest" | L04 |
| Physics | More weight = more force; heavier vehicles need stronger bridges | L05 |
| Math | Triangles hold their shape; rectangles deform — the diagonal brace | L06, L07 |
| Physics | The middle of the bridge carries the most weight; build strongest there | L08 |
| Math | Counting and cost trade-offs; cheap vs strong materials, sizes have prices | L09 |
| Mastery | Combining everything under escalating pressure (no new teaching) | L10–L12 |

### Hint gating defaults (per phase)

- Tutorials (L01–L03): hint card on the **first** failure.
- Topic levels (L04–L09): hint card after **2** failures.
- Challenge levels (L10–L12): hint card after **2** failures, deliberately terse.

Per-level overrides allowed in the `tutorial` block.

### Phase 1 — Tutorials (ages 5+, icon-first, near-zero reading)

Tutorial cards in this phase are **icon-led**: a big pictogram/animation carries the meaning; text (≤1 short sentence) is reinforcement only.

**T1 "Make It Reach" (L01)** — Tiny gap needing exactly one beam between two pre-lit anchors. UI shows only one material (road), one block size (L, via the level's `materials.blocks` whitelist), and a giant pulsing TEST button. Animated hand/arrow shows where to tap. Win nearly guaranteed. Teaches: tap places a thing, green button makes the car go.

**T2 "Try Again!" (L02)** — Slightly wider gap (2–3 beams). Span/weight/snap-threshold are tuned so that **any flat 2–3 segment build is guaranteed to snap** — the child must experience failure safely. The snapping beam glows red (soft stress-glow introduction). Card icon: broken beam + happy retry arrow; text: "Fix it and try again!" If the child somehow wins first try, a normal success card shows (no broken lesson, just less drama). Teaches the retry loop; plants the gravity seed. UI adds the back-to-build/retry button.

**T3 "Builder's Tools" (L03)** — Pre-built wonky bridge with wrong-sized pieces. Child deletes bad beams (**tap-to-select + trash button** — the primary, touch-friendly path; right-click remains a desktop shortcut) and replaces them using different block sizes of **road and wood** (wood introduced here as the cheap bracing material, so L05 doesn't have to). Budget meter appears for the first time, very generous; prebuilt beams carry refundable cost so deleting them returns coins. Teaches the full toolset.

### Phase 2 — Topic levels (ages 7+, short sentences on cards)

**L04 "Gravity Pulls Down"** *(Forces & Gravity — teach)* — Medium span, light car. A rock pillar is present mid-span (usable but not required — its presence here means L05 introduces nothing new). Stress glow formally taught: "Red glow = too much force." Failure hint points at the snap location.

**L05 "Heavier Is Harder"** *(Forces & Gravity — practice)* — Same canyon as L04, but a truck; the L04 solution fails. The only new thing is **weight**. Budget is tuned **below the cost of any pillar-free brute-force build**, so anchoring to the pillar (seen in L04) becomes the discovery. Card: "The truck weighs more. What needs to change?"

**L06 "The Strongest Shape"** *(Triangles — teach)* — Wider span; a pre-built flat deck visibly sags. Card shows a square deforming vs a triangle holding. The fix is adding diagonal wood braces. **Anti-bypass:** size whitelist (no S road segments) + budget below the cost of doubling-up/segmenting the deck, so triangulation is the only affordable fix. Failure hint: "Try a slanted beam. What shape does it make?"

**L07 "Triangles Everywhere"** *(Triangles — practice)* — Wide span with a central pillar; child builds a real truss from scratch. Success card counts their triangles back to them.

**L08 "Balance the Load"** *(Weight & Balance)* — Asymmetric canyon (left wall lower than right), off-center pillar, heavy truck. Card: "The middle of the bridge carries the most weight. Build strongest there." The stress glow during the crossing is the live teaching aid.

**L09 "Count Your Coins"** *(Budget & Counting)* — Comfortable span, tight budget. Costs front-and-center: road strong but expensive, wood cheap; big blocks cost more than small. Success card shows the arithmetic: "You spent 14 of 16 coins."

### Phase 3 — Challenge levels (game-design principles)

**L10 "The Long Crossing"** — Widest span yet with one mid pillar, moderate budget. Demands triangulation + support anchoring. Escalation axis: **span**.

**L11 "Heavy Hauler"** — The tank (heaviest preset) over a modest span with a firm budget. Escalation axis: **weight**; the slow crawl of the tank is the drama.

**L12 "Master Builder"** — Long asymmetric span, tight budget, heavy vehicle, and a **different terrain topology**: two pillars at uneven heights, so the solution shape (stepped multi-truss) differs from L10/L11 rather than being "the same level harder." Success card celebrates budget left over and invites a retry to beat it.

## Supporting Systems

### Level select menu (`scenes/MenuScene.js`)

- New scene registered in `main.js`. It replaces/absorbs the crude level-select already in `BootScene.js` (which already calls `scene.start('LevelScene', { levelId })` — `LevelScene.init` already reads `data.levelId`, so the plumbing exists).
- Grid of 12 level cards: number, title, phase color-coding (tutorial / topic / challenge). All cards tappable from the start.
- LevelScene gets a "back to menu" button; on win, a success card with "Next Level" / "Menu" buttons. **The current win auto-return to build mode (≈1.5s in `endTest()`/`update()`) is suppressed and replaced by this card.**
- No persistence, no stars. Success card shows budget left over.
- Menu↔level transitions exercised repeatedly in testing (singleton attach/detach hygiene, lil-gui panel recreation).

### Tutorial card system (`systems/tutorial.js`)

- New singleton following the existing lifecycle contract: `attach(scene)`, `detach(scene)`, `reset()` — same as audio/juice/camera.
- Renders dismissable cards: big icon + at most one short sentence, large tap-anywhere-to-continue affordance.
- Three trigger points, hooked at existing LevelScene moments:
  - **on level start** — intro card (hook: `create()`)
  - **on fail** — hint card (hook: `showFail()`), gated by the per-phase failure counts above
  - **on win** — summary card (hook: `showWin()`)
- The animated hand/arrow pointer (T1) is part of this system.
- Cards are data, not code: each level definition carries a `tutorial` block.

### Per-level UI simplification

- The HTML chrome (toolbar, top bar, size row) is mounted **once at boot** by `mountUi()` (`src/main.js` → `src/ui-html/index.js`) and persists across scenes — LevelScene does not build it. Therefore: **LevelScene emits a `ui:config` bus event in `create()`** carrying the level's `ui` block; Toolbar/TopBar/SizeRow subscribe and show/hide accordingly.
- `ui` block shape: `{ budgetMeter: bool, delete: bool, vehicleSelect: bool, tools: [...] }`. Defaults to everything-on, so L04–L12 need little or no `ui` block; T1–T3 progressively switch elements on.
- **Size whitelists are NOT a `ui` flag** — they're expressed in the level's `materials.<mat>.blocks` object, which the SizeRow already renders dynamically. Material whitelists are expressed by omitting the material from the level's `materials`; the toolbar hides the corresponding tool tiles via `ui:config`, and keyboard shortcuts (e.g. `B` for wood) are guarded against undefined materials.
- **Delete UX:** tap-to-select + trash button added as the primary delete path (touch-friendly, taught in T3); right-click delete kept as a desktop shortcut. Both gated by `ui.delete`.

### Vehicle enforcement

- Levels specify a preset key (`car`/`truck`/`tank`) plus optional design-scale (1–10) weight override. `toggleTest()` must **prefer level data over the cheat-panel params** (today `_cheatParams` silently overrides the level's vehicle — that makes "the tank level" unenforceable).
- The vehicle selector (sidebar + keys 1/2/3) is lockable via `ui.vehicleSelect: false` for levels where the vehicle IS the challenge (L05, L11, L12).

### Level data (`data/leveldata.js`)

- Grows to `L01`–`L12` plus `LEVEL_ORDER`; `DEV_STRESS` kept behind the dev flag.
- New optional schema fields:
  - `tutorial` — intro/hint/summary cards and hint gating overrides
  - `ui` — visibility flags as above
  - `prebuilt` — joints + beams pre-placed at load (T1's near-built bridge, T3's wonky bridge, L06's sagging flat deck). Loads through the same path the save/load system uses: push joints/beams with `constraint: null`, call `rebuildBridge()`.
- **Prebuilt caveats (from code review):**
  - `clearBridgeData()` (called on the post-test auto-return) resets joints to anchors-only — it must **re-apply the level's `prebuilt` data** so prebuilt bridges survive retry cycles.
  - Prebuilt beams must carry refundable cost so deleting them returns budget (today only player-placed beams have undo-stack refund entries); levels with `prebuilt` start with the prebuilt cost already deducted from the budget.
- Asymmetric terrain (L08, L12) is already expressible: left/right `verts`/`physRect` are independent.

## Testing

Vitest coverage for:
- Level data validation — all 12 levels satisfy the schema.
- Budget sanity, both directions: budget ≥ cost of the intended solution, AND for intended-failure levels (L05, L06) budget < cost of the documented brute-force alternative.
- `ui` flag defaults (omitted block = everything on) and `ui:config` event payloads.
- Tutorial trigger logic — per-phase fail-count gating and per-level overrides.
- `prebuilt` loading produces correct `joints`/`beams` arrays, survives a clear/retry cycle, and budget starts net of prebuilt cost.
- Vehicle enforcement — level vehicle data wins over cheat params.

## Risks

- **LevelScene growth** — it is already the largest file and absorbs menu transitions, tutorial hooks, and UI flags. Mitigation: tutorial and UI-flag logic live in `systems/tutorial.js`, `ui-html` components, and level data; scene additions stay thin (emit event, call singleton).
- **Tuning effort** — each level's budget/span/weight must be playtested so the intended failure (T2, L05, L06) actually happens and the intended solution fits the budget. T2's failure must be *guaranteed*, not probable. This is per-level feel-check work, not code risk.
- **ui-html refactor** — the boot-mounted HTML chrome needs the `ui:config` subscription added to Toolbar/TopBar/SizeRow; modest but touches three components.

## Out of Scope

- Unlock gating and progress persistence (all levels open).
- Star ratings.
- Cables, trusses, counterweights, convoys, hazards, wind, mid-cross vehicle pauses.
- The GDD's predictive snap cue (wobble + creak at stress > 0.85) — not wired into the curriculum; if it exists in the build it remains ambient polish.
- Sandbox editor changes.
- Difficulty bands.
