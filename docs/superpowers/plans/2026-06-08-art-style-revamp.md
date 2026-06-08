---
Date: 2026-06-08
Content Type: Implementation Plan
---

# Art Style Revamp — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Re-skin the in-game editor chrome (top bar, sidebar, HUD, toolbar) as an HTML/CSS overlay above the Phaser canvas, matching `STYLE_SPEC.md` and the reference image `f8ef6798-df1b-42eb-ac6c-cb947441141f.png`.

**Architecture:** New `src/ui-html/` module owns all chrome. Phaser `LevelScene` is decoupled via a module-level event-bus singleton (`bus.js`). Chrome lives in `#ui-root`, a DOM sibling of the canvas inside an aspect-locked `#app` container that scales both together. `physics.js` is not touched.

**Tech Stack:** Vite + Phaser 3.90 (existing); plain DOM + CSS (new); Fredoka via Google Fonts; Vitest + jsdom (existing).

**Reference spec:** `docs/superpowers/specs/2026-06-08-art-style-revamp-design.md`

---

## File Map

**Create:**
- `src/ui-html/bus.js`
- `src/ui-html/index.js`
- `src/ui-html/icons/index.js`
- `src/ui-html/components/IconButton.js`
- `src/ui-html/components/CtaButton.js`
- `src/ui-html/components/BudgetChip.js`
- `src/ui-html/components/Logo.js`
- `src/ui-html/components/TopBar.js`
- `src/ui-html/components/PanelCard.js`
- `src/ui-html/components/VehicleCard.js`
- `src/ui-html/components/PresetDropdown.js`
- `src/ui-html/components/Sidebar.js`
- `src/ui-html/components/Hud.js`
- `src/ui-html/components/ToolTile.js`
- `src/ui-html/components/Toolbar.js`
- `src/ui-html/styles/index.css`
- `src/ui-html/styles/tokens.css`
- `src/ui-html/styles/base.css`
- `src/ui-html/styles/components.css`
- `tests/ui-html/bus.test.js`
- `tests/ui-html/icons.test.js`
- `tests/ui-html/IconButton.test.js`
- `tests/ui-html/BudgetChip.test.js`
- `tests/ui-html/Hud.test.js`
- `tests/ui-html/VehicleCard.test.js`
- `tests/ui-html/PresetDropdown.test.js`
- `tests/ui-html/Toolbar.test.js`
- `tests/ui-html/integration.test.js`

**Modify:**
- `index.html` — scaffolding + font preconnect
- `src/main.js` — import CSS + call `mountUi()`
- `src/scenes/LevelScene.js` — delete chrome (lines ~200-267), rewire to bus

**Delete:**
- `src/ui/BlockPalette.js`

---

## Task 0: Create feature branch

**Files:** none

- [ ] **Step 1: Branch**

```bash
git switch -c art-style-revamp
```

Expected: `Switched to a new branch 'art-style-revamp'`

- [ ] **Step 2: Verify**

```bash
git status
```

Expected: `On branch art-style-revamp` and clean tree (only `package-lock.json` unstaged, same as before).

---

## Task 1: Directory scaffold + CSS entry import

**Files:**
- Create: `src/ui-html/styles/index.css` (empty stub)
- Modify: `src/main.js:1`

- [ ] **Step 1: Create the empty CSS entry**

`src/ui-html/styles/index.css`:
```css
/* Imports populated in later tasks. */
```

- [ ] **Step 2: Import CSS in main.js**

Edit `src/main.js`, insert as the first import line:
```js
import './ui-html/styles/index.css';
```

- [ ] **Step 3: Verify Vite still boots dev server**

```bash
npm run dev
```

Expected: Server listens on `http://localhost:5173`. Kill it (`Ctrl+C`) after confirming.

- [ ] **Step 4: Verify tests still pass**

```bash
npm test
```

Expected: existing physics/snap tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/ui-html/styles/index.css src/main.js
git commit -m "chore(ui-html): scaffold styles entry + main.js import"
```

---

## Task 2: Event bus singleton (TDD)

**Files:**
- Create: `src/ui-html/bus.js`
- Test:   `tests/ui-html/bus.test.js`

- [ ] **Step 1: Write the failing tests**

`tests/ui-html/bus.test.js`:
```js
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { bus } from '../../src/ui-html/bus.js';

describe('bus', () => {
  beforeEach(() => bus._reset());

  it('delivers an emitted event to a subscribed listener', () => {
    const spy = vi.fn();
    bus.on('hello', spy);
    bus.emit('hello', 42);
    expect(spy).toHaveBeenCalledWith(42);
  });

  it('supports multiple listeners on the same event', () => {
    const a = vi.fn();
    const b = vi.fn();
    bus.on('x', a);
    bus.on('x', b);
    bus.emit('x', 'hi');
    expect(a).toHaveBeenCalledWith('hi');
    expect(b).toHaveBeenCalledWith('hi');
  });

  it('off() removes a single listener', () => {
    const spy = vi.fn();
    bus.on('x', spy);
    bus.off('x', spy);
    bus.emit('x');
    expect(spy).not.toHaveBeenCalled();
  });

  it('does not throw when emitting an event with no listeners', () => {
    expect(() => bus.emit('nobody')).not.toThrow();
  });

  it('is a shared singleton across imports', async () => {
    const { bus: again } = await import('../../src/ui-html/bus.js');
    expect(again).toBe(bus);
  });
});
```

- [ ] **Step 2: Run, expect fail**

```bash
npx vitest run tests/ui-html/bus.test.js
```

Expected: import error — `bus.js` does not exist.

- [ ] **Step 3: Implement bus**

`src/ui-html/bus.js`:
```js
// Module-level singleton event bus shared by the HTML UI and the Phaser scene.
const listeners = new Map();

function on(event, fn) {
  if (!listeners.has(event)) listeners.set(event, new Set());
  listeners.get(event).add(fn);
}

function off(event, fn) {
  listeners.get(event)?.delete(fn);
}

function emit(event, payload) {
  const set = listeners.get(event);
  if (!set) return;
  for (const fn of [...set]) fn(payload);
}

function _reset() {
  listeners.clear();
}

export const bus = { on, off, emit, _reset };
```

- [ ] **Step 4: Run, expect pass**

```bash
npx vitest run tests/ui-html/bus.test.js
```

Expected: 5 passing.

- [ ] **Step 5: Commit**

```bash
git add src/ui-html/bus.js tests/ui-html/bus.test.js
git commit -m "feat(ui-html): event bus singleton + tests"
```

---

## Task 3: index.html scaffold + tokens, base, components CSS

**Files:**
- Modify: `index.html`
- Create: `src/ui-html/styles/tokens.css`
- Create: `src/ui-html/styles/base.css`
- Create: `src/ui-html/styles/components.css`
- Modify: `src/ui-html/styles/index.css`

- [ ] **Step 1: Rewrite index.html scaffold**

`index.html`:
```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>Bridge Builder</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fredoka:wght@400;500;600;700&display=swap">
  </head>
  <body>
    <div id="app">
      <div id="game"></div>
      <div id="ui-root">
        <header id="ui-topbar"></header>
        <aside  id="ui-sidebar"></aside>
        <div    id="ui-hud"></div>
        <nav    id="ui-toolbar"></nav>
        <div    id="ui-modals"></div>
      </div>
    </div>
    <script type="module" src="/src/main.js"></script>
  </body>
</html>
```

- [ ] **Step 2: Write tokens.css**

`src/ui-html/styles/tokens.css`:
```css
:root {
  /* Brand / accent */
  --blue:        #2D9CDB;
  --blue-dark:   #1B7AB8;
  --green:       #5AB942;
  --green-dark:  #42962E;
  --grass:       #86C440;
  --gold:        #F5B423;
  --gold-dark:   #E09A10;
  --orange:      #F7941E;
  --red:         #EB4D3D;
  --red-dark:    #C53A2D;     /* added for .btn--red bottom edge */
  --purple:      #8E5BD9;

  /* Neutrals */
  --panel:       #FFFFFF;
  --panel-tint:  #F2F5F8;
  --border:      #E1E8EE;
  --text:        #37474F;
  --text-soft:   #7A8C99;
  --text-invert: #FFFFFF;

  /* Sky (world backdrop) */
  --sky-top:     #5DBFF0;
  --sky-bottom:  #BDE7FB;

  /* Radii */
  --r-sm:   10px;
  --r-md:   14px;
  --r-lg:   18px;
  --r-pill: 999px;

  /* Shadows */
  --shadow-card:  0 4px 12px rgba(40,60,80,0.12);
  --shadow-float: 0 6px 18px rgba(40,60,80,0.16);

  /* Spacing (8px rhythm) */
  --space-1:  8px;
  --space-2: 16px;
  --space-3: 24px;
  --space-4: 32px;
  --space-5: 48px;
  --space-6: 64px;
  --gap:      8px;
}
```

- [ ] **Step 3: Write base.css**

`src/ui-html/styles/base.css`:
```css
html, body { margin: 0; padding: 0; height: 100%; background: #000; }
body {
  font-family: "Fredoka", "Baloo 2", "Nunito", system-ui, sans-serif;
  color: var(--text);
  font-variant-numeric: tabular-nums;
  -webkit-font-smoothing: antialiased;
}

/* Aspect-ratio box: canvas + UI scale together. */
#app {
  position: relative;
  width: 100vw;
  height: 100vh;
  display: grid;
  place-items: center;
  background: #000;
}
#game, #ui-root {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}
#game canvas { display: block; width: 100%; height: 100%; }

