# Level Progression System — Design

**Date:** 2026-06-12
**Status:** Approved design, pending implementation plan
**Audience:** Children ages 5–10 (full spread: tutorials playable by 5-year-olds, later levels assume reading and basic math)

## Goal

A PolyBridge-style progression of 12 levels of increasing complexity, teaching game controls/UI, the GDD's Physics & Math topics (minus cables — existing mechanics only), and finishing with mastery challenges built on game-design principles (escalation, tension, no new teaching).

## Constraints

- **Existing mechanics only:** road/wood beams, block sizes (S/M/L/XL), budget, vehicle presets (car/truck/tank), rock pillars, terrain spans, stress glow. No cables, trusses, counterweights, or convoys.
- **All levels open:** every level selectable from the menu from the start; layout suggests order. No unlock gating, no progress persistence, no stars.
- **Difficulty is data:** span, vehicle preset/weight, budget, terrain asymmetry, pillar placement, material/size whitelist. No new physics mechanics.

## Curriculum Content Breakdown

### What gets taught, and where

| Strand | Items to teach | Levels |
|---|---|---|
| Controls & UI | Tap/click to place a beam, ghost-beam preview, the Test button | T1 |
| Controls & UI | Build → test → fail → retry loop; failure is safe and fun | T2 |
| Controls & UI | Right-click delete, block sizes (S/M/L/XL), reading the budget meter | T3 |
| Physics | Gravity pulls down; stress glow shows where force is strongest | L4 |
| Physics | More weight = more force; heavier vehicles need stronger bridges | L5 |
| Math | Triangles hold their shape; rectangles deform — the diagonal brace | L6, L7 |
| Physics | Where weight sits matters; build strongest where the vehicle lingers | L8 |
| Math | Counting and cost trade-offs; cheap vs strong materials, sizes have prices | L9 |
| Mastery | Combining everything under escalating pressure (no new teaching) | L10–L12 |

### Phase 1 — Tutorials (ages 5+, near-zero reading, icon-led)

**T1 "Make It Reach"** — Tiny gap needing exactly one beam between two pre-lit anchors. UI shows only one material, one block size, and a giant pulsing TEST button. Animated hand/arrow shows where to tap. Win nearly guaranteed. Teaches: tap places a thing, green button makes the car go.

**T2 "Try Again!"** — Slightly wider gap (2–3 beams). The obvious flat build sags and may snap — deliberately, so the child experiences failure safely. Card: "It broke! That's okay — fix it and try again." Teaches the retry loop; plants the gravity seed. UI adds the back-to-build/retry button.

**T3 "Builder's Tools"** — Pre-built wonky bridge with wrong-sized pieces. Child right-click-deletes bad beams and replaces them using different block sizes. Budget meter appears for the first time, very generous. Teaches the full toolset.

### Phase 2 — Topic levels (ages 7+, short sentences on cards)

**L4 "Gravity Pulls Down"** *(Forces & Gravity — teach)* — Medium span, light car, road material only. Stress glow formally introduced: "Red glow = too much force. Where does it glow? That's where gravity is winning." Failure hint points at the snap location.

**L5 "Heavier Is Harder"** *(Forces & Gravity — practice)* — Same canyon, but a truck; the L4 solution fails. Introduces the rock pillar as mid-span support and wood beams as cheap bracing. Card: "The truck weighs more than the car. What needs to change?"

**L6 "The Strongest Shape"** *(Triangles — teach)* — Wider span; a pre-built flat deck visibly sags. Card shows a square deforming vs a triangle holding. Fix is adding diagonal wood braces. Failure hint: "Try a slanted beam. What shape does it make?"

**L7 "Triangles Everywhere"** *(Triangles — practice)* — Wide span with a central pillar; child builds a real truss from scratch. Success card counts their triangles back to them.

**L8 "Balance the Load"** *(Weight & Balance)* — Asymmetric canyon (left wall lower than right), off-center pillar, heavy truck. Card: "The truck is heaviest where it sits longest. Build strongest there." The stress glow during test is the live teaching aid.

