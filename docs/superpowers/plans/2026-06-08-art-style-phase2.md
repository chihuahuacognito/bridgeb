---
Date: 2026-06-08
Content Type: Implementation Plan
---

# Art Style Revamp — Phase 2 (World Art)

**Goal:** Land everything that's spec-allowed today (sky gradient + asset-receiving infrastructure + flagged placeholders for missing sprites), so Phase 1's chrome doesn't sit on top of a flat-gray world.

**Spec constraint (STYLE_SPEC §0, §7):** Cliffs, vehicles, trees, clouds, water, flag must come from pre-rendered 3D sprites. Where assets are missing, render labeled placeholders — do not improvise the 3D style with CSS/Phaser primitives.

**Scope (this PR):**
- Sky gradient (`--sky-top` → `--sky-bottom`) via Phaser graphic, painted before terrain.
- BootScene asset preload pipeline: attempts to load `src/assets/world/*.png`. `loaderror` events do NOT crash; missing keys are tracked in `physics.assetState`.
- `_hasAsset(key)` helper on LevelScene; terrain/vehicle/cloud/water render code prefers the sprite when present, else draws a labeled magenta placeholder rectangle per spec §7.
- Water rendered as a tinted band (acceptable per spec — flat color, not 3D-toy-look approximation).

**Out of scope:**
- Sourcing or generating actual sprite assets — separate effort.
- Trees, flag (require new level-data entries).
- BootScene level-picker restyle (still Phase 3+).

**Tech notes:**
- Phaser's `Texture` cache is checked via `this.textures.exists(key)`.
- `loaderror` handler in BootScene logs the missing key and emits a `console.warn` with a TODO line.

---

## Task 1: Sky gradient

**Files:**
- Modify: `src/scenes/LevelScene.js` (`drawSky`)

- [ ] **Step 1: Replace `drawSky()` body**

`drawSky()` currently does `this.cameras.main.setBackgroundColor('#b2b9c2');`. Replace with a vertical gradient graphic spanning the level world:

```js
drawSky() {
  const g = this.add.graphics().setDepth(-100);
  const { worldWidth: w, worldHeight: h } = this.level;
  const topRGB = 0x5DBFF0;   // --sky-top
  const botRGB = 0xBDE7FB;   // --sky-bottom
  // Phaser graphics don't do native gradient fills; stack thin rows.
  const STEPS = 60;
  for (let i = 0; i < STEPS; i++) {
    const t = i / (STEPS - 1);
    const r = Math.round(((topRGB >> 16) & 0xff) * (1 - t) + ((botRGB >> 16) & 0xff) * t);
    const gC = Math.round(((topRGB >> 8) & 0xff) * (1 - t) + ((botRGB >> 8) & 0xff) * t);
    const b = Math.round((topRGB & 0xff) * (1 - t) + (botRGB & 0xff) * t);
    g.fillStyle((r << 16) | (gC << 8) | b, 1);
    g.fillRect(0, (i * h) / STEPS, w, Math.ceil(h / STEPS) + 1);
  }
  this._skyGfx = g;
  // Camera background still acts as fallback outside the world bounds.
  this.cameras.main.setBackgroundColor('#5DBFF0');
}
```

Also: `_setBlueprintMode` and `_setTestMode` currently swap the camera BG. Leave them — they only affect outside-world area. Add `this._skyGfx?.setVisible(true)` for completeness:

In `_setBlueprintMode`:
```js
this._skyGfx?.setVisible(true);
```
In `_setTestMode`:
```js
this._skyGfx?.setVisible(true);
```

- [ ] **Step 2: Tests + manual check + commit**

```bash
npm test                # green
git add src/scenes/LevelScene.js
git commit -m "feat(world): sky gradient per STYLE_SPEC tokens"
```

---

## Task 2: Asset loader + missing-asset detection

**Files:**
- Modify: `src/scenes/BootScene.js`
- Create: `src/systems/assets.js` (tiny registry singleton)

- [ ] **Step 1: Create `assets.js` registry**

`src/systems/assets.js`:
```js
// Tracks which world-art asset keys are missing so LevelScene can render
// labeled placeholders per STYLE_SPEC §7.
const missing = new Set();

export const assets = {
  markMissing(key) { missing.add(key); },
  has(key)         { return !missing.has(key); },
  missingList()    { return [...missing]; },
  _reset()         { missing.clear(); },
};
```

- [ ] **Step 2: BootScene preload pipeline**

