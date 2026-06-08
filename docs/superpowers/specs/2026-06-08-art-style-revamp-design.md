---
Date: 2026-06-08
Content Type: Design Spec
---

# Art Style Revamp — Design Spec

## 0. Summary

Re-skin the in-game editor chrome (top bar, sidebar, HUD, toolbar) to match
the reference image `f8ef6798-df1b-42eb-ac6c-cb947441141f.png` and the rules
in `STYLE_SPEC.md`. Phase 1 (this spec) covers UI chrome only and is
executed as a big-bang port on a single branch. Phase 2 (separate sub-project,
not in this spec) will replace procedural world graphics with pre-rendered
3D toy/claymation sprites.

Locked decisions:
- **Scope:** UI chrome first; world art is a follow-up sub-project.
- **Render layer:** HTML/CSS/SVG overlay above the Phaser canvas (per STYLE_SPEC §0).
- **Feature fidelity:** Re-skin existing features only. New tools (NODES, CABLE,
  HYDRAULIC, SPRING, REMOVE) and new top-bar actions (REDO, SAVE, LOAD,
  SETTINGS, HELP) appear as disabled placeholders to preserve the reference's
  visual silhouette.
- **Execution:** Big-bang port on a feature branch.

## 1. Architecture

### 1.1 DOM structure

`index.html` is restructured into a layered layout:

```html
<body>
  <div id="app">
    <div id="game"></div>                    <!-- Phaser canvas 1280×720 -->
    <div id="ui-root">                       <!-- absolute over canvas -->
      <header id="ui-topbar"></header>
      <aside  id="ui-sidebar"></aside>
      <div    id="ui-hud"></div>
      <nav    id="ui-toolbar"></nav>
      <div    id="ui-modals"></div>
    </div>
  </div>
</body>
```

`#ui-root` sets `pointer-events: none`; each chrome element re-enables
`pointer-events: auto`. Empty regions therefore pass clicks through to
the Phaser canvas underneath.

### 1.2 Coordinate system & scaling

Phaser stays at its logical 1280×720 canvas. `#app` is sized as a
1280×720 aspect-ratio box (Phaser scale mode `FIT`). The canvas and
`#ui-root` are sibling children of `#app`, both `width:100%; height:100%`,
so they scale together as the window resizes. Chrome elements are
positioned in canvas-pixel units; the browser scales them in lock-step
with the canvas.

### 1.3 File layout

```
src/ui-html/
  index.js              — mountUi(bus), teardown
  bus.js                — tiny EventEmitter
  components/
    TopBar.js
    Logo.js
    IconButton.js
    CtaButton.js
    BudgetChip.js
    Sidebar.js
    PanelCard.js
    VehicleCard.js
    PresetDropdown.js
    Hud.js
    Toolbar.js
    ToolTile.js
    Modal.js              (shell only; modals are out-of-scope content)
  icons/
    index.js              — inline-SVG factory: nodes(), road(), beam(), … coin(), bridgeLogo()
  styles/
    index.css             — imports the others in order
    tokens.css            — STYLE_SPEC §1 design tokens
    base.css              — font-face, reset, body
    components.css        — button, tile, card, chip recipes
```

### 1.4 Bridging LevelScene ↔ UI

A tiny in-memory event bus (`bus.js`) replaces every direct DOM mutation
inside the Phaser scene. `bus.js` exports a **module-level singleton**:
both UI components and the Phaser scene `import { bus } from './ui-html/bus.js'`.
No bus instance is passed through Phaser scene-data; the singleton is the
contract. The scene neither imports DOM modules nor knows about HTML; it
only emits and listens to bus events.

**UI → Scene events:**
`undo`, `clear`, `mode:toggle`, `vehicle:select`, `tool:select`,
`size:select`, `gravity:preset`.

**Scene → UI events:**
`mode:changed` (`'build'|'test'`), `budget:update` (number),
`hud:update` (`{spd,accel,drive,chassis,angvel,slope}`),
`tool:disabled` (key, e.g. for budget exhaustion),
`vehicle:active` (initial sync on mount).

### 1.5 Boot order

1. `mountUi()` (no-arg; imports the bus singleton) builds the DOM and
   wires listeners. `#ui-root` is interactive but empty of state.
2. `new Phaser.Game(config)` boots Phaser; `BootScene` → `LevelScene`.
3. `LevelScene.create()` imports the bus singleton, subscribes to bus
   events, and emits an initial sync burst: `vehicle:active`,
   `budget:update`, `mode:changed: 'build'`.

### 1.6 Iron-law check