/* Chrome layer: pass-through by default; each region opts back in. */
#ui-root { pointer-events: none; }
#ui-topbar, #ui-sidebar, #ui-hud, #ui-toolbar, #ui-modals {
  position: absolute;
  pointer-events: auto;
}

/* Mode-driven visibility — toggled via class on #ui-root. */
#ui-root.mode-test  #ui-sidebar { display: none; }
#ui-root.mode-build #ui-hud     { display: none; }

/* Utilities */
.label {
  text-transform: uppercase;
  font-weight: 600;
  letter-spacing: 0.04em;
}
.num { font-weight: 700; font-variant-numeric: tabular-nums; }
```

- [ ] **Step 4: Write components.css**

`src/ui-html/styles/components.css`:
```css
/* Buttons — STYLE_SPEC §3 hard-edge press-down. */
.btn {
  border: none;
  border-radius: var(--r-md);
  padding: 10px 16px;
  font: 700 15px/1 "Fredoka", "Baloo 2", "Nunito", system-ui, sans-serif;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  transition: transform .08s ease, box-shadow .08s ease;
  color: var(--text);
}
.btn:disabled, .btn[aria-disabled="true"] {
  opacity: .45;
  cursor: not-allowed;
}

.btn--white { background: var(--panel); box-shadow: 0 3px 0 var(--border), var(--shadow-card); }
.btn--white:active:not(:disabled):not([aria-disabled="true"]) {
  transform: translateY(3px); box-shadow: 0 1px 0 var(--border), var(--shadow-card);
}
.btn--white:hover:not(:disabled):not([aria-disabled="true"]) { transform: translateY(-1px); }

.btn--cta { background: var(--green); color: var(--text-invert); box-shadow: 0 5px 0 var(--green-dark), var(--shadow-float); padding: 14px 28px; font-size: 20px; }
.btn--cta:active { transform: translateY(3px); box-shadow: 0 1px 0 var(--green-dark), var(--shadow-card); }
.btn--cta:hover  { transform: translateY(-1px); }

.btn--blue { background: var(--blue); color: var(--text-invert); box-shadow: 0 5px 0 var(--blue-dark), var(--shadow-float); }
.btn--blue:active { transform: translateY(3px); box-shadow: 0 1px 0 var(--blue-dark), var(--shadow-card); }
.btn--blue:hover  { transform: translateY(-1px); }

.btn--red { background: var(--red); color: var(--text-invert); box-shadow: 0 4px 0 var(--red-dark), var(--shadow-card); }
.btn--red:active { transform: translateY(3px); box-shadow: 0 1px 0 var(--red-dark), var(--shadow-card); }
.btn--red:hover  { transform: translateY(-1px); }

.btn--gold { background: var(--gold); color: var(--text); box-shadow: 0 4px 0 var(--gold-dark), var(--shadow-card); }
.btn--gold:active { transform: translateY(3px); box-shadow: 0 1px 0 var(--gold-dark), var(--shadow-card); }
.btn--gold:hover  { transform: translateY(-1px); }

/* Panel card — white card with optional blue header bar. */
.panel-card { background: var(--panel); border-radius: var(--r-lg); box-shadow: var(--shadow-card); overflow: hidden; }
.panel-card > .panel-header { background: var(--blue); color: var(--text-invert); padding: 8px 12px; font-weight: 700; font-size: 12px; text-transform: uppercase; letter-spacing: 0.06em; }
.panel-card > .panel-body { padding: 6px; display: flex; flex-direction: column; gap: 4px; }

/* Icon button (icon-stacked: icon top, tiny label below). */
.icon-btn { width: 56px; height: 64px; flex-direction: column; gap: 4px; padding: 8px; font-size: 9px; }
.icon-btn .icon { width: 24px; height: 24px; display: block; }
.icon-btn .label { font-size: 9px; }

/* Tool tile (toolbar). */
.tool-tile { width: 74px; height: 64px; flex-direction: column; gap: 4px; padding: 8px; font-size: 9px; position: relative; }
.tool-tile .icon { width: 26px; height: 22px; display: block; }
.tool-tile.zoom { width: 48px; }
.tool-tile[data-active="true"] { background: var(--blue); color: var(--text-invert); box-shadow: 0 5px 0 var(--blue-dark), var(--shadow-float); }
.tool-tile[data-active="true"] .icon { color: var(--text-invert); }
.tool-tile[data-active="true"]::after {
  content: ""; position: absolute; top: 6px; right: 8px;
  width: 6px; height: 6px; border-radius: 50%; background: var(--text-invert);
  box-shadow: 0 0 0 2px var(--blue-dark);
}

/* Budget chip. */
.budget-chip { width: 200px; height: 64px; padding: 8px 14px; display: flex; align-items: center; justify-content: space-between; background: var(--panel); border-radius: var(--r-md); box-shadow: 0 3px 0 var(--border), var(--shadow-card); }
.budget-chip .budget-text { display: flex; flex-direction: column; line-height: 1; }
.budget-chip .budget-text small { font-size: 9px; color: var(--text-soft); letter-spacing: 0.08em; text-transform: uppercase; }
.budget-chip .budget-num { font-size: 28px; font-weight: 700; line-height: 1; }
.budget-chip .coin { width: 30px; height: 30px; flex: 0 0 auto; }

/* Vehicle card row. */
.vehicle-row { display: flex; align-items: center; gap: 8px; padding: 8px 10px; cursor: pointer; border-radius: var(--r-md); }
.vehicle-row[data-selected="true"] { outline: 2px solid var(--blue); outline-offset: -2px; box-shadow: inset 0 0 0 4px rgba(45,156,219,.08); }
.vehicle-row .icon { width: 36px; height: 24px; }
.vehicle-row .label { font-size: 12px; }

/* Preset dropdown pill. */
.preset-pill { padding: 10px 12px; display: flex; align-items: center; justify-content: space-between; background: var(--panel); border-radius: var(--r-pill); box-shadow: 0 3px 0 var(--border), var(--shadow-card); cursor: pointer; user-select: none; }
.preset-pill small { font-size: 8px; color: var(--text-soft); text-transform: uppercase; letter-spacing: 0.08em; display: block; line-height: 1; }
.preset-pill strong { font-size: 12px; text-transform: uppercase; letter-spacing: 0.04em; }
.preset-pill .chev { color: var(--blue); font-weight: 900; }
.preset-pill .menu { position: absolute; top: calc(100% + 4px); left: 0; right: 0; background: var(--panel); border-radius: var(--r-md); box-shadow: var(--shadow-float); padding: 4px; z-index: 10; }
.preset-pill .menu .opt { padding: 8px 10px; font-size: 12px; text-transform: uppercase; cursor: pointer; border-radius: var(--r-sm); }
.preset-pill .menu .opt:hover { background: var(--panel-tint); }

/* HUD panel. */
.hud-panel { padding: 10px 12px; background: var(--panel); border-radius: var(--r-lg); box-shadow: var(--shadow-card); }
.hud-panel .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 14px; }
.hud-row { display: flex; align-items: center; gap: 6px; font-size: 11px; }
.hud-row .dot { width: 8px; height: 8px; border-radius: 50%; flex: 0 0 auto; }
.hud-row .label { color: var(--text-soft); }
.hud-row .num { margin-left: auto; }

/* Top bar / sidebar / toolbar layout containers. */
#ui-topbar  { left: 12px; right: 12px; top: 12px; height: 64px; display: flex; align-items: center; gap: 8px; }
#ui-sidebar { left: 12px; top: 90px; width: 170px; display: flex; flex-direction: column; gap: 8px; }
#ui-hud     { left: 12px; bottom: 118px; width: 260px; }
#ui-toolbar { left: 12px; right: 12px; bottom: 12px; height: 88px; padding: 10px 12px; display: flex; align-items: center; gap: 6px; background: var(--panel); border-radius: var(--r-lg); box-shadow: var(--shadow-card); }
#ui-toolbar .divider { width: 1px; height: 48px; background: var(--border); margin: 0 6px; flex: 0 0 auto; }
#ui-toolbar .play-small { margin-left: auto; }