**L9 "Count Your Coins"** *(Budget & Counting)* — Comfortable span, tight budget. Costs front-and-center: road strong but expensive, wood cheap; big blocks cost more than small. Success card shows the arithmetic: "You spent 14 of 16 coins."

### Phase 3 — Challenge levels (game-design principles)

**L10 "The Long Crossing"** — Widest span yet with one mid pillar, moderate budget. Demands triangulation + support anchoring. Hints only after two failures.

**L11 "Heavy Hauler"** — The tank (heaviest preset) over a modest span with a firm budget. Pure strength-and-balance test; the slow crawl of the tank is the drama.

**L12 "Master Builder"** — Long asymmetric span, tight budget, heavy vehicle. Everything at once. Success card celebrates budget left over and invites a retry to beat it.

## Supporting Systems

### Level select menu (`scenes/MenuScene.js`)

- New scene registered in `main.js` before `LevelScene`.
- Grid of 12 level cards: number, title, phase color-coding (tutorial / topic / challenge). All cards tappable from the start.
- Tapping a card starts `LevelScene` with `scene.start('LevelScene', { levelId })`.
- LevelScene gets a "back to menu" button; on win, a success card with "Next Level" / "Menu" buttons.
- No persistence, no stars. Success card shows budget left over.
- `DEV_STRESS` excluded from the menu (visible only behind the dev flag).

### Tutorial card system (`systems/tutorial.js`)

- New singleton following the existing lifecycle contract: `attach(scene)`, `detach(scene)`, `reset()` — same as audio/juice/camera.
- Renders dismissable cards: big icon + at most one short sentence, large tap-anywhere-to-continue affordance for the 5–7 end.
- Three trigger points, all existing moments in LevelScene's flow:
  - **on level start** — intro card
  - **on fail** — hint card, gated by per-level failure count (e.g. show only after N failures)
  - **on win** — summary card
- The animated hand/arrow pointer (T1) is part of this system.
- Cards are data, not code: each level definition carries a `tutorial` block.

### Per-level UI simplification

- Each level definition gets a `ui` block read by LevelScene when building its HUD, e.g. `{ budgetMeter: false, materials: ['road'], sizes: ['L'], delete: false }`.
- Defaults to everything-on, so L4–L12 need little or no `ui` block; T1–T3 progressively switch elements on.
- Implemented as hide/show of existing UI at creation time — no new widgets.

### Level data (`data/leveldata.js`)

- Grows from `{ L1, DEV_STRESS }` to 12 levels plus an ordered `LEVEL_ORDER` array driving the menu.
- New optional schema fields:
  - `tutorial` — intro/hint/summary cards and hint gating
  - `ui` — visibility flags as above
  - `prebuilt` — joints + beams pre-placed at load (T1's near-built bridge, T3's wonky bridge, L6's sagging flat deck); loads through the same path `rebuildBridge()` already uses
- Asymmetric terrain (L8, L12) is already expressible: left/right `verts`/`physRect` are independent.

## Testing

Vitest coverage for:
- Level data validation — all 12 levels satisfy the schema; budget sanity (budget ≥ cost of a plausible minimal solution).
- `ui` flag defaults (omitted block = everything on).
- Tutorial trigger logic — fail-count gating.
- `prebuilt` loading produces correct `joints`/`beams` arrays.

## Risks

- **LevelScene growth** — it is already the largest file and absorbs menu transitions, tutorial hooks, and UI flags. Mitigation: tutorial and UI-flag logic live in `systems/tutorial.js` and level data; scene additions stay thin (read flags, call singleton).
- **Tuning effort** — each level's budget/span/weight must be playtested so the intended failure (T2, L5, L6) actually happens and the intended solution fits the budget. This is per-level feel-check work, not code risk.

## Out of Scope

- Unlock gating and progress persistence (all levels open).
- Star ratings.
- Cables, trusses, counterweights, convoys, hazards, wind.
- Sandbox editor changes.
- Difficulty bands.