Section 5's code surgery touches only the Phaser/UI seam in
`LevelScene.js` and `BlockPalette.js`. `physics.js` is untouched.
`scene.matter.*` calls remain confined to `physics.js`. No constraint
changes, no new physics behavior.

## 2. Design Tokens, Typography, and Button Recipe

### 2.1 Tokens (`styles/tokens.css`)

STYLE_SPEC §1 colors, radii, and shadows are pasted verbatim into
`:root`. One addition: an 8px-rhythm spacing scale (`--space-1`…`--space-6`
= `8/16/24/32/48/64`).

A new color token is added: `--red-dark: #C53A2D` for the bottom edge
of `.btn--red` (STYLE_SPEC §1 supplies `--red` but no companion dark
shade).

### 2.2 Typography (`styles/base.css`)

Fredoka loads from Google Fonts via stylesheet link in `index.html`:
`https://fonts.googleapis.com/css2?family=Fredoka:wght@400;500;600;700&display=swap`
(the `display=swap` query param sets `font-display: swap` on every face
in the served CSS). Add `<link rel="preconnect" href="https://fonts.googleapis.com">`
and `<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>`.
Body locks to:

```css
font-family: "Fredoka", "Baloo 2", "Nunito", system-ui, sans-serif;
color: var(--text);
font-variant-numeric: tabular-nums;
```

Two text utilities only: `.label` (uppercase, 600, `letter-spacing:.04em`)
and `.num` (700, tabular). All HUD text is `<span>` or `<div>` — no
document-outline semantics; hierarchy is purely visual.

### 2.3 Button recipe (`styles/components.css`)

STYLE_SPEC §3 verbatim. Every button is `<button class="btn btn--<variant>">`.

| variant | use | bottom-edge token |
| --- | --- | --- |
| `btn--white` | Undo, Redo, Save, Load, Settings, Help, tool tiles, zoom | `--border` |
| `btn--cta` | TEST, PLAY (small) | `--green-dark` |
| `btn--blue` | active tool tile | `--blue-dark` |
| `btn--red` | CLEAR, REMOVE | `--red-dark` |
| `btn--gold` | reserved (unused in this scope) | `--gold-dark` |

Every variant gets the `:hover { transform: translateY(-1px) }` and
`:active { transform: translateY(3px); box-shadow: 0 1px 0 <variant-dark>, … }`
treatment. The "press-down" feel is consistent across colors.

Panel headers (the blue title bar at the top of `PanelCard`) reuse the
`--blue` / `--blue-dark` token pair via a non-interactive class
`.panel-header`, not `.btn`. Same color, no press behavior.

### 2.4 Iconography

`icons/index.js` exports one function per icon — each returns an SVG
string (`<svg viewBox="0 0 24 24">…</svg>`) with `fill="currentColor"`
on the primary path and an explicit `fill="var(--…)"` on a secondary
path for two-tone (STYLE_SPEC §5). Color is set by the *button's*
CSS, so a `.btn--white` with an `.icon--red` inner span renders as
white tile + red icon automatically.

Icons authored: `nodes`, `road`, `beam`, `cable`, `hydraulic`, `spring`,
`remove`, `grid`, `snap`, `zoomIn`, `zoomOut`, `play`, `undo`, `redo`,
`clear`, `save`, `load`, `settings`, `help`, `coin`, `bridgeLogo`.

## 3. Component Inventory

| Component | Role | Replaces in code |
| --- | --- | --- |
| `TopBar` | Full-width container, button cluster, CTA, budget chip, settings cluster | `LevelScene.js:236-253` |
| `Logo` | "BRIDGE BUILDER" with orange-bridge SVG icon | new |
| `IconButton` | White-tile button: icon + tiny uppercase label | UNDO + CLEAR rectangles |
| `CtaButton` | Green hard-edge ▶ button. Sizes: large (TEST) and small (PLAY) | TEST rectangle |
| `BudgetChip` | White card: "BUDGET LEFT" label + big number + gold coin | budget label rectangle |
| `Sidebar` | Vertical stack: VEHICLES card + LOAD PRESET dropdown | horizontal vehicle row `LevelScene:201-232` |
| `PanelCard` | White rounded card + blue header bar | new |
| `VehicleCard` | Row inside VEHICLES: icon + uppercase label. Selected = blue border + glow | vehicle preset buttons |
| `PresetDropdown` | White pill, chevron, opens preset list | gravity label rectangle |
| `Hud` | Bottom-left white panel, two columns × three rows (SPD/ACCEL/DRIVE, CHASSIS/ANGVEL/SLOPE) | promote dev HUD `LevelScene:255-265` |
| `Toolbar` | Bottom: tool tiles + divider + utility tiles + small PLAY | replaces `BlockPalette.js` entirely |
| `ToolTile` | Single tile: icon + uppercase label. Active = blue fill + white icon + status dot | reused for every toolbar entry |
| `Modal` | Centered dialog shell with PanelCard styling | new (shell only; content out of scope) |