/* Logo. */
.logo { width: 200px; height: 64px; padding: 0 14px; display: flex; align-items: center; gap: 10px; background: var(--panel); border-radius: var(--r-md); box-shadow: 0 3px 0 var(--border), var(--shadow-card); }
.logo .logo-icon { width: 42px; height: 42px; border-radius: 10px; background: var(--orange); display: grid; place-items: center; color: #fff; }
.logo .logo-text { line-height: 1.05; }
.logo .logo-text strong { font-size: 14px; color: var(--blue); display: block; }
.logo .logo-text small  { font-size: 9px; color: var(--text-soft); letter-spacing: 0.08em; }

/* Icon coloring helpers. */
.icon { color: var(--blue); }                  /* default accent */
.icon--red    { color: var(--red); }
.icon--orange { color: var(--orange); }
.icon--gray   { color: var(--text-soft); }
.icon--purple { color: var(--purple); }
.icon--white  { color: var(--text-invert); }

.preset-pill { position: relative; }
```

- [ ] **Step 5: Wire styles/index.css**

`src/ui-html/styles/index.css`:
```css
@import './tokens.css';
@import './base.css';
@import './components.css';
```

- [ ] **Step 6: Verify dev server renders without errors**

```bash
npm run dev
```

Expected: server boots, browser at `http://localhost:5173` shows a black box (Phaser canvas) — chrome regions are empty divs and invisible. No console errors. Kill server.

- [ ] **Step 7: Verify tests still pass**

```bash
npm test
```

Expected: existing tests pass; no new tests yet.

- [ ] **Step 8: Commit**

```bash
git add index.html src/ui-html/styles
git commit -m "feat(ui-html): index.html scaffold + tokens, base, components CSS"
```

---

## Task 4: Icons module (TDD)

**Files:**
- Create: `src/ui-html/icons/index.js`
- Test:   `tests/ui-html/icons.test.js`

- [ ] **Step 1: Write failing test**

`tests/ui-html/icons.test.js`:
```js
import { describe, it, expect } from 'vitest';
import * as icons from '../../src/ui-html/icons/index.js';

const REQUIRED = [
  'nodes', 'road', 'beam', 'cable', 'hydraulic', 'spring', 'remove',
  'grid', 'snap', 'zoomIn', 'zoomOut', 'play',
  'undo', 'redo', 'clear', 'save', 'load', 'settings', 'help',
  'coin', 'bridgeLogo',
];

describe('icons module', () => {
  it.each(REQUIRED)('exports %s as a function returning SVG markup', (name) => {
    const fn = icons[name];
    expect(typeof fn).toBe('function');
    const svg = fn();
    expect(svg).toMatch(/^<svg /);
    expect(svg).toContain('</svg>');
  });
});
```

- [ ] **Step 2: Run, expect fail**

```bash
npx vitest run tests/ui-html/icons.test.js
```

Expected: cannot import; or `typeof fn !== 'function'`.

- [ ] **Step 3: Implement icons**

`src/ui-html/icons/index.js`:
```js
// Inline-SVG icon factory. Each function returns a string. Color is driven by
// the parent element via `currentColor` — set color via .icon / .icon--<accent>
// classes (see components.css).
const svg = (body, viewBox = '0 0 24 24') =>
  `<svg class="icon" viewBox="${viewBox}" fill="currentColor" xmlns="http://www.w3.org/2000/svg">${body}</svg>`;

export const nodes = () => svg(`
  <circle cx="6" cy="6" r="3"/>
  <circle cx="18" cy="6" r="3"/>
  <circle cx="6" cy="18" r="3"/>
  <circle cx="18" cy="18" r="3"/>
`);

export const road = () => svg(`
  <rect x="2" y="9" width="20" height="6" rx="1" fill="#555566"/>
  <rect x="2" y="9" width="20" height="2.5" fill="#ccccdd"/>
  <rect x="5"  y="11.5" width="3" height="1.2" fill="#fff"/>
  <rect x="11" y="11.5" width="3" height="1.2" fill="#fff"/>
  <rect x="17" y="11.5" width="3" height="1.2" fill="#fff"/>
`);

export const beam = () => svg(`
  <rect x="2" y="11" width="20" height="3" rx="1" transform="rotate(-15 12 12)"/>
  <circle cx="4" cy="16" r="2.2"/>
  <circle cx="20" cy="8" r="2.2"/>
`);

export const cable = () => svg(`
  <path d="M4 4 C 8 18, 16 18, 20 4" stroke="currentColor" stroke-width="2.5" fill="none"/>
`);

export const hydraulic = () => svg(`
  <rect x="9" y="3" width="6" height="14" rx="1"/>
  <rect x="6" y="17" width="12" height="4" rx="1"/>
`);

export const spring = () => svg(`
  <path d="M5 4 H19 M5 8 H19 M5 12 H19 M5 16 H19 M5 20 H19"
    stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/>
`);

export const remove = () => svg(`
  <rect x="4" y="9" width="16" height="9" rx="1"/>
  <rect x="4" y="6" width="16" height="3" rx="1"/>
`);

export const grid = () => svg(`
  <rect x="3" y="3" width="7" height="7" rx="1"/>
  <rect x="14" y="3" width="7" height="7" rx="1"/>
  <rect x="3" y="14" width="7" height="7" rx="1"/>
  <rect x="14" y="14" width="7" height="7" rx="1"/>
`);

export const snap = () => svg(`
  <path d="M4 12 L11 19 L20 5" stroke="currentColor" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
`);

export const zoomIn = () => svg(`
  <circle cx="11" cy="11" r="6" stroke="currentColor" stroke-width="2.5" fill="none"/>
  <rect x="8" y="10" width="6" height="2" rx="1"/>
  <rect x="10" y="8" width="2" height="6" rx="1"/>
  <rect x="15" y="15" width="6" height="2.5" rx="1" transform="rotate(45 15 15)"/>
`);

export const zoomOut = () => svg(`
  <circle cx="11" cy="11" r="6" stroke="currentColor" stroke-width="2.5" fill="none"/>
  <rect x="8" y="10" width="6" height="2" rx="1"/>
  <rect x="15" y="15" width="6" height="2.5" rx="1" transform="rotate(45 15 15)"/>
`);

export const play = () => svg(`
  <path d="M7 4 L20 12 L7 20 Z"/>
`);

export const undo = () => svg(`
  <path d="M5 10 L11 4 V8 H16 a4 4 0 0 1 0 8 H10" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
`);

export const redo = () => svg(`
  <path d="M19 10 L13 4 V8 H8 a4 4 0 0 0 0 8 H14" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
`);

export const clear = () => svg(`
  <rect x="6" y="3" width="12" height="3" rx="1"/>
  <path d="M5 7 L7 21 H17 L19 7 Z" stroke="currentColor" stroke-width="2" fill="none" stroke-linejoin="round"/>
  <path d="M10 10 V18 M14 10 V18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
`);

export const save = () => svg(`
  <path d="M5 3 H17 L21 7 V21 H3 V3 Z M7 3 V9 H15 V3 M7 13 H17 V19 H7 Z"
    stroke="currentColor" stroke-width="2" fill="none" stroke-linejoin="round"/>
`);

export const load = () => svg(`
  <path d="M3 7 H10 L12 5 H21 V19 H3 Z" stroke="currentColor" stroke-width="2" fill="none" stroke-linejoin="round"/>
`);

export const settings = () => svg(`
  <circle cx="12" cy="12" r="3.2" stroke="currentColor" stroke-width="2.5" fill="none"/>
  <path d="M12 2 V5 M12 19 V22 M2 12 H5 M19 12 H22 M5 5 L7 7 M17 17 L19 19 M5 19 L7 17 M17 7 L19 5"
    stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
`);

export const help = () => svg(`
  <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2.5" fill="none"/>
  <path d="M9 9 a3 3 0 0 1 6 0 c0 2 -3 2 -3 4" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round"/>
  <circle cx="12" cy="17" r="1.3"/>
`);

export const coin = () => svg(`
  <circle cx="12" cy="12" r="10" fill="var(--gold)" stroke="var(--gold-dark)" stroke-width="3"/>
  <path d="M12 7 L13.5 10.5 L17 11 L14.5 13.5 L15 17 L12 15.3 L9 17 L9.5 13.5 L7 11 L10.5 10.5 Z" fill="#fff"/>
`);

export const bridgeLogo = () => svg(`
  <rect x="2" y="13" width="20" height="2.5" rx="1" fill="var(--orange)"/>
  <path d="M4 13 L7 7 L17 7 L20 13" stroke="var(--orange)" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
  <rect x="3" y="15" width="2" height="6" fill="var(--orange)"/>
  <rect x="19" y="15" width="2" height="6" fill="var(--orange)"/>
`, '0 0 24 24');
```

- [ ] **Step 4: Run, expect pass**

```bash
npx vitest run tests/ui-html/icons.test.js
```

Expected: all 21 cases pass.

- [ ] **Step 5: Commit**

```bash
git add src/ui-html/icons tests/ui-html/icons.test.js
git commit -m "feat(ui-html): inline-SVG icon factory + tests"
```

---

## Task 5: IconButton, CtaButton, BudgetChip, Logo components (TDD)

**Files:**
- Create: `src/ui-html/components/IconButton.js`
- Create: `src/ui-html/components/CtaButton.js`
- Create: `src/ui-html/components/BudgetChip.js`
- Create: `src/ui-html/components/Logo.js`
- Test:   `tests/ui-html/IconButton.test.js`
- Test:   `tests/ui-html/BudgetChip.test.js`

- [ ] **Step 1: Write failing tests**

`tests/ui-html/IconButton.test.js`:
```js
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { IconButton } from '../../src/ui-html/components/IconButton.js';

describe('IconButton', () => {
  let host;
  beforeEach(() => { host = document.createElement('div'); document.body.appendChild(host); });

  it('renders a button with label and svg icon', () => {
    const btn = IconButton({ icon: '<svg class="icon"></svg>', label: 'undo' });
    host.appendChild(btn);
    expect(btn.tagName).toBe('BUTTON');
    expect(btn.querySelector('svg.icon')).not.toBeNull();
    expect(btn.textContent.toUpperCase()).toContain('UNDO');
  });

  it('fires onClick when clicked', () => {
    const spy = vi.fn();
    const btn = IconButton({ icon: '<svg></svg>', label: 'x', onClick: spy });
    host.appendChild(btn);
    btn.click();
    expect(spy).toHaveBeenCalledOnce();
  });

  it('does not fire onClick when disabled', () => {
    const spy = vi.fn();
    const btn = IconButton({ icon: '<svg></svg>', label: 'x', onClick: spy, disabled: true });
    host.appendChild(btn);
    btn.click();
    expect(spy).not.toHaveBeenCalled();
    expect(btn.getAttribute('aria-disabled')).toBe('true');
  });

  it('applies icon accent class when accent is provided', () => {
    const btn = IconButton({ icon: '<svg class="icon"></svg>', label: 'clear', accent: 'red' });
    expect(btn.querySelector('.icon').classList.contains('icon--red')).toBe(true);
  });
});
```

`tests/ui-html/BudgetChip.test.js`:
```js
import { describe, it, expect, beforeEach } from 'vitest';
import { bus } from '../../src/ui-html/bus.js';
import { BudgetChip } from '../../src/ui-html/components/BudgetChip.js';

describe('BudgetChip', () => {
  beforeEach(() => bus._reset());

  it('renders 0 by default', () => {
    const chip = BudgetChip();
    expect(chip.querySelector('.budget-num').textContent).toBe('0');
  });

  it('updates the number node when bus emits budget:update', () => {
    const chip = BudgetChip();
    bus.emit('budget:update', 250);
    expect(chip.querySelector('.budget-num').textContent).toBe('250');
  });

  it('shows the BUDGET LEFT label', () => {
    const chip = BudgetChip();
    expect(chip.textContent).toContain('BUDGET LEFT');
  });
});
```

- [ ] **Step 2: Run, expect fail**

```bash
npx vitest run tests/ui-html/IconButton.test.js tests/ui-html/BudgetChip.test.js
```

Expected: module-not-found errors.

- [ ] **Step 3: Implement IconButton**

`src/ui-html/components/IconButton.js`:
```js
// Renders a stacked icon-over-label white button. Returns the <button> element.
// opts: { icon: svgString, label: string, onClick?: fn, disabled?: bool, accent?: 'red'|'orange'|'gray'|'purple' }
export function IconButton({ icon, label, onClick, disabled = false, accent }) {
  const btn = document.createElement('button');
  btn.className = 'btn btn--white icon-btn';
  btn.type = 'button';
  if (disabled) btn.setAttribute('aria-disabled', 'true');
  btn.setAttribute('aria-label', label);

  // Render icon HTML then optionally add accent class.
  const wrap = document.createElement('span');
  wrap.innerHTML = icon;
  const svgEl = wrap.querySelector('svg');
  if (svgEl && accent) svgEl.classList.add(`icon--${accent}`);
  if (svgEl) btn.appendChild(svgEl);

  const lbl = document.createElement('span');
  lbl.className = 'label';
  lbl.textContent = label.toUpperCase();
  btn.appendChild(lbl);

  if (onClick) {
    btn.addEventListener('click', (e) => {
      if (btn.getAttribute('aria-disabled') === 'true') return;
      onClick(e);
    });
  }
  return btn;
}
```

- [ ] **Step 4: Implement CtaButton**

`src/ui-html/components/CtaButton.js`:
```js
import { play } from '../icons/index.js';

// opts: { label: string, size?: 'large'|'small', onClick?: fn }
export function CtaButton({ label, size = 'large', onClick }) {
  const btn = document.createElement('button');
  btn.className = 'btn btn--cta' + (size === 'small' ? ' play-small' : '');
  btn.type = 'button';
  if (size === 'small') btn.style.padding = '0 22px';

  const iconSpan = document.createElement('span');
  iconSpan.innerHTML = play();
  const svgEl = iconSpan.querySelector('svg');
  if (svgEl) {
    svgEl.classList.add('icon--white');
    svgEl.style.width = '18px';
    svgEl.style.height = '18px';
    btn.appendChild(svgEl);
  }

  const lbl = document.createElement('span');
  lbl.textContent = label.toUpperCase();
  btn.appendChild(lbl);

  btn.setLabel = (text) => { lbl.textContent = text.toUpperCase(); };
  if (onClick) btn.addEventListener('click', onClick);
  return btn;
}
```

- [ ] **Step 5: Implement BudgetChip**

`src/ui-html/components/BudgetChip.js`:
```js
import { bus } from '../bus.js';
import { coin } from '../icons/index.js';

export function BudgetChip() {
  const root = document.createElement('div');
  root.className = 'budget-chip';

  const text = document.createElement('div');
  text.className = 'budget-text';
  const small = document.createElement('small');
  small.textContent = 'BUDGET LEFT';
  const num = document.createElement('div');
  num.className = 'budget-num';
  num.textContent = '0';
  text.append(small, num);

  const coinWrap = document.createElement('div');
  coinWrap.innerHTML = coin();
  const coinSvg = coinWrap.querySelector('svg');
  if (coinSvg) coinSvg.classList.add('coin');

  root.append(text, coinSvg ?? coinWrap);

  bus.on('budget:update', (n) => { num.textContent = String(n); });
  return root;
}
```

- [ ] **Step 6: Implement Logo**

`src/ui-html/components/Logo.js`:
```js
import { bridgeLogo } from '../icons/index.js';

export function Logo() {
  const root = document.createElement('div');
  root.className = 'logo';

  const iconWrap = document.createElement('div');
  iconWrap.className = 'logo-icon';
  iconWrap.innerHTML = bridgeLogo();

  const text = document.createElement('div');
  text.className = 'logo-text';
  text.innerHTML = `<strong>BRIDGE BUILDER</strong><small>EDITOR</small>`;

  root.append(iconWrap, text);
  return root;
}
```

- [ ] **Step 7: Run, expect pass**

```bash
npx vitest run tests/ui-html/IconButton.test.js tests/ui-html/BudgetChip.test.js
```

Expected: 7 passing total.

- [ ] **Step 8: Commit**

```bash
git add src/ui-html/components tests/ui-html
git commit -m "feat(ui-html): IconButton, CtaButton, BudgetChip, Logo + tests"
```

---

## Task 6: TopBar composition

**Files:**
- Create: `src/ui-html/components/TopBar.js`

- [ ] **Step 1: Implement TopBar**

`src/ui-html/components/TopBar.js`:
```js
import { bus } from '../bus.js';
import { Logo } from './Logo.js';
import { IconButton } from './IconButton.js';
import { CtaButton } from './CtaButton.js';
import { BudgetChip } from './BudgetChip.js';
import * as I from '../icons/index.js';

export function mountTopBar(root) {
  root.appendChild(Logo());

  root.appendChild(IconButton({
    icon: I.undo(), label: 'UNDO',
    onClick: () => bus.emit('undo'),
  }));
  root.appendChild(IconButton({
    icon: I.redo(), label: 'REDO', disabled: true,
  }));
  root.appendChild(IconButton({
    icon: I.clear(), label: 'CLEAR', accent: 'red',
    onClick: () => bus.emit('clear'),
  }));

  const cta = CtaButton({
    label: 'TEST',
    size: 'large',
    onClick: () => bus.emit('mode:toggle'),
  });
  root.appendChild(cta);

  root.appendChild(BudgetChip());

  root.appendChild(IconButton({ icon: I.save(),     label: 'SAVE',     disabled: true }));
  root.appendChild(IconButton({ icon: I.load(),     label: 'LOAD',     disabled: true }));
  root.appendChild(IconButton({ icon: I.settings(), label: 'SETTINGS', disabled: true }));
  root.appendChild(IconButton({ icon: I.help(),     label: 'HELP',     disabled: true }));

  bus.on('mode:changed', (mode) => {
    cta.setLabel(mode === 'test' ? 'RESET SIM' : 'TEST');
  });
}
```

- [ ] **Step 2: Smoke-test via the integration test in Task 11 (no dedicated test for this composition file).**

- [ ] **Step 3: Commit**

```bash
git add src/ui-html/components/TopBar.js
git commit -m "feat(ui-html): TopBar composition"
```

---

## Task 7: PanelCard, VehicleCard, PresetDropdown (TDD)

**Files:**
- Create: `src/ui-html/components/PanelCard.js`
- Create: `src/ui-html/components/VehicleCard.js`
- Create: `src/ui-html/components/PresetDropdown.js`
- Test:   `tests/ui-html/VehicleCard.test.js`
- Test:   `tests/ui-html/PresetDropdown.test.js`

- [ ] **Step 1: Write failing tests**

`tests/ui-html/VehicleCard.test.js`:
```js
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { bus } from '../../src/ui-html/bus.js';
import { VehicleCard } from '../../src/ui-html/components/VehicleCard.js';

describe('VehicleCard', () => {
  beforeEach(() => bus._reset());

  it('emits vehicle:select with its key when clicked', () => {
    const spy = vi.fn();
    bus.on('vehicle:select', spy);
    const card = VehicleCard({ key: 'truck', label: 'TRUCK', color: '#F7941E' });
    card.click();
    expect(spy).toHaveBeenCalledWith('truck');
  });

  it('marks data-selected when bus emits vehicle:active with its key', () => {
    const card = VehicleCard({ key: 'car', label: 'CAR', color: '#5AB942' });
    bus.emit('vehicle:active', 'car');
    expect(card.dataset.selected).toBe('true');
  });

  it('clears data-selected when vehicle:active fires for a different key', () => {
    const card = VehicleCard({ key: 'car', label: 'CAR', color: '#5AB942' });
    bus.emit('vehicle:active', 'car');
    bus.emit('vehicle:active', 'tank');
    expect(card.dataset.selected).not.toBe('true');
  });
});
```

`tests/ui-html/PresetDropdown.test.js`:
```js
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { bus } from '../../src/ui-html/bus.js';
import { PresetDropdown } from '../../src/ui-html/components/PresetDropdown.js';

describe('PresetDropdown', () => {
  beforeEach(() => bus._reset());

  it('renders the current label and chevron', () => {
    const dd = PresetDropdown({
      label: 'LOAD PRESET',
      options: [{ key: 'normal', label: 'NORMAL — G' }],
      initial: 'normal',
    });
    expect(dd.textContent).toContain('LOAD PRESET');
    expect(dd.textContent).toContain('NORMAL');
  });

  it('opens a menu on click and emits gravity:preset on option click', () => {
    const spy = vi.fn();
    bus.on('gravity:preset', spy);
    const dd = PresetDropdown({
      label: 'LOAD PRESET',
      options: [{ key: 'normal', label: 'NORMAL — G' }, { key: 'low', label: 'LOW — G' }],
      initial: 'normal',
    });
    document.body.appendChild(dd);
    dd.click();
    const opts = dd.querySelectorAll('.menu .opt');
    expect(opts.length).toBe(2);
    opts[1].click();
    expect(spy).toHaveBeenCalledWith('low');
  });
});
```

- [ ] **Step 2: Run, expect fail**

```bash
npx vitest run tests/ui-html/VehicleCard.test.js tests/ui-html/PresetDropdown.test.js
```

Expected: module-not-found.

- [ ] **Step 3: Implement PanelCard**

`src/ui-html/components/PanelCard.js`:
```js
// Reusable white-card-with-blue-header shell.
// opts: { title: string }
export function PanelCard({ title }) {
  const card = document.createElement('div');
  card.className = 'panel-card';

  const header = document.createElement('div');
  header.className = 'panel-header';
  header.textContent = title.toUpperCase();

  const body = document.createElement('div');
  body.className = 'panel-body';

  card.append(header, body);
  card.body = body;       // append children to card.body
  return card;
}
```

- [ ] **Step 4: Implement VehicleCard**

`src/ui-html/components/VehicleCard.js`:
```js
import { bus } from '../bus.js';

// opts: { key, label, color }
export function VehicleCard({ key, label, color }) {
  const row = document.createElement('div');
  row.className = 'vehicle-row';
  row.setAttribute('role', 'button');
  row.setAttribute('aria-label', label);
  row.dataset.key = key;

  const icon = document.createElement('div');
  icon.className = 'icon';
  icon.style.width = '36px';
  icon.style.height = '24px';
  icon.style.background = color;
  icon.style.borderRadius = '6px';

  const lbl = document.createElement('span');
  lbl.className = 'label';
  lbl.textContent = label.toUpperCase();

  row.append(icon, lbl);

  row.addEventListener('click', () => bus.emit('vehicle:select', key));
  bus.on('vehicle:active', (activeKey) => {
    if (activeKey === key) row.dataset.selected = 'true';
    else delete row.dataset.selected;
  });

  return row;
}
```

- [ ] **Step 5: Implement PresetDropdown**

`src/ui-html/components/PresetDropdown.js`:
```js
import { bus } from '../bus.js';

// opts: { label, options: [{key,label}], initial: key }
export function PresetDropdown({ label, options, initial }) {
  const root = document.createElement('div');
  root.className = 'preset-pill';

  const text = document.createElement('div');
  const small = document.createElement('small');
  small.textContent = label;
  const strong = document.createElement('strong');
  const initialOpt = options.find(o => o.key === initial) ?? options[0];
  strong.textContent = (initialOpt?.label ?? '').toUpperCase();
  text.append(small, strong);

  const chev = document.createElement('span');
  chev.className = 'chev';
  chev.textContent = '▼';

  root.append(text, chev);

  let menu = null;
  function closeMenu() { menu?.remove(); menu = null; }
  root.addEventListener('click', (e) => {
    if (menu) { closeMenu(); return; }
    menu = document.createElement('div');
    menu.className = 'menu';
    for (const opt of options) {
      const item = document.createElement('div');
      item.className = 'opt';
      item.textContent = opt.label.toUpperCase();
      item.addEventListener('click', (ev) => {
        ev.stopPropagation();
        strong.textContent = opt.label.toUpperCase();
        bus.emit('gravity:preset', opt.key);
        closeMenu();
      });
      menu.appendChild(item);
    }
    root.appendChild(menu);
    e.stopPropagation();
  });
  document.addEventListener('click', closeMenu);

  return root;
}
```

- [ ] **Step 6: Run, expect pass**

```bash
npx vitest run tests/ui-html/VehicleCard.test.js tests/ui-html/PresetDropdown.test.js
```

Expected: 5 passing.

- [ ] **Step 7: Commit**

```bash
git add src/ui-html/components tests/ui-html
git commit -m "feat(ui-html): PanelCard, VehicleCard, PresetDropdown + tests"
```

---

## Task 8: Sidebar composition

**Files:**
- Create: `src/ui-html/components/Sidebar.js`

- [ ] **Step 1: Implement Sidebar**

`src/ui-html/components/Sidebar.js`:
```js
import { PanelCard } from './PanelCard.js';
import { VehicleCard } from './VehicleCard.js';
import { PresetDropdown } from './PresetDropdown.js';

const VEHICLES = [
  { key: 'car',   label: 'CAR',   color: '#5AB942' },
  { key: 'truck', label: 'TRUCK', color: '#F7941E' },
  { key: 'tank',  label: 'TANK',  color: '#7A8C99' },
];

// opts: { presetOptions: [{key,label}], initialPreset: key }
export function mountSidebar(root, { presetOptions, initialPreset }) {
  const panel = PanelCard({ title: 'VEHICLES' });
  for (const v of VEHICLES) panel.body.appendChild(VehicleCard(v));
  root.appendChild(panel);

  root.appendChild(PresetDropdown({
    label: 'LOAD PRESET',
    options: presetOptions,
    initial: initialPreset,
  }));
}
```

- [ ] **Step 2: Commit**

```bash
git add src/ui-html/components/Sidebar.js
git commit -m "feat(ui-html): Sidebar composition"
```

---

## Task 9: Hud component (TDD)

**Files:**
- Create: `src/ui-html/components/Hud.js`
- Test:   `tests/ui-html/Hud.test.js`

- [ ] **Step 1: Write failing test**

`tests/ui-html/Hud.test.js`:
```js
import { describe, it, expect, beforeEach } from 'vitest';
import { bus } from '../../src/ui-html/bus.js';
import { mountHud } from '../../src/ui-html/components/Hud.js';

describe('Hud', () => {
  let host;
  beforeEach(() => {
    bus._reset();
    host = document.createElement('div');
    document.body.appendChild(host);
  });

  it('renders rows for SPD, ACCEL, DRIVE, CHASSIS, ANGVEL, SLOPE', () => {
    mountHud(host);
    for (const k of ['SPD', 'ACCEL', 'DRIVE', 'CHASSIS', 'ANGVEL', 'SLOPE']) {
      expect(host.textContent).toContain(k);
    }
  });

  it('writes all six values when hud:update fires', () => {
    mountHud(host);
    bus.emit('hud:update', { spd: '1.5', accel: '0.2', drive: '3.0', chassis: '-12.3°', angvel: '0.4', slope: '5°' });
    expect(host.querySelector('[data-key="spd"]').textContent).toBe('1.5');
    expect(host.querySelector('[data-key="accel"]').textContent).toBe('0.2');
    expect(host.querySelector('[data-key="drive"]').textContent).toBe('3.0');
    expect(host.querySelector('[data-key="chassis"]').textContent).toBe('-12.3°');
    expect(host.querySelector('[data-key="angvel"]').textContent).toBe('0.4');
    expect(host.querySelector('[data-key="slope"]').textContent).toBe('5°');
  });
});
```

- [ ] **Step 2: Run, expect fail**

```bash
npx vitest run tests/ui-html/Hud.test.js
```

Expected: module-not-found.

- [ ] **Step 3: Implement Hud**

`src/ui-html/components/Hud.js`:
```js
import { bus } from '../bus.js';

const ROWS = [
  { key: 'spd',     label: 'SPD',     color: '#2D9CDB' },
  { key: 'chassis', label: 'CHASSIS', color: '#8E5BD9' },
  { key: 'accel',   label: 'ACCEL',   color: '#5AB942' },
  { key: 'angvel',  label: 'ANGVEL',  color: '#F7941E' },
  { key: 'drive',   label: 'DRIVE',   color: '#EB4D3D' },
  { key: 'slope',   label: 'SLOPE',   color: '#F5B423' },
];

export function mountHud(root) {
  const panel = document.createElement('div');
  panel.className = 'hud-panel';

  const grid = document.createElement('div');
  grid.className = 'grid';

  const valueNodes = {};
  for (const r of ROWS) {
    const row = document.createElement('div');
    row.className = 'hud-row';

    const dot = document.createElement('span');
    dot.className = 'dot';
    dot.style.background = r.color;

    const label = document.createElement('span');
    label.className = 'label';
    label.textContent = r.label;

    const num = document.createElement('span');
    num.className = 'num';
    num.dataset.key = r.key;
    num.textContent = '0';

    row.append(dot, label, num);
    grid.appendChild(row);
    valueNodes[r.key] = num;
  }
  panel.appendChild(grid);
  root.appendChild(panel);

  bus.on('hud:update', (vals) => {
    for (const k of Object.keys(valueNodes)) {
      if (vals[k] !== undefined) valueNodes[k].textContent = String(vals[k]);
    }
  });
}
```

- [ ] **Step 4: Run, expect pass**

```bash
npx vitest run tests/ui-html/Hud.test.js
```

Expected: 2 passing.

- [ ] **Step 5: Commit**

```bash
git add src/ui-html/components/Hud.js tests/ui-html/Hud.test.js
git commit -m "feat(ui-html): Hud panel + tests"
```

---

## Task 10: ToolTile + Toolbar (TDD)

**Files:**
- Create: `src/ui-html/components/ToolTile.js`
- Create: `src/ui-html/components/Toolbar.js`
- Test:   `tests/ui-html/Toolbar.test.js`

- [ ] **Step 1: Write failing test**

`tests/ui-html/Toolbar.test.js`:
```js
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { bus } from '../../src/ui-html/bus.js';
import { mountToolbar } from '../../src/ui-html/components/Toolbar.js';

describe('Toolbar', () => {
  let host;
  beforeEach(() => {
    bus._reset();
    host = document.createElement('nav');
    document.body.appendChild(host);
  });

  it('renders all active and disabled tool tiles', () => {
    mountToolbar(host);
    for (const k of ['ROAD', 'BEAM', 'FREE', 'NODES', 'CABLE', 'HYDRAULIC', 'SPRING', 'REMOVE', 'GRID', 'SNAP']) {
      expect(host.textContent.toUpperCase()).toContain(k);
    }
  });

  it('emits tool:select when an active tile is clicked', () => {
    const spy = vi.fn();
    bus.on('tool:select', spy);
    mountToolbar(host);
    host.querySelector('[data-tool="road"]').click();
    expect(spy).toHaveBeenCalledWith('road');
  });

  it('does not emit when a disabled tile is clicked', () => {
    const spy = vi.fn();
    bus.on('tool:select', spy);
    mountToolbar(host);
    host.querySelector('[data-tool="cable"]').click();
    expect(spy).not.toHaveBeenCalled();
  });

  it('marks the active tile via data-active when tool:select fires', () => {
    mountToolbar(host);
    bus.emit('tool:select', 'beam');
    expect(host.querySelector('[data-tool="beam"]').dataset.active).toBe('true');
    expect(host.querySelector('[data-tool="road"]').dataset.active).not.toBe('true');
  });

  it('PLAY button emits mode:toggle', () => {
    const spy = vi.fn();
    bus.on('mode:toggle', spy);
    mountToolbar(host);
    host.querySelector('.play-small').click();
    expect(spy).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run, expect fail**

```bash
npx vitest run tests/ui-html/Toolbar.test.js
```

Expected: module-not-found.

- [ ] **Step 3: Implement ToolTile**

`src/ui-html/components/ToolTile.js`:
```js
import { bus } from '../bus.js';

// opts: { tool: string, label: string, iconSvg: string, accent?: string, disabled?: bool }
export function ToolTile({ tool, label, iconSvg, accent, disabled = false }) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'btn btn--white tool-tile';
  btn.dataset.tool = tool;
  if (disabled) btn.setAttribute('aria-disabled', 'true');

  const iconWrap = document.createElement('span');
  iconWrap.innerHTML = iconSvg;
  const svgEl = iconWrap.querySelector('svg');
  if (svgEl && accent) svgEl.classList.add(`icon--${accent}`);
  if (svgEl) btn.appendChild(svgEl);

  const lbl = document.createElement('span');
  lbl.className = 'label';
  lbl.textContent = label.toUpperCase();
  btn.appendChild(lbl);

  btn.addEventListener('click', () => {
    if (btn.getAttribute('aria-disabled') === 'true') return;
    bus.emit('tool:select', tool);
  });
  return btn;
}
```

- [ ] **Step 4: Implement Toolbar**

`src/ui-html/components/Toolbar.js`:
```js
import { bus } from '../bus.js';
import { ToolTile } from './ToolTile.js';
import { CtaButton } from './CtaButton.js';
import * as I from '../icons/index.js';