Edit `src/scenes/BootScene.js`. Add a `preload()`:
```js
import { assets } from '../systems/assets.js';

preload() {
  const KEYS = [
    'cliff-left', 'cliff-right',
    'car', 'truck', 'tank',
    'cloud-1', 'cloud-2', 'cloud-3',
    'water', 'flag', 'tree',
  ];
  for (const key of KEYS) {
    this.load.image(key, `assets/world/${key}.png`);
  }
  this.load.on('loaderror', (file) => {
    assets.markMissing(file.key);
    console.warn(`[assets] missing: ${file.key}.png — placeholder will be rendered (Phase 2 TODO)`);
  });
}
```

- [ ] **Step 3: Commit**

```bash
git add src/scenes/BootScene.js src/systems/assets.js
git commit -m "feat(assets): preload pipeline + missing-asset registry"
```

---

## Task 3: Cliff / vehicle / water placeholder layer

**Files:**
- Modify: `src/scenes/LevelScene.js`
- Create: `src/utils/placeholderRect.js`

- [ ] **Step 1: Helper for labeled placeholder rectangles**

`src/utils/placeholderRect.js`:
```js
// Renders a clearly-labeled magenta-tinted placeholder rectangle so missing
// assets are visually obvious per STYLE_SPEC §7.
export function drawPlaceholder(scene, x, y, w, h, label) {
  const g = scene.add.graphics().setDepth(-50);
  g.fillStyle(0xff00ff, 0.35);
  g.fillRect(x, y, w, h);
  g.lineStyle(2, 0xff00ff, 1);
  g.strokeRect(x, y, w, h);
  const t = scene.add.text(x + w / 2, y + h / 2, `MISSING\n${label}.png`, {
    fontSize: '12px', color: '#ffffff', fontFamily: 'monospace', align: 'center',
    backgroundColor: '#aa0066', padding: { x: 4, y: 2 },
  }).setOrigin(0.5).setDepth(-49);
  return { g, t };
}
```

- [ ] **Step 2: Cliff sprite-or-placeholder**

Update `drawTerrain()`:
```js
drawTerrain() {
  const { left, right } = this.level.terrain;
  for (const [side, key] of [[left, 'cliff-left'], [right, 'cliff-right']]) {
    if (this.textures.exists(key) && assets.has(key)) {
      // Sprite path: anchor at the polygon's bounding-box top-left.
      const xs = side.verts.map(v => v.x);
      const ys = side.verts.map(v => v.y);
      const x0 = Math.min(...xs), y0 = Math.min(...ys);
      const x1 = Math.max(...xs), y1 = Math.max(...ys);
      this.add.image(x0, y0, key).setOrigin(0, 0)
        .setDisplaySize(x1 - x0, y1 - y0).setDepth(-40);
    } else {
      // Placeholder: bbox of the terrain polygon.
      const xs = side.verts.map(v => v.x);
      const ys = side.verts.map(v => v.y);
      const x0 = Math.min(...xs), y0 = Math.min(...ys);
      const x1 = Math.max(...xs), y1 = Math.max(...ys);
      drawPlaceholder(this, x0, y0, x1 - x0, y1 - y0, key);
    }
  }
}
```
Add import: `import { assets } from '../systems/assets.js';` and `import { drawPlaceholder } from '../utils/placeholderRect.js';`.

- [ ] **Step 3: Vehicle sprite-or-placeholder**

In `redrawVehicle()`, before the existing chassis polygon draw, check the active vehicle's key:
```js
redrawVehicle() {
  const info = physics.getVehicleVisualState?.();
  if (!info) return;
  const key = this._vehiclePreset;     // 'car' | 'truck' | 'tank'
  if (this.textures.exists(key) && assets.has(key)) {
    // Use a single image sprite per redraw; cheap enough for one vehicle.
    if (!this._vehicleSprite) {
      this._vehicleSprite = this.add.image(0, 0, key).setOrigin(0.5, 0.5).setDepth(2);
    } else {
      this._vehicleSprite.setTexture(key).setVisible(true);
    }
    this._vehicleSprite.setPosition(info.x, info.y).setRotation(info.angle);
    this.vehicleGraphics.clear();
  } else {
    // Fallback: existing rectangle render via vehicleGraphics is fine as a
    // placeholder — it's already obviously abstract, not pretending to be 3D.
    this._vehicleSprite?.setVisible(false);
    // ... existing polygon draw path stays ...
  }
}
```
Leave the existing graphics-based render in the `else` branch.

- [ ] **Step 4: Commit**

```bash
git add src/utils/placeholderRect.js src/scenes/LevelScene.js
git commit -m "feat(world): cliff/vehicle sprite-or-placeholder rendering"
```

---

## Done criteria

- Sky gradient visible on level load (no more flat gray).
- Asset loader runs without crashing on missing files; console lists missing keys.
- When an asset PNG is dropped into `src/assets/world/`, it renders automatically next reload.
- Tests stay green (same 2 pre-existing physics failures only).