Existing-feature mapping under "re-skin only":
- **Active toolbar:** ROAD, BEAM, FREE.
- **Disabled toolbar placeholders:** NODES, CABLE, HYDRAULIC, SPRING, REMOVE.
- **Active top bar:** UNDO, CLEAR, TEST, BUDGET.
- **Disabled top-bar placeholders:** REDO, SAVE, LOAD, SETTINGS, HELP.
- **Sidebar:** VEHICLES (active), LOAD PRESET (active, routes to existing gravity preset code).
- **HUD:** SPD, ACCEL, DRIVE, CHASSIS, ANGVEL, SLOPE — promoted from
  dev-only to always-on in test mode; hidden in build mode. `D`-key
  override remains for hiding during recording.

## 4. Layout Geometry

Anchored to the 1280×720 canvas:

- **Top bar:** 64px tall, 12px from each edge, top:12px.
- **Sidebar:** 170px wide, floats over the left cliff. Top:90px, bottom
  ends above the toolbar. Build mode only.
- **HUD:** 260px wide, ~84px tall, bottom-left, sits above the toolbar
  with ~30px gap. Test mode only.
- **Toolbar:** 88px tall, 12px side margins, bottom:12px.
  - 74px tool tiles, 1px divider, 48px zoom tiles.
  - Small PLAY (hard-edge green) right-aligned.

CSS sizing uses px units so they scale uniformly with the canvas.

## 5. Region Behavior & Data Binding

### 5.1 TopBar
- **Undo** → emits `undo`. LevelScene runs existing `_undo()`. Disabled
  when `this.beams.length === 0` via `bus.emit('tool:disabled', 'undo')`.
- **Clear** → emits `clear`. LevelScene runs existing reset path.
- **TEST CTA** → emits `mode:toggle`. LevelScene flips build/test; bus
  emits `mode:changed`. UI swaps the CTA label between `TEST` and
  `RESET SIM`. Sidebar/HUD visibility toggles via CSS class on `#ui-root`.
- **BudgetChip** → listens to `budget:update`.

### 5.2 Sidebar
- **VehicleCard** click → emits `vehicle:select`. LevelScene calls its
  existing `_setActiveVehicle`. Selected card gets `data-selected`; CSS
  draws border + glow.
- **PresetDropdown** → emits `gravity:preset`. LevelScene calls the
  existing GUI gravity preset path.
- Visibility: build mode only.

### 5.3 Hud
- Subscribes to `hud:update`. LevelScene's existing `_updateDebugHud`
  body becomes `this.uiBus.emit('hud:update', {...})`.
- Six `data-key` spans receive direct `textContent` writes — no
  re-render, no GC churn at 60fps.
- Visibility: test mode only.

### 5.4 Toolbar
- **ToolTile** click → emits `tool:select` with key. Disabled tiles
  carry `aria-disabled="true"` and are no-ops.
- Active tile carries `data-active="true"` — CSS gives it `--blue`
  fill + white icon + small status dot.
- LevelScene handles `road`/`beam`/`free` by routing into the existing
  BlockPalette selection model. The underlying `_toolState =
  { material, size, freeform }` object lives on the scene now.
- **PLAY (small)** wires to the same `mode:toggle` event as TEST.
- **Size sub-row (S/M/L/XL):** appears as a floating row above the
  toolbar when a material is selected. Preserves the existing data
  model and budget cost preview.

### 5.5 Modals
Settings / Help tiles render `disabled`. `Modal.js` is built as a
shell only — no content in this scope.

## 6. Phaser-Side Cleanup

`index.html` gains the chrome scaffolding (§1.1), Google Fonts
preconnect, and a Fredoka stylesheet link. CSS is imported by
`main.js` via `import './ui-html/styles/index.css'`.

`src/main.js` adds one line: `mountUi()` before `new Phaser.Game(config)`.
Both `main.js` and `LevelScene.js` import the bus singleton from
`./ui-html/bus.js`; no bus is passed via scene-data.

`src/scenes/LevelScene.js` (1328 → ~1000 lines):
- **Delete:** lines ~200-265 — vehicle preset buttons, gravity label,
  undo/clear/test buttons, budget rectangle, debug-HUD background + text.