const ACTIVE_TOOLS = [
  { tool: 'nodes', label: 'NODES', iconSvg: I.nodes(), accent: 'red',    disabled: true  },
  { tool: 'road',  label: 'ROAD',  iconSvg: I.road(),  accent: 'gray',   disabled: false },
  { tool: 'beam',  label: 'BEAM',  iconSvg: I.beam(),  accent: 'orange', disabled: false },
  { tool: 'cable', label: 'CABLE', iconSvg: I.cable(), accent: undefined, disabled: true },
  { tool: 'hydraulic', label: 'HYDRAULIC', iconSvg: I.hydraulic(), accent: 'gray',   disabled: true },
  { tool: 'spring',    label: 'SPRING',    iconSvg: I.spring(),    accent: 'purple', disabled: true },
  { tool: 'remove',    label: 'REMOVE',    iconSvg: I.remove(),    accent: 'red',    disabled: true },
];

const UTILITY = [
  { tool: 'free',     label: 'FREE',  iconSvg: I.beam(),    accent: undefined, disabled: false },
  { tool: 'grid',     label: 'GRID',  iconSvg: I.grid(),    accent: undefined, disabled: false },
  { tool: 'snap',     label: 'SNAP',  iconSvg: I.snap(),    accent: undefined, disabled: false },
  { tool: 'zoom-out', label: '',      iconSvg: I.zoomOut(), accent: undefined, disabled: false },
  { tool: 'zoom-in',  label: '',      iconSvg: I.zoomIn(),  accent: undefined, disabled: false },
];

