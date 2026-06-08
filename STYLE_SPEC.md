# Bridge Builder Editor — Art Direction & UI Style Spec

> Paste this into Claude Code as the styling source of truth, or keep it in the repo and tell Claude Code: "Match `STYLE_SPEC.md` exactly for all UI."

---

## 0. How to use this (read first)

This project has **two distinct visual layers**. Do not blur them.

- **UI CHROME** (toolbars, buttons, panels, chips, dropdowns, HUD) → build with **HTML/CSS/SVG** using the tokens below. This is what you reproduce precisely.
- **GAME WORLD** (vehicles, terrain cliffs, trees, clouds, water, flag) → these are **pre-rendered 3D "toy/claymation" image assets**. Do **NOT** try to recreate this look with CSS gradients or emoji — it will look wrong. Position/scale provided sprite assets only. If assets are missing, use clearly-labeled placeholder rectangles and flag that real assets are needed; never improvise the 3D style.

Overall vibe: **bright, cheerful, high-contrast casual mobile game.** Chunky rounded shapes, soft shadows, "press-down" tactile buttons (juicy). Nothing thin, sharp, flat-corporate, or muted.

---

## 1. Design tokens

```css
:root {
  /* --- Brand / accent colors --- */
  --blue:        #2D9CDB;  /* primary: icons, logo, active tool, links */
  --blue-dark:   #1B7AB8;  /* blue button bottom-edge / shadow */
  --green:       #5AB942;  /* primary CTA: TEST / PLAY */
  --green-dark:  #42962E;  /* green button bottom-edge */
  --grass:       #86C440;  /* terrain top accent (if styling world UI) */
  --gold:        #F5B423;  /* coin / budget star */
  --gold-dark:   #E09A10;
  --orange:      #F7941E;  /* logo bridge, flag */
  --red:         #EB4D3D;  /* CLEAR, NODES tool, anchor dots */
  --purple:      #8E5BD9;  /* SPRING tool */

  /* --- Neutrals --- */
  --panel:        #FFFFFF;
  --panel-tint:   #F2F5F8;  /* inset / secondary surfaces */
  --border:       #E1E8EE;
  --text:         #37474F;  /* slate, NEVER pure black */
  --text-soft:    #7A8C99;
  --text-invert:  #FFFFFF;

  /* --- Sky (world backdrop only) --- */
  --sky-top:      #5DBFF0;
  --sky-bottom:   #BDE7FB;

  /* --- Radii --- */
  --r-sm: 10px;   /* small icon buttons */
  --r-md: 14px;   /* standard buttons / cards */
  --r-lg: 18px;   /* large panels */
  --r-pill: 999px;

  /* --- Shadows --- */
  --shadow-card:  0 4px 12px rgba(40,60,80,0.12);
  --shadow-float: 0 6px 18px rgba(40,60,80,0.16);

  /* --- Spacing rhythm (8px base) --- */
  --gap: 8px;
}
```

> Using Tailwind? Map these into `theme.extend.colors`, `borderRadius`, and `boxShadow`. Keep the names identical.

---

## 2. Typography

- **Font:** a rounded geometric heavy sans. Use **Fredoka** or **Baloo 2** (closest match). Acceptable fallback: **Nunito** (800 weight).
  `font-family: "Fredoka", "Baloo 2", "Nunito", system-ui, sans-serif;`
- **Labels** (button text, panel titles): `UPPERCASE`, weight **600–700**, letter-spacing **0.04em**.
- **Big numbers** (budget, stats values): weight **700**, large, color `--text`.
- **Body/values in HUD:** weight 600.
- Never use thin weights (<500). Never use serif. Text color is `--text`, not black.

---

## 3. The signature button style ("juicy" / press-down)

This is the single most important detail. Buttons sit on a **solid colored bottom edge** (not just a soft shadow), and **squash on press**.