- **Delete:** `_drawVehicleIcons()` and every chrome
  `this.add.rectangle / this.add.text`.
- **Keep:** every `this.add.graphics()` for world rendering
  (`beamsGraphics`, `stressGraphics`, `jointsGraphics`,
  `vehicleGraphics`, `ghostGraphics`, `snapGraphics`, `_debrisGfx`).
- **Keep:** `failOverlay` and `winOverlay` (in-world result banners).
- **Modify:** each former UI mutation becomes a `bus.emit(...)` call
  (`budget:update`, `mode:changed`, `hud:update`).
- **Subscribe in `create()`** to: `undo`, `clear`, `mode:toggle`,
  `vehicle:select`, `tool:select`, `size:select`, `gravity:preset`.
- **`DEBUG_HUD` constant removed**; HUD always-on in test mode.
  `D` key still hides the HUD when held.

`src/scenes/BootScene.js` — out of scope; restyle in a follow-up.

`src/ui/BlockPalette.js` — **deleted entirely.** Its 326 lines become
~80 lines of `Toolbar.js` + the selection state model moved to
`LevelScene._toolState`.

`src/ui/GhostBeam.js` — **unchanged.** Draws in world coordinates and
reads camera transforms; belongs in Phaser.

`isOverPalette(pointer)` (currently in `BlockPalette`) becomes a DOM
check: `document.elementFromPoint(x, y)?.closest('#ui-toolbar') != null`.

## 7. Testing Strategy

- Existing Vitest physics tests stay green. Mocks of `LevelScene` UI
  internals are trimmed where fields were deleted.
- New UI tests are pure-DOM (jsdom, no Phaser). Each component module
  exports `mount(rootEl, bus)` and `destroy()`. Coverage:
  - `Toolbar`: active tile click emits `tool:select`; disabled tile is
    a no-op.
  - `VehicleCard`: click emits `vehicle:select`; `vehicle:active`
    updates `data-selected`.
  - `BudgetChip`: `budget:update` writes the number node.
  - `Hud`: `hud:update` writes all six values.
  - `PresetDropdown`: open/close + `gravity:preset` emission.
- One integration test mounts the full UI, fires bus events as if from
  LevelScene, asserts the DOM mutates correctly.
- No visual-regression infra. Manual check via dev server + the
  project's `run` skill before merging.

## 8. Risks & Mitigations

1. **Pointer-event leaks.** A missing `pointer-events: auto` either
   eats canvas clicks or leaks chrome clicks into Phaser. *Mitigation:*
   one explicit declaration per chrome region; CSS sanity assertions
   in the integration test; manual click-through pass before merge.
2. **Canvas / chrome misalignment under resize.** *Mitigation:* fix
   Phaser scale to `FIT` at 1280×720; size `#app` to that aspect-ratio
   box; canvas and `#ui-root` both `width:100%; height:100%`.
3. **Font flash on first load.** *Mitigation:* `font-display: swap`
   + system fallback stack.
4. **Lost UI behaviors during port.** *Mitigation:* Section 5's bus
   surface table is the implementation checklist; map each existing UI
   method to its new bus event in the implementation plan.
5. **`BlockPalette` removal leaves dangling references.** *Mitigation:*
   `_toolState` on the scene preserves the selection shape;
   `isOverPalette` becomes the DOM check above.

## 9. Out of Scope

- **Phase 2 world art.** Sky gradient, cliff sprites, vehicle PNGs,
  clouds, water, trees, flag. World still renders with current Phaser
  graphics. Tracked as a separate sub-project.
- Functional implementation of NODES, REDO, SAVE, LOAD, SETTINGS, HELP,
  CABLE, HYDRAULIC, SPRING, REMOVE. They render as disabled
  placeholders.
- `BootScene` restyle.
- Mobile / touch refinements.
- Deep accessibility pass. `aria-label` on icon buttons and
  `aria-disabled` on stubs are in scope; full keyboard nav is a
  follow-up.

## 10. Success Criteria

- Dev server boots, chrome renders, all active tools and buttons drive
  the same physics behavior they did pre-port.
- Existing Vitest physics suite stays green.
- New UI tests pass (Toolbar, VehicleCard, BudgetChip, Hud,
  PresetDropdown, integration).
- Side-by-side comparison against the reference image is "close":
  same color palette, same hard-edge buttons, same panel layout,
  same uppercase rounded typography, same six-row HUD.
- `physics.js` diff is empty.