export function mountToolbar(root) {
  const tiles = {};

  for (const t of ACTIVE_TOOLS) {
    const tile = ToolTile(t);
    tiles[t.tool] = tile;
    root.appendChild(tile);
  }

  const divider = document.createElement('div');
  divider.className = 'divider';
  root.appendChild(divider);

  for (const t of UTILITY) {
    const tile = ToolTile(t);
    if (t.tool.startsWith('zoom')) tile.classList.add('zoom');
    tiles[t.tool] = tile;
    root.appendChild(tile);
  }

  const play = CtaButton({
    label: 'PLAY', size: 'small',
    onClick: () => bus.emit('mode:toggle'),
  });
  play.classList.add('play-small');
  root.appendChild(play);

  bus.on('tool:select', (key) => {
    for (const [tool, el] of Object.entries(tiles)) {
      if (tool === key) el.dataset.active = 'true';
      else delete el.dataset.active;
    }
  });
}
```

- [ ] **Step 5: Run, expect pass**

```bash
npx vitest run tests/ui-html/Toolbar.test.js
```

Expected: 5 passing.

- [ ] **Step 6: Commit**

```bash
git add src/ui-html/components tests/ui-html/Toolbar.test.js
git commit -m "feat(ui-html): ToolTile + Toolbar composition + tests"
```

---

## Task 11: mountUi() entrypoint + integration test

**Files:**
- Create: `src/ui-html/index.js`
- Test:   `tests/ui-html/integration.test.js`
- Modify: `src/main.js`

- [ ] **Step 1: Write failing integration test**

`tests/ui-html/integration.test.js`:
```js
import { describe, it, expect, beforeEach } from 'vitest';
import { bus } from '../../src/ui-html/bus.js';
import { mountUi } from '../../src/ui-html/index.js';