```css
.btn {
  border: none;
  border-radius: var(--r-md);
  padding: 10px 16px;
  font: 700 15px/1 "Fredoka", sans-serif;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  cursor: pointer;
  transition: transform .08s ease, box-shadow .08s ease;
}

/* White utility button (Undo, Save, tool tiles) */
.btn--white {
  background: var(--panel);
  color: var(--text);
  box-shadow: 0 3px 0 var(--border), var(--shadow-card);
}

/* Primary green CTA (TEST / PLAY) — the hard bottom edge is essential */
.btn--cta {
  background: var(--green);
  color: var(--text-invert);
  box-shadow: 0 5px 0 var(--green-dark), var(--shadow-float);
  padding: 14px 28px;
  font-size: 20px;
}

/* Pressed state: button "sinks" into its edge */
.btn:active {
  transform: translateY(3px);
  box-shadow: 0 1px 0 var(--green-dark), var(--shadow-card);
}

.btn:hover { transform: translateY(-1px); }
```

Apply the same `0 Npx 0 <dark>` hard-edge pattern to blue/red/gold buttons using their `-dark` token.

---

## 4. Component recipes

**Tool tile (bottom toolbar: NODES, ROAD, BEAM, …)**
- Vertical stack: colored icon on top, uppercase label below.
- White rounded card (`--r-md`), `--shadow-card`.
- Each tool keeps its own icon accent color (NODES red, BEAM blue, SPRING purple, REMOVE red eraser, etc.).
- **Active state:** fill the whole tile with `--blue`, icon + label turn white, add a small status dot. (In the screenshot, NODES is the active blue-filled tile.)

**Top action buttons (Undo / Redo / Clear / Save / Load / Settings / Help)**
- White tile, icon centered, tiny uppercase label beneath. Clear's icon uses `--red`.

**Primary CTA (TEST, PLAY)**
- Green `.btn--cta` with a white "play" triangle ▶ + bold uppercase word.

**Budget chip**
- White rounded card. Tiny `--text-soft` "BUDGET LEFT" label on top, large bold number below, gold star coin icon to the right.

**Vehicle cards (Car / Truck / Tank)**
- White rounded card, sprite/icon on the left, uppercase label on the right.
- **Selected:** 2px `--blue` border + soft blue glow ring; unselected is plain.

**Dropdown (LOAD PRESET)**
- White pill/card with a `--blue` chevron on the right.

**Stats HUD (bottom-left: SPD, ACCEL, DRIVE, CHASSIS, ANGVEL, SLOPE)**
- Single white rounded panel (`--r-lg`), two columns of rows.
- Each row: small colored icon + uppercase `--text-soft` label + bold value (numbers feel tabular — consider `font-variant-numeric: tabular-nums`).

**Section panels (VEHICLES, LOAD PRESET sidebar)**
- White card with a `--blue` rounded header bar containing the uppercase title in white.

---

## 5. Iconography

- Custom/illustrated, slightly chunky, **two-tone** icons (think rounded Material, not thin line icons).
- Each is filled with its accent color. Stroke weight is generous; corners are rounded.
- Anchor/node points in the world are solid **red circles** (`--red`).

---

## 6. Do / Don't checklist

✅ Rounded everything (≥10px radius), soft shadows, hard-edge buttons, slate text, bright saturated accents, uppercase chunky labels.
✅ Buttons that visibly press down on `:active`.
❌ Sharp corners, hairline borders, drop-shadow-less flat material, pure black text, thin fonts, muted/desaturated palettes.
❌ Faking the 3D vehicle/terrain look with CSS — that's an asset job, not a code job.

---

## 7. Asset note for the game world

The vehicles, cliffs, trees, clouds, water, and flag are **rendered 3D toy-style sprites** with soft global illumination and rounded edges. Build the canvas/world layout to receive these as image assets (PNG/SVG sprites). Where assets are absent, render labeled placeholders and surface a TODO — do not approximate the style.