function setupDom() {
  document.body.innerHTML = `
    <div id="app">
      <div id="game"></div>
      <div id="ui-root">
        <header id="ui-topbar"></header>
        <aside  id="ui-sidebar"></aside>
        <div    id="ui-hud"></div>
        <nav    id="ui-toolbar"></nav>
        <div    id="ui-modals"></div>
      </div>
    </div>`;
}

describe('mountUi integration', () => {
  beforeEach(() => {
    bus._reset();
    setupDom();
    mountUi({
      presetOptions: [{ key: 'normal', label: 'NORMAL — G' }, { key: 'low', label: 'LOW — G' }],
      initialPreset: 'normal',
      initialVehicle: 'car',
    });
  });

  it('mounts content in every chrome region', () => {
    expect(document.querySelector('#ui-topbar').children.length).toBeGreaterThan(0);
    expect(document.querySelector('#ui-sidebar').children.length).toBeGreaterThan(0);
    expect(document.querySelector('#ui-hud').children.length).toBeGreaterThan(0);
    expect(document.querySelector('#ui-toolbar').children.length).toBeGreaterThan(0);
  });

  it('toggles sidebar-hidden / hud-hidden via mode:changed', () => {
    bus.emit('mode:changed', 'test');
    expect(document.querySelector('#ui-root').classList.contains('mode-test')).toBe(true);
    bus.emit('mode:changed', 'build');
    expect(document.querySelector('#ui-root').classList.contains('mode-build')).toBe(true);
  });

  it('budget:update propagates from scene to chip', () => {
    bus.emit('budget:update', 400);
    expect(document.querySelector('.budget-num').textContent).toBe('400');
  });

  it('hud:update propagates to HUD', () => {
    bus.emit('hud:update', { spd: '2.5' });
    expect(document.querySelector('[data-key="spd"]').textContent).toBe('2.5');
  });

  it('vehicle:active sets data-selected on the right card', () => {
    bus.emit('vehicle:active', 'truck');
    expect(document.querySelector('[data-key="truck"]').dataset.selected).toBe('true');
  });
});
```

- [ ] **Step 2: Run, expect fail**

```bash
npx vitest run tests/ui-html/integration.test.js
```

Expected: module-not-found (`mountUi`).

- [ ] **Step 3: Implement mountUi()**

`src/ui-html/index.js`:
```js
import { bus } from './bus.js';
import { mountTopBar } from './components/TopBar.js';
import { mountSidebar } from './components/Sidebar.js';
import { mountHud }     from './components/Hud.js';
import { mountToolbar } from './components/Toolbar.js';

// opts: { presetOptions, initialPreset, initialVehicle }
export function mountUi(opts) {
  const root = document.getElementById('ui-root');
  root.classList.add('mode-build');

  mountTopBar(document.getElementById('ui-topbar'));
  mountSidebar(document.getElementById('ui-sidebar'), {
    presetOptions: opts.presetOptions,
    initialPreset: opts.initialPreset,
  });
  mountHud(document.getElementById('ui-hud'));
  mountToolbar(document.getElementById('ui-toolbar'));

  bus.on('mode:changed', (mode) => {
    root.classList.remove('mode-build', 'mode-test');
    root.classList.add(`mode-${mode}`);
  });

  // Initial sync of selected vehicle (deferred so the scene can override).
  if (opts.initialVehicle) bus.emit('vehicle:active', opts.initialVehicle);
}
```

- [ ] **Step 4: Run, expect pass**

```bash
npx vitest run tests/ui-html/integration.test.js
```

Expected: 5 passing.

- [ ] **Step 5: Wire mountUi() into main.js**

Edit `src/main.js`. Replace existing content with:
```js
import './ui-html/styles/index.css';
import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene.js';
import { LevelScene } from './scenes/LevelScene.js';
import { mountUi } from './ui-html/index.js';

// Mount HTML chrome before Phaser boots. mountUi reads from #ui-* divs.
// Preset list is hard-coded here for now; LevelScene refines it after level loads.
mountUi({
  presetOptions: [{ key: 'normal', label: 'NORMAL — G' }],
  initialPreset: 'normal',
  initialVehicle: 'car',
});

const config = {
  type: Phaser.AUTO,
  parent: 'game',
  width: 1280,
  height: 720,
  backgroundColor: '#87ceeb',
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  physics: {
    default: 'matter',
    matter: {
      gravity: { y: 1.5 },
      enableSleeping: false,
      positionIterations: 8,
      velocityIterations: 6,
      constraintIterations: 4,
      debug: false,
    },
  },
  scene: [BootScene, LevelScene],
};

new Phaser.Game(config);
```

- [ ] **Step 6: Run full test suite — confirm green**

```bash
npm test
```

Expected: all old tests + all new UI tests pass.

- [ ] **Step 7: Commit**

```bash
git add src/ui-html/index.js src/main.js tests/ui-html/integration.test.js
git commit -m "feat(ui-html): mountUi entrypoint + integration tests + main.js wiring"
```

---

## Task 12: LevelScene rewire to bus

**Files:**
- Modify: `src/scenes/LevelScene.js`

Replace chrome-creating Phaser code with bus subscriptions/emits. Old Phaser UI nodes still exist in the scene at this stage — we delete them in Task 13. This task adds the seam.

- [ ] **Step 1: Import bus at top of LevelScene.js**

Edit the import block (top of file) to add:
```js
import { bus } from '../ui-html/bus.js';
```

- [ ] **Step 2: Add bus subscriptions in `create()`**

Find the line `physics.setOnSnap(...)` (currently around line 161) and insert ABOVE it:

```js
// ── HTML UI bus wiring ──────────────────────────────────────────────────
this._busHandlers = {
  undo:           () => this._undoLastPlacement(),
  clear:          () => this.hardReset(),
  modeToggle:     () => this.toggleTest(),
  vehicleSelect:  (k) => this._selectVehicle(k),
  toolSelect:     (k) => this._onToolSelect(k),
  gravityPreset:  (k) => this._applyGravityPreset(k),
};
bus.on('undo',            this._busHandlers.undo);
bus.on('clear',           this._busHandlers.clear);
bus.on('mode:toggle',     this._busHandlers.modeToggle);
bus.on('vehicle:select',  this._busHandlers.vehicleSelect);
bus.on('tool:select',     this._busHandlers.toolSelect);
bus.on('gravity:preset',  this._busHandlers.gravityPreset);
```

- [ ] **Step 3: Add `_onToolSelect`, `_applyGravityPreset` near the bottom of the class**

Insert before the existing `update()` method:

```js
_onToolSelect(toolKey) {
  if (toolKey === 'road' || toolKey === 'beam') {
    // Translate to the existing BlockPalette material model.
    // road/beam in level.materials are keyed 'road' and 'wood' respectively.
    const matKey = toolKey === 'road' ? 'road' : 'wood';
    this._toolState.material = matKey;
    this._toolState.freeform = false;
    this.material = this.level.materials[matKey];
  } else if (toolKey === 'free') {
    this._toolState.freeform = !this._toolState.freeform;
    this._toolState.material = null;
  } else if (toolKey === 'grid') {
    this._gridVisible = !this._gridVisible;
    if (this._gridGfx) this._gridGfx.setVisible(this._gridVisible);
  } else if (toolKey === 'snap') {
    this._snapEnabled = !this._snapEnabled;
  } else if (toolKey === 'zoom-in') {
    this.cameras.main.setZoom(Math.min(this.cameras.main.zoom * 1.1, 2.5));
  } else if (toolKey === 'zoom-out') {
    this.cameras.main.setZoom(Math.max(this.cameras.main.zoom / 1.1, 0.5));
  }
}

_applyGravityPreset(key) {
  // Hook for future preset list. For now only 'normal' exists.
  if (key === 'normal') {
    physics.setGravityY?.(1.5);
  }
}
```

- [ ] **Step 4: Replace `_budgetLabel.setText` calls with bus.emit**

Search the file for `this._budgetLabel.setText`. Each occurrence becomes `bus.emit('budget:update', this._budgetRemaining)`. Leave the existing `setText` line in place for now (Task 13 deletes the Phaser UI).

- [ ] **Step 5: Emit `mode:changed` from `toggleTest()`**

Find the `toggleTest()` method. After the line that sets `this.mode = 'test'` insert:
```js
bus.emit('mode:changed', 'test');
```
After the line that sets `this.mode = 'build'` insert:
```js
bus.emit('mode:changed', 'build');
```

- [ ] **Step 6: Emit `vehicle:active` from `_selectVehicle()`**

Find `_selectVehicle(key)`. At the end of the function, add:
```js
bus.emit('vehicle:active', key);
```

- [ ] **Step 7: Promote `_updateDebugHud` to always-on and route via bus**

Replace the body of `_updateDebugHud()` (currently lines 601-614) with:
```js
_updateDebugHud() {
  const info = physics.getDebugInfo();
  if (!info) {
    bus.emit('hud:update', { spd: '—', accel: '—', drive: '—', chassis: '—', angvel: '—', slope: '—' });
    return;
  }
  const { speed, accel, driveForce, angleDeg, angVelDeg, slopeDeg } = info;
  bus.emit('hud:update', {
    spd:     speed.toFixed(2),
    accel:   (accel >= 0 ? '+' : '') + accel.toFixed(2),
    drive:   driveForce.toExponential(1),
    chassis: angleDeg.toFixed(1) + '°',
    angvel:  angVelDeg.toFixed(2),
    slope:   slopeDeg != null ? slopeDeg.toFixed(0) + '°' : '—',
  });
}
```
Also change the call site at line 1228 from
`if (DEBUG_HUD && this._debugHudVisible) this._updateDebugHud();`
to
`this._updateDebugHud();`

- [ ] **Step 8: Emit initial sync at end of `create()`**

After all the existing chrome construction code (after line 267), insert:
```js
bus.emit('budget:update', this._budgetRemaining);
bus.emit('vehicle:active', this._vehiclePreset);
bus.emit('mode:changed', 'build');
bus.emit('tool:select', 'road');         // matches default material = road
this._toolState = { material: 'road', size: null, freeform: false };
```

- [ ] **Step 9: Add bus cleanup to the `shutdown` listener**

Find the existing `this.events.on('shutdown', …)` block (around line 273). Inside its callback add:
```js
bus.off('undo',           this._busHandlers.undo);
bus.off('clear',          this._busHandlers.clear);
bus.off('mode:toggle',    this._busHandlers.modeToggle);
bus.off('vehicle:select', this._busHandlers.vehicleSelect);
bus.off('tool:select',    this._busHandlers.toolSelect);
bus.off('gravity:preset', this._busHandlers.gravityPreset);
```

- [ ] **Step 10: Verify dev server**

```bash
npm run dev
```

Both Phaser and HTML UI render simultaneously (Phaser chrome still visible from old code; HTML chrome visible from new code). Clicking either set drives the same logic. Click old Phaser UNDO button → HTML budget chip stays in sync. Click HTML TEST CTA → Phaser TEST button label updates? No — TEST label updates only in the HTML chrome. That's expected; old Phaser test label is removed in Task 13. Kill server.

- [ ] **Step 11: Verify all tests still pass**

```bash
npm test
```

Expected: green.

- [ ] **Step 12: Commit**

```bash
git add src/scenes/LevelScene.js
git commit -m "feat(scene): wire LevelScene to ui-html bus (seam in place)"
```

---

## Task 13: Delete old Phaser UI + BlockPalette, final verification

**Files:**
- Modify: `src/scenes/LevelScene.js`
- Delete: `src/ui/BlockPalette.js`
- Delete: usages of BlockPalette in LevelScene

- [ ] **Step 1: Delete BlockPalette.js**

```bash
git rm src/ui/BlockPalette.js
```

- [ ] **Step 2: Delete BlockPalette imports and usages in LevelScene.js**

Remove the import:
```js
import { BlockPalette } from '../ui/BlockPalette.js';
```

Remove lines that reference `this._palette`:
- The construction `this._palette = new BlockPalette(this, this.level.materials);`
- `this._palette.onChange(...)`
- `this.input.keyboard.on('keydown-R', …)` keyboard hooks that call `this._palette.*` — replace with bus emits or delete.
- The `this._palette?.destroy()` in the shutdown handler.

Replace the keyboard shortcuts with:
```js
this.input.keyboard.on('keydown-R', () => bus.emit('tool:select', 'road'));
this.input.keyboard.on('keydown-B', () => bus.emit('tool:select', 'beam'));
this.input.keyboard.on('keydown-F', () => bus.emit('tool:select', 'free'));
```

- [ ] **Step 3: Delete chrome creation block (LevelScene.js lines ~210-267)**

Delete the lines that create:
- `this._vehicleBtns` rectangles, `_drawVehicleIcons()` call, label `add.text` rows (around 210-227).
- Gravity rectangle + label (around 229-233).
- Undo rectangle + label (around 235-237). KEEP the keyboard `Z` handler — it still calls `_undoLastPlacement`.
- Clear rectangle + label (around 241-244).
- TEST button rectangle + label (around 246-249).
- Budget bg + label (around 250-252).
- Debug HUD block (around 254-267) — the entire `if (DEBUG_HUD) { … }` block.

Also remove the `DEBUG_HUD` constant near the top of the file (around line 14).

Also remove the `_drawVehicleIcons()` method definition (search file for `_drawVehicleIcons`).

- [ ] **Step 4: Remove all `this._budgetLabel.setText`, `this.testButtonLabel.setText`, `this._debugText.setText` lines**

Search for each of these and delete. Bus emits added in Task 12 replace them.

Also locate `_flashBudget()` (around line 616) — it tweens `this._budgetLabel`. Since the Phaser budget label no longer exists, replace the entire method body with:
```js
_flashBudget() { /* HTML chip handles its own emphasis; intentionally empty. */ }
```
(Or delete the method and its callsites — search for `_flashBudget`.)

- [ ] **Step 5: Replace `isOverPalette` checks**

Search for `this._palette.isOverPalette(pointer)`. Replace each with:
```js
((p) => {
  const el = document.elementFromPoint(p.x, p.y);
  return !!el?.closest('#ui-toolbar');
})(pointer)
```

- [ ] **Step 6: Replace `this._palette.getSelection()`**

Search for `this._palette.getSelection()`. Replace with `this._toolState`. Adjust property reads: where code expects `{ material, size, freeform }`, the new state has matching shape so no further mapping is needed.

- [ ] **Step 7: Replace `this._onPaletteChange` callsite**

Remove `_onPaletteChange` if it exists. Selection changes are now driven through `_onToolSelect` introduced in Task 12.

- [ ] **Step 8: Run tests — confirm green**

```bash
npm test
```

Expected: all tests pass; physics tests untouched, UI tests pass.

- [ ] **Step 9: Manual smoke test in dev server**

```bash
npm run dev
```

Verify in the browser at `http://localhost:5173`:
- BootScene level picker still works.
- LevelScene loads and shows: HTML top bar (Logo, Undo, disabled Redo, Clear, TEST CTA, BudgetChip, disabled Save/Load/Settings/Help); HTML sidebar (Vehicles card with Car selected, Load Preset dropdown); HTML bottom toolbar (Nodes disabled, Road active by default, Beam, four disabled tiles, Free, Grid, Snap, zoom buttons, small PLAY).
- Click ROAD then click in the canvas — a beam is placed (existing build logic).
- Click TEST — sidebar hides, HUD appears with live numbers, vehicle drives.
- Click RESET SIM — back to build mode, HUD hides, sidebar reappears.
- CLEAR removes all beams.
- UNDO removes the last beam (and Ctrl+Z still works).

Kill server.

- [ ] **Step 10: Commit**

```bash
git add src/scenes/LevelScene.js src/ui/BlockPalette.js
git commit -m "feat(scene): delete Phaser chrome + BlockPalette; HTML UI is sole chrome"
```

- [ ] **Step 11: Tag the milestone (optional)**

```bash
git tag -a phase1-chrome -m "Phase 1: HTML chrome revamp complete"
```

---

## Done criteria recap

- All Vitest suites green.
- `git diff main -- src/systems/physics.js` is empty.
- Dev server smoke test passes the checklist in Task 13 Step 9.
- BlockPalette.js no longer exists.
- LevelScene.js no longer contains chrome `add.rectangle / add.text` for: vehicles, gravity, undo, clear, test, budget, debug HUD.
