// src/scenes/LevelScene.js
import Phaser from 'phaser';
import GUI from 'lil-gui';
import { ALL_LEVELS, LEVEL_ORDER } from '../data/leveldata.js';
import physics from '../systems/physics.js';
import tutorial from '../systems/tutorial.js';
import { expandPrebuilt } from '../utils/prebuilt.js';
import { resolveVehicleDesign } from '../utils/vehicleDesign.js';
import audio from '../systems/audio.js';
import juice from '../systems/juice.js';
import cam from '../systems/camera.js';
import { findBeamSnap, nearestPointOnSegment } from '../utils/snapGeometry.js';
import { GhostBeam } from '../ui/GhostBeam.js';
import { bus } from '../ui-html/bus.js';
import { assets } from '../systems/assets.js';
import { saveLayout, loadLayout, hasSave } from '../systems/saveload.js';

const SAG_DEPTH_FACTOR = 0.10;

// True if the pointer is over an HTML chrome region (top bar, sidebar, toolbar, HUD).
// Phaser-side click/hover handlers must skip these events so the DOM owns them.
function isOverHtmlChrome(pointer) {
  if (typeof document === 'undefined') return false;
  const el = document.elementFromPoint(pointer.x, pointer.y);
  return !!el?.closest('#ui-topbar, #ui-sidebar, #ui-toolbar, #ui-hud, #ui-modals');
}

const VIZ = {
  // Stress visual thresholds (independent of snap tuning)
  STRAIN_MED:  0.05,
  STRAIN_HIGH: 0.20,
  STRAIN_CRIT: 0.50,

  // Road beam (black deck)
  ROAD_COLOR:      0x1a1a1a,
  ROAD_THICKNESS:  8,

  // Wood beam (orange structural)
  BEAM_COLOR:      0xd48a0c,
  BEAM_THICKNESS:  4,

  // Kept for stress overlay reuse
  BEAM_BASE_THICKNESS: 6,

  // Stress overlay — traffic-light colour progression (green → yellow → red)
  OVERLAY_COLOR_MED:  0x44ff44,   // bright green
  OVERLAY_COLOR_HIGH: 0xffee00,   // bright yellow
  OVERLAY_COLOR_CRIT: 0xff1111,   // red
  OVERLAY_THICKNESS_BONUS: 3,     // MED stage bonus px
  OVERLAY_THICKNESS_HIGH:  8,     // HIGH stage bonus px
  OVERLAY_THICKNESS_CRIT:  14,    // CRIT stage bonus px
  OVERLAY_ALPHA_BASE: 0.50,
  OVERLAY_ALPHA_PULSE: 0.45,
  PULSE_HZ_MED:  2.0,
  PULSE_HZ_HIGH: 4.5,
  PULSE_HZ_CRIT: 2.0,             // slow glow — 8Hz was a photosensitivity risk

  // Crack hatching at CRIT
  CRACK_COUNT: 6,
  CRACK_LENGTH: 12,
  CRACK_COLOR: 0x1a0a0a,

  // Joint visuals — Poly Bridge palette
  ANCHOR_COLOR: 0xdd2222,
  ANCHOR_RADIUS: 10,
  JOINT_COLOR: 0xf5d400,
  JOINT_RADIUS: 7,
  JOINT_RING_COLOR: 0xc8aa00,
  JOINT_GLOW_COLOR_MED:  0x44ff44,
  JOINT_GLOW_COLOR_HIGH: 0xffee00,
  JOINT_GLOW_COLOR_CRIT: 0xff1111,
  JOINT_GLOW_RADIUS_MAX: 22,
  JOINT_GLOW_ALPHA_MAX: 0.55,

  // Grid
  GRID_COLOR: 0x9aa0a8,
  GRID_ALPHA: 0.16,
  GRID_STEP:  40,

  // Blueprint build-mode background
  BLUEPRINT_BG:          '#1e2d4a',
  BLUEPRINT_MINOR:       0xffffff,
  BLUEPRINT_MINOR_ALPHA: 0.19,
  BLUEPRINT_MAJOR:       0x7ab8d8,
  BLUEPRINT_MAJOR_ALPHA: 0.19,
  BLUEPRINT_MAJOR_STEP:  160,
  TEST_BG:               '#b2b9c2',
};

// Vehicle presets use human-readable 1–10 scales.
// vehicleParamsFromDesign() converts these to raw physics values at spawn time.
const VEHICLE_PRESETS = [
  { key: 'car',   label: 'CAR',   weight: 3, speed: 7, acceleration: 5, color: 0x2277bb },
  { key: 'truck', label: 'TRUCK', weight: 5, speed: 4, acceleration: 5, color: 0xcc7722 },
  { key: 'tank',  label: 'TANK',  weight: 8, speed: 2, acceleration: 5, color: 0xaa2222 },
];

// Maps 1–10 design scales to Matter.js physics parameters.
//   weight 1–10  → density  0.001–0.050  (log — spans two orders of magnitude)
//   speed  1–10  → driveSpeed  1–8 px/f  (linear)
//   accel  1–10  → driveForceGain 0.0001–0.005  (log)
function vehicleParamsFromDesign({ weight, speed, acceleration }) {
  const t = (v) => (v - 1) / 9;                          // normalise 1–10 → 0–1
  return {
    density:        0.001  * Math.pow(50,   t(weight)),
    driveSpeed:     1      + t(speed) * 7,
    driveForceGain: 0.0001 * Math.pow(50,   t(acceleration)),
  };
}

export class LevelScene extends Phaser.Scene {
  constructor() {
    super('LevelScene');
  }

  init(data) {
    this.levelId = data.levelId || 'L01';
    this.level = ALL_LEVELS[this.levelId];
    this.beams = [];
    this.pendingJointA = null;
    this.joints = [
      ...this.level.anchors.map(a => ({ x: a.x, y: a.y, isAnchor: true, bodyId: a.id })),
      ...(this.level.rocks ?? []).flatMap(rock =>
        (rock.anchors ?? []).map(a => ({ x: a.x, y: a.y, isAnchor: true, bodyId: a.id }))
      ),
    ];
    this.SNAP_RADIUS = 20;
    this._firstBreakPos = null;
    this._debris = [];
    this._blockState = { freeform: false, material: null, size: null, blockLength: 0 };
    this._undoStack  = [];
    this._freeformPendingNewJoint = null;
    this._removeMode = false;
    this._ui = this.level.ui ?? {};
    this._prebuiltCost = expandPrebuilt(this.level).cost;
    this._applyPrebuilt();
  }

  create() {
    this.drawSky();
    this.drawClouds();
    // this._blueprintGrid = this.drawBlueprintGrid();
    // this._testGrid      = this.drawTestGrid();
    this._setBlueprintMode();            // start in build mode
    this.drawTerrain();
    this.drawRocks();
    this.drawWater();
    // Checkpoint sits midway across the right landmass — the car must drive
    // onto the far cliff to clear, not merely touch its near edge.
    const _rightA = this.level.anchors.find(a => a.side === 'right');
    this._checkpointX = _rightA.x + (this.level.worldWidth - _rightA.x) * 0.5;
    this.drawRoads();
    this.drawCheckpoint();

    this.beamsGraphics   = this.add.graphics(); // back: beam bases
    this.stressGraphics  = this.add.graphics(); // mid: stress overlay (test mode only)
    this.jointsGraphics  = this.add.graphics(); // front: anchor circles + joint pins + glow
    this.vehicleGraphics = this.add.graphics(); // vehicle chassis + visual wheels
    this._vehicleSprite  = null;
    this._hoverTarget    = null;
    this.ghostGraphics   = this.add.graphics();
    this.snapGraphics    = this.add.graphics();
    this._debrisGfx      = this.add.graphics().setDepth(5);
    this.snapTarget = null;

    this._onContextMenu = (e) => e.preventDefault();
    this.sys.game.canvas.addEventListener('contextmenu', this._onContextMenu);
    this.input.on('pointerdown', (pointer) => {
      if (pointer.rightButtonDown()) {
        this._handleRightClickDelete(pointer);
      } else {
        this.handleClick(pointer);
      }
    });
    this.input.on('pointermove', (pointer) => this.handleHover(pointer));

    physics.attach(this);
    physics.buildTerrain(this.level.terrain);
    physics.buildRocks(this.level.rocks ?? []);

    // Create anchor bodies and add them to the joints registry by id.
    for (const a of this.level.anchors) {
      physics.ensureJointNode(a.id, a.x, a.y, /* isAnchor */ true);
      // Match data joint to physics body for snap-back resolution.
      const dataJoint = this.joints.find(j => j.x === a.x && j.y === a.y);
      if (dataJoint) dataJoint.bodyId = a.id;
    }

    audio.attach(this);
    juice.attach(this);
    cam.attach(this);
    tutorial.attach(this);
    if (this.level.prebuilt) this.rebuildBridge(); // creates constraints for prebuilt beams

    physics.setOnSnap((c) => {
      const mx = (c.bodyA.position.x + c.bodyB.position.x) / 2;
      const my = (c.bodyA.position.y + c.bodyB.position.y) / 2;
      audio.stopCreak(c);

      // First-break marker — set only on the first snap in this test run.
      if (!this._firstBreakPos) this._firstBreakPos = { x: mx, y: my };

      this._spawnDebris(c);
      this.onBeamSnapped();
    });
    this.winOverlay = null;
    this.failOverlay = null;
    this.testEndAt = 0; // when > 0, auto-return to build mode at this timestamp

    this.mode = 'build';                 // 'build' | 'test'
    this.material = this.level.materials.road; // default: road placement
    const _fresh0 = this._freshBudget();
    this._budgetRoad = _fresh0.road;
    this._budgetWood = _fresh0.wood;
    this.beamConstraints = [];           // mirrors physics._beamConstraints, for rendering

    this._vehiclePreset = this.level.vehicles[0]?.type ?? VEHICLE_PRESETS[0].key;
    // Seed the cheat sliders from the level's actually-resolved vehicle so the
    // panel reflects (and, via toggleTest, controls) the real spawned vehicle.
    const _design0 = resolveVehicleDesign(this.level, VEHICLE_PRESETS, this._vehiclePreset);
    this._cheatParams = {
      weight:              _design0.weight,
      speed:               _design0.speed,
      acceleration:        _design0.acceleration,
      roadStiffness:       this.level.materials.road.stiffness,
      roadSnapThreshold:   this.level.materials.road.snapThreshold,
      beamStiffness:       this.level.materials.wood?.stiffness ?? 0.15,
      beamSnapThreshold:   this.level.materials.wood?.snapThreshold ?? 0.18,
      visualFullStrain:    0.05,
      strainMed:           VIZ.STRAIN_MED,
      strainHigh:          VIZ.STRAIN_HIGH,
      strainCrit:          VIZ.STRAIN_CRIT,
      gravityY:            this.level.gravity?.y ?? 1.5,
    };
    this._buildCheatGui();
    physics.setVisualFullStrain(this._cheatParams.visualFullStrain);

    this._ghost = new GhostBeam(this);

    // Keyboard shortcuts route through the bus so the HTML toolbar stays in sync.
    this.input.keyboard.on('keydown-R', () => bus.emit('tool:select', 'road'));
    this.input.keyboard.on('keydown-B', () => {
      if (this.level.materials.wood) bus.emit('tool:select', 'beam');
    });
    this.input.keyboard.on('keydown-F', () => bus.emit('tool:select', 'free'));
    this.input.keyboard.on('keydown-Z', (ev) => { if (ev.ctrlKey || ev.metaKey) this._undoLastPlacement(); });
    this.input.keyboard.on('keydown-ONE',   () => this._selectVehicle('car'));
    this.input.keyboard.on('keydown-TWO',   () => this._selectVehicle('truck'));
    this.input.keyboard.on('keydown-THREE', () => this._selectVehicle('tank'));

    // Start paused: pause Matter until the player hits TEST.
    physics.setRunnerEnabled(false);
    this.redrawJoints(new Map());
    this.redrawBeams();

    // ── HTML UI bus wiring ──────────────────────────────────────────────────
    this._busHandlers = {
      undo:          () => this._undoLastPlacement(),
      clear:         () => this.hardReset(),
      modeToggle:    () => this.toggleTest(),
      vehicleSelect: (k) => this._selectVehicle(k),
      toolSelect:    (k) => this._onToolSelect(k),
      sizeSelect:    (k) => this._onSizeSelect(k),
      gravityPreset: (k) => this._applyGravityPreset(k),
      layoutSave:    () => this._handleSave(),
      layoutLoad:    () => this._handleLoad(),
      levelRetry: () => { if (this.mode === 'test') this.toggleTest(); },
      levelNext:  () => {
        const i = LEVEL_ORDER.indexOf(this.levelId);
        const next = i >= 0 ? LEVEL_ORDER[i + 1] : null;
        if (next) this.scene.start('LevelScene', { levelId: next });
      },
      levelMenu:  () => this.scene.start('MenuScene'),
    };
    bus.on('undo',           this._busHandlers.undo);
    bus.on('clear',          this._busHandlers.clear);
    bus.on('mode:toggle',    this._busHandlers.modeToggle);
    bus.on('vehicle:select', this._busHandlers.vehicleSelect);
    bus.on('tool:select',    this._busHandlers.toolSelect);
    bus.on('size:select',    this._busHandlers.sizeSelect);
    bus.on('gravity:preset', this._busHandlers.gravityPreset);
    bus.on('layout:save',    this._busHandlers.layoutSave);
    bus.on('layout:load',    this._busHandlers.layoutLoad);
    bus.on('level:retry', this._busHandlers.levelRetry);
    bus.on('level:next',  this._busHandlers.levelNext);
    bus.on('level:menu',  this._busHandlers.levelMenu);

    // Initial sync — listeners are now wired in mountUi() (runs before Phaser).
    bus.emit('ui:screen', 'level');
    bus.emit('ui:config', this._ui);
    this._updateBudgetDisplay();
    bus.emit('vehicle:active', this._vehiclePreset);
    bus.emit('mode:changed', 'build');
    bus.emit('tool:select', 'road');
    bus.emit('layout:load-available', hasSave(this.levelId));
    tutorial.showIntro(this.level);

    this.events.on('shutdown', () => {
      physics.detach(this);
      audio.detach(this);
      juice.detach(this);
      cam.detach(this);
      tutorial.detach(this);
      this._gui?.destroy();
      this._ghost?.destroy();
      bus.off('undo',           this._busHandlers.undo);
      bus.off('clear',          this._busHandlers.clear);
      bus.off('mode:toggle',    this._busHandlers.modeToggle);
      bus.off('vehicle:select', this._busHandlers.vehicleSelect);
      bus.off('tool:select',    this._busHandlers.toolSelect);
      bus.off('size:select',    this._busHandlers.sizeSelect);
      bus.off('gravity:preset', this._busHandlers.gravityPreset);
      bus.off('layout:save',    this._busHandlers.layoutSave);
      bus.off('layout:load',    this._busHandlers.layoutLoad);
      bus.off('level:retry', this._busHandlers.levelRetry);
      bus.off('level:next',  this._busHandlers.levelNext);
      bus.off('level:menu',  this._busHandlers.levelMenu);
      this.sys.game.canvas.removeEventListener('contextmenu', this._onContextMenu);
    });
  }

  drawSky() {
    const { worldWidth: w, worldHeight: h } = this.level;
    if (this.textures.exists('background') && assets.has('background')) {
      this._skyGfx = this.add.image(0, 0, 'background')
        .setOrigin(0, 0).setDisplaySize(w, h).setDepth(-100);
      this.cameras.main.setBackgroundColor('#5DBFF0');
      return;
    }
    const g = this.add.graphics().setDepth(-100);
    const topR = 0x5D, topG = 0xBF, topB = 0xF0;
    const botR = 0xBD, botG = 0xE7, botB = 0xFB;
    const STEPS = 60;
    for (let i = 0; i < STEPS; i++) {
      const t = i / (STEPS - 1);
      const r = Math.round(topR * (1 - t) + botR * t);
      const gC = Math.round(topG * (1 - t) + botG * t);
      const b = Math.round(topB * (1 - t) + botB * t);
      g.fillStyle((r << 16) | (gC << 8) | b, 1);
      g.fillRect(0, Math.floor((i * h) / STEPS), w, Math.ceil(h / STEPS) + 1);
    }
    this._skyGfx = g;
    this.cameras.main.setBackgroundColor('#5DBFF0');
  }

  drawClouds() {
    const { worldWidth: w, worldHeight: h } = this.level;
    const CLOUD_SIZES = { 'cloud-1': [140, 70], 'cloud-2': [180, 70], 'cloud-3': [90, 45] };
    const placements = [
      { key: 'cloud-1', xFrac: 0.15, yFrac: 0.08 },
      { key: 'cloud-3', xFrac: 0.38, yFrac: 0.05 },
      { key: 'cloud-2', xFrac: 0.60, yFrac: 0.10 },
      { key: 'cloud-1', xFrac: 0.80, yFrac: 0.06 },
      { key: 'cloud-3', xFrac: 0.92, yFrac: 0.12 },
    ];
    for (const { key, xFrac, yFrac } of placements) {
      if (!this.textures.exists(key) || !assets.has(key)) continue;
      const [dw, dh] = CLOUD_SIZES[key];
      this.add.image(xFrac * w, yFrac * h, key)
        .setDisplaySize(dw, dh)
        .setDepth(-50)
        .setAlpha(0.9);
    }
  }

  // drawBlueprintGrid() {
  //   const g = this.add.graphics();
  //   const { worldWidth: w, worldHeight: h } = this.level;
  //   g.lineStyle(1, VIZ.BLUEPRINT_MINOR, VIZ.BLUEPRINT_MINOR_ALPHA);
  //   for (let x = 0; x <= w; x += VIZ.GRID_STEP) {
  //     g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.strokePath();
  //   }
  //   for (let y = 0; y <= h; y += VIZ.GRID_STEP) {
  //     g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.strokePath();
  //   }
  //   g.lineStyle(1, VIZ.BLUEPRINT_MAJOR, VIZ.BLUEPRINT_MAJOR_ALPHA);
  //   for (let x = 0; x <= w; x += VIZ.BLUEPRINT_MAJOR_STEP) {
  //     g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.strokePath();
  //   }
  //   for (let y = 0; y <= h; y += VIZ.BLUEPRINT_MAJOR_STEP) {
  //     g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.strokePath();
  //   }
  //   return g;
  // }

  // drawTestGrid() {
  //   const g = this.add.graphics().setVisible(false);
  //   g.lineStyle(1, VIZ.GRID_COLOR, VIZ.GRID_ALPHA);
  //   for (let x = 0; x <= this.level.worldWidth; x += VIZ.GRID_STEP) {
  //     g.beginPath(); g.moveTo(x, 0); g.lineTo(x, this.level.worldHeight); g.strokePath();
  //   }
  //   for (let y = 0; y <= this.level.worldHeight; y += VIZ.GRID_STEP) {
  //     g.beginPath(); g.moveTo(0, y); g.lineTo(this.level.worldWidth, y); g.strokePath();
  //   }
  //   return g;
  // }

  _setBlueprintMode() {
    this.cameras.main.setBackgroundColor(VIZ.BLUEPRINT_BG);
    // this._blueprintGrid?.setVisible(true);
    // this._testGrid?.setVisible(false);
  }

  _setTestMode() {
    this.cameras.main.setBackgroundColor(VIZ.TEST_BG);
    // this._blueprintGrid?.setVisible(false);
    // this._testGrid?.setVisible(true);
  }

  drawTerrain() {
    const { left, right } = this.level.terrain;
    const { worldWidth: W } = this.level;
    // Extra pixels each cliff extends beyond the world edge so no gap shows
    // between the sprite and the screen edge at any resolution or camera offset.
    const OVERFLOW = 500;
    // Cliffs whose on-screen landmass is wider than this stretch the directional
    // cliff art badly, so they use the dedicated rocky_cliff face instead. The
    // narrow-landmass (wide-gap) levels keep cliff-left/cliff-right.
    const STRETCHED_CLIFF_MIN_WIDTH = 300;
    for (const [side, isLeft] of [[left, true], [right, false]]) {
      const xs = side.verts.map(v => v.x);
      const ys = side.verts.map(v => v.y);
      const x0 = Math.min(...xs), y0 = Math.min(...ys);
      const x1 = Math.max(...xs), y1 = Math.max(...ys);
      // On-screen landmass width (excludes the off-screen OVERFLOW extension).
      const landWidth = isLeft ? (x1 - x0) : (W - x0);
      const useRocky = landWidth >= STRETCHED_CLIFF_MIN_WIDTH
        && this.textures.exists('rocky_cliff') && assets.has('rocky_cliff');
      const key = useRocky ? 'rocky_cliff' : (isLeft ? 'cliff-left' : 'cliff-right');
      if (this.textures.exists(key) && assets.has(key)) {
        // Left cliff: stretch leftward past x=0. Right cliff: stretch rightward past worldWidth.
        const imgX = isLeft ? x0 - OVERFLOW : x0;
        const imgW = isLeft ? (x1 - x0) + OVERFLOW : (W - x0) + OVERFLOW;
        const img = this.add.image(imgX, y0, key).setOrigin(0, 0)
          .setDisplaySize(imgW, y1 - y0).setDepth(-40);
        // rocky_cliff is a single image; mirror it on the right so its face
        // points inward toward the gap (cliff-left/right are already directional).
        if (useRocky && !isLeft) img.setFlipX(true);
      } else {
        const g = this.add.graphics();
        g.fillStyle(side.color ?? 0x2c3033, 1);
        g.fillPoints(side.verts, true);
        g.lineStyle(2, 0x1a1d20, 1);
        g.strokePoints(side.verts, true);
      }
    }
  }

  drawRocks() {
    const g = this.add.graphics();
    for (const rock of (this.level.rocks ?? [])) {
      const key = rock.sprite;
      if (key && this.textures.exists(key) && assets.has(key)) {
        const xs = rock.verts.map(v => v.x);
        const ys = rock.verts.map(v => v.y);
        const x0 = Math.min(...xs), y0 = Math.min(...ys);
        const x1 = Math.max(...xs), y1 = Math.max(...ys);
        this.add.image(x0, y0, key).setOrigin(0, 0)
          .setDisplaySize(x1 - x0, y1 - y0).setDepth(-40);
      } else {
        g.fillStyle(rock.color ?? 0x8b6a2e, 1);
        g.fillPoints(rock.verts, true);
        g.lineStyle(2, 0x1a1d20, 1);
        g.strokePoints(rock.verts, true);
      }
    }
  }

  // Spawn point on the starting landmass: far back on the cliff so the vehicle
  // drives a couple seconds across solid ground before reaching the bridge.
  _spawnPoint() {
    const onLeft = (this.level.vehicles[0]?.spawnAt ?? 'left') === 'left';
    const side = onLeft ? 'left' : 'right';
    const anchor = this.level.anchors.find(a => a.side === side);
    const topY = anchor?.y ?? 360;
    const x = onLeft ? 60 : this.level.worldWidth - 60;
    return { x, y: topY - 40 };
  }

  // Visual road strip along each cliff top so the vehicle reads as driving on a
  // proper road over the landmass. Purely cosmetic — the terrain body is the
  // actual collision surface.
  drawRoads() {
    const leftA  = this.level.anchors.find(a => a.side === 'left');
    const rightA = this.level.anchors.find(a => a.side === 'right');
    const W = this.level.worldWidth;
    const TH = 12;     // road thickness
    const EXT = 280;   // extend past screen edges so no gap shows
    const g = this.add.graphics().setDepth(-38);
    const band = (x0, x1, topY) => {
      g.fillStyle(0x3b4047, 1);
      g.fillRect(x0, topY, x1 - x0, TH);                 // asphalt
      g.fillStyle(0x4c535b, 1);
      g.fillRect(x0, topY, x1 - x0, 2);                  // top highlight edge
      g.fillStyle(0x23262a, 1);
      g.fillRect(x0, topY + TH - 2, x1 - x0, 2);         // bottom shade edge
      g.fillStyle(0xf5d54a, 0.85);                       // dashed centre line
      for (let x = x0 + 8; x < x1 - 8; x += 28) g.fillRect(x, topY + TH / 2 - 1, 15, 2);
    };
    band(-EXT, leftA.x, leftA.y);
    band(rightA.x, W + EXT, rightA.y);
  }

  // Goal pennant on the right landmass marking the checkpoint the vehicle must
  // reach. Pole + base are static; the pennant waves with an idle tween.
  drawCheckpoint() {
    const rightA = this.level.anchors.find(a => a.side === 'right');
    const x = this._checkpointX;
    const topY = rightA.y;
    const poleH = 58;

    const g = this.add.graphics().setDepth(-19);
    g.fillStyle(0x000000, 0.18);
    g.fillEllipse(x, topY + 2, 26, 8);                   // ground shadow
    g.fillStyle(0x2b2f33, 1);
    g.fillEllipse(x, topY, 20, 6);                       // base
    g.fillStyle(0xe8eef2, 1);
    g.fillRect(x - 2, topY - poleH, 4, poleH);           // pole
    g.fillStyle(0xf5d54a, 1);
    g.fillCircle(x, topY - poleH, 4);                    // pole knob

    // Waving pennant drawn in local coords so scaleX pivots at the pole.
    const pen = this.add.graphics().setDepth(-18);
    pen.fillStyle(0xe23b3b, 1);
    pen.fillTriangle(2, 2, 42, 13, 2, 24);
    pen.fillStyle(0xffffff, 0.85);
    pen.fillRect(2, 11, 26, 3);                          // accent stripe
    pen.setPosition(x, topY - poleH);
    this.tweens.add({
      targets: pen, scaleX: { from: 1, to: 0.82 },
      duration: 720, yoyo: true, repeat: -1, ease: 'Sine.inOut',
    });
  }

  drawWater() {
    const g = this.add.graphics();
    const { waterY } = this.level.terrain;
    // Main water body — dark navy
    g.fillStyle(0x0c1f33, 1);
    g.fillRect(0, waterY, this.level.worldWidth, this.level.worldHeight - waterY);
    // Surface highlight strip — lighter teal sliver at the waterline
    g.fillStyle(0x1a4a6e, 0.55);
    g.fillRect(0, waterY, this.level.worldWidth, 7);
  }

  findNearestJoint(p) {
    let best = null;
    let bestDist = this.SNAP_RADIUS;
    for (const j of this.joints) {
      const dx = j.x - p.x;
      const dy = j.y - p.y;
      const d = Math.hypot(dx, dy);
      if (d < bestDist) { bestDist = d; best = j; }
    }
    return best;
  }

  handleClick(pointer) {
    if (this.mode !== 'build') return;
    if (isOverHtmlChrome(pointer)) return;
    if (this._removeMode) {
      const target = this._findHoverTarget(pointer.worldX, pointer.worldY);
      if (target?.type === 'beam') this._deleteBeam(target.index);
      else if (target?.type === 'joint') this._deleteJoint(target.index);
      return;
    }
    if (this._blockState.freeform) {
      this._handleFreeformClick(pointer);
    } else if (this._blockState.material && this._blockState.size) {
      this._handleBlockPlace();
    }
  }

  _handleFreeformClick(pointer) {
    const raw = { x: pointer.worldX, y: pointer.worldY };
    // Snap to existing joints so beams connect to anchors and other nodes.
    // Beam-midpoint split (findBeamSnap) is disabled — no mid-beam insertion.
    const jointSnap = this.findNearestJoint(raw);
    const p = jointSnap ? { x: jointSnap.x, y: jointSnap.y, bodyId: jointSnap.bodyId } : raw;

    if (!this.pendingJointA) {
      const isNew = !p.bodyId;
      this.pendingJointA = isNew ? this.registerNewJoint(p) : p;
      this._freeformPendingNewJoint = isNew ? this.pendingJointA : null;
    } else {
      const cost = this.material.cost;
      const freeformPool = this.material.type === 'road' ? '_budgetRoad' : '_budgetWood';
      if (this[freeformPool] < cost) {
        this._flashBudget(this.material.type);
        this.pendingJointA = null;
        return;
      }
      const endpointIsNew = !p.bodyId;
      const endpoint = endpointIsNew ? this.registerNewJoint(p) : p;
      const matA = physics._nodes.get(this.pendingJointA.bodyId);
      const matB = physics._nodes.get(endpoint.bodyId);
      const constraint = physics.buildBeam(matA, matB, this.material);
      const beam = { a: this.pendingJointA, b: endpoint, material: this.material, constraint, cost };
      this.beams.push(beam);
      const newJoints = [];
      if (this._freeformPendingNewJoint) newJoints.push(this._freeformPendingNewJoint);
      if (endpointIsNew) newJoints.push(endpoint);
      this._undoStack.push({ beam, newJoints, cost });
      this._updateUndoBtn();
      this._freeformPendingNewJoint = null;
      this[freeformPool] -= cost;
      this._updateBudgetDisplay();
      this.pendingJointA = null;
      this.redrawBeams();
      this.redrawJoints(new Map());
    }
  }

  _handleBlockPlace() {
    const placement = this._ghost.getPlacement();
    if (!placement) { this._flashBudget(this._blockState.material?.type); return; }

    const mat = this._blockState.material;
    const cost = mat.blocks[this._blockState.size].cost;
    const blockPool = mat.type === 'road' ? '_budgetRoad' : '_budgetWood';
    if (this[blockPool] < cost) { this._flashBudget(mat.type); return; }

    const { anchorJoint, farEnd, farJoint } = placement;
    const jointsBefore = this.joints.length;
    const endJoint = farJoint
      ? { x: farJoint.x, y: farJoint.y, bodyId: farJoint.bodyId }
      : this.registerNewJoint(farEnd);
    const newJoints = this.joints.slice(jointsBefore);

    const bodyA = physics._nodes.get(anchorJoint.bodyId);
    const bodyB = physics._nodes.get(endJoint.bodyId);
    if (!bodyA || !bodyB) return;

    const constraint = physics.buildBeam(bodyA, bodyB, mat);
    const beam = { a: anchorJoint, b: endJoint, material: mat, constraint, cost };
    this.beams.push(beam);
    this._undoStack.push({ beam, newJoints, cost });
    this._updateUndoBtn();
    this[blockPool] -= cost;
    this._updateBudgetDisplay();
    this.redrawBeams();
    this.redrawJoints(new Map());
  }

  registerNewJoint(p) {
    const id = 'j' + (this.joints.length + 1);
    this.joints.push({ x: p.x, y: p.y, isAnchor: false, bodyId: id });
    physics.ensureJointNode(id, p.x, p.y, /* isAnchor */ false);
    return { x: p.x, y: p.y, bodyId: id };
  }

  splitBeam(beamIndex, splitPoint) {
    const beam = this.beams[beamIndex];
    const mat = beam.material;

    physics.removeBeam(beam.constraint);
    this.beams.splice(beamIndex, 1);

    const newJoint = this.registerNewJoint(splitPoint);

    const bodyA = physics._nodes.get(beam.a.bodyId);
    const bodyC = physics._nodes.get(newJoint.bodyId);
    const bodyB = physics._nodes.get(beam.b.bodyId);

    const c1 = physics.buildBeam(bodyA, bodyC, mat);
    this.beams.push({ a: beam.a, b: newJoint, material: mat, constraint: c1 });

    const c2 = physics.buildBeam(bodyC, bodyB, mat);
    this.beams.push({ a: newJoint, b: beam.b, material: mat, constraint: c2 });

    return newJoint;
  }


  _undoLastPlacement() {
    if (this.mode !== 'build') return;

    // Mid-freeform (first click placed, waiting for second): cancel it.
    if (this.pendingJointA) {
      if (this._freeformPendingNewJoint) {
        physics.removeJointNode(this._freeformPendingNewJoint.bodyId);
        const ji = this.joints.indexOf(this._freeformPendingNewJoint);
        if (ji !== -1) this.joints.splice(ji, 1);
        this._freeformPendingNewJoint = null;
      }
      this.pendingJointA = null;
      this.redrawBeams();
      this.redrawJoints(new Map());
      return;
    }

    if (!this._undoStack.length) return;
    const { beam, newJoints, cost } = this._undoStack.pop();

    physics.removeBeam(beam.constraint);
    const bi = this.beams.indexOf(beam);
    if (bi !== -1) this.beams.splice(bi, 1);

    for (const j of newJoints) {
      physics.removeJointNode(j.bodyId);
      const ji = this.joints.indexOf(j);
      if (ji !== -1) this.joints.splice(ji, 1);
    }

    const undoPool = beam.material.type === 'road' ? '_budgetRoad' : '_budgetWood';
    this[undoPool] += cost;
    this._updateBudgetDisplay();
    this._updateUndoBtn();
    this.redrawBeams();
    this.redrawJoints(new Map());
  }

  _updateUndoBtn() {
    // HTML chrome manages its own visual state; this hook stays for the bus seam.
  }

  // Keep as thin wrapper for callers in hardReset that need a default state.
  _selectMaterial(type) {
    bus.emit('tool:select', type === 'road' ? 'road' : 'beam');
  }

  _updateBudgetDisplay() {
    bus.emit('budget:update', {
      road: this._budgetRoad,
      wood: this.level.budget.wood != null ? this._budgetWood : null,
    });
  }

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

  _flashBudget(materialType) {
    bus.emit('budget:flash', materialType);
  }

  _selectVehicle(key) {
    if (this._ui.vehicleSelect === false) return;
    const preset = VEHICLE_PRESETS.find(p => p.key === key);
    if (!preset) return;
    this._vehiclePreset = key;
    bus.emit('vehicle:active', key);
    this._cheatParams.weight       = preset.weight;
    this._cheatParams.speed        = preset.speed;
    this._cheatParams.acceleration = preset.acceleration;
    // Sync GUI sliders so the dev panel reflects the preset values.
    this._guiWeightCtrl?.updateDisplay();
    this._guiSpeedCtrl?.updateDisplay();
    this._guiAccelCtrl?.updateDisplay();
  }

  // Full hard reset: wipes every beam and joint, exits test mode if running,
  // and returns to a completely fresh build state with only anchors present.
  hardReset() {
    // Exit simulation cleanly if it was running.
    if (this.mode === 'test') {
      physics.setRunnerEnabled(false);
      cam.follow(null);
      this.cameras.main.scrollX = 0;
      this.cameras.main.scrollY = 0;
      juice.reset();
      this.winOverlay?.destroy();  this.winOverlay  = null;
      this.failOverlay?.destroy(); this.failOverlay = null;
      this.testEndAt = 0;
      this.mode = 'build';
      this._setBlueprintMode();
      bus.emit('mode:changed', 'build');
    }
    // Wipe player design and rebuild physics with only anchors.
    this.clearBridgeData();
    this.rebuildBridge();
    this.pendingJointA = null;
    this.snapTarget = null;
    // Clear all graphics layers.
    this.vehicleGraphics?.clear();
    this._vehicleSprite?.setVisible(false);
    this.stressGraphics.clear();
    this.ghostGraphics.clear();
    this.snapGraphics.clear();
    this._debrisGfx.clear();
    this._debris = [];
    this._jointStrain = null;
    this._firstBreakPos = null;
    this._undoStack = [];
    this._freeformPendingNewJoint = null;
    this._updateUndoBtn();
    this._ghost.hide();
    this._blockState = { freeform: false, material: null, size: null, blockLength: 0 };
    this._removeMode = false;
    this._ghost?.hide();
    this.material = this.level.materials.road;
    this.redrawBeams();
    this.redrawJoints(new Map());
    const _freshR = this._freshBudget();
    this._budgetRoad = _freshR.road;
    this._budgetWood = _freshR.wood;
    this._updateBudgetDisplay();
  }

  _findHoverTarget(worldX, worldY) {
    let best = null;
    let bestDist = this.SNAP_RADIUS;

    for (let i = 0; i < this.beams.length; i++) {
      const b = this.beams[i];
      const pt = nearestPointOnSegment({ x: worldX, y: worldY }, b.a, b.b);
      const dist = Math.hypot(pt.x - worldX, pt.y - worldY);
      if (dist < bestDist) {
        bestDist = dist;
        best = { type: 'beam', index: i };
      }
    }

    if (!best) {
      for (let i = 0; i < this.joints.length; i++) {
        const j = this.joints[i];
        if (j.isAnchor) continue;
        const isFree = !this.beams.some(b => b.a.bodyId === j.bodyId || b.b.bodyId === j.bodyId);
        if (!isFree) continue;
        const dist = Math.hypot(j.x - worldX, j.y - worldY);
        if (dist < bestDist) {
          bestDist = dist;
          best = { type: 'joint', index: i };
        }
      }
    }

    return best;
  }

  handleHover(pointer) {
    if (this.mode !== 'build') {
      this._hoverTarget = null;
      return;
    }

    if (isOverHtmlChrome(pointer)) {
      this._hoverTarget = null;
      this._ghost.hide();
      this.snapGraphics.clear();
      this.ghostGraphics.clear();
      return;
    }

    const raw = { x: pointer.worldX, y: pointer.worldY };
    this.snapGraphics.clear();
    this.ghostGraphics.clear();

    if (this._blockState.freeform) {
      // Snap to existing joints; beam-midpoint split (findBeamSnap) is disabled.
      const jointSnap = this.findNearestJoint(raw);

      if (jointSnap) {
        this.snapTarget = { x: jointSnap.x, y: jointSnap.y, bodyId: jointSnap.bodyId };
        this.snapGraphics.lineStyle(3, VIZ.JOINT_COLOR, 0.9);
        this.snapGraphics.strokeCircle(jointSnap.x, jointSnap.y, VIZ.JOINT_RADIUS + 5);
      } else {
        this.snapTarget = null;
      }

      if (this.pendingJointA) {
        const to = this.snapTarget ?? raw;
        this.ghostGraphics.lineStyle(2, 0xffffff, 0.4);
        this.ghostGraphics.beginPath();
        this.ghostGraphics.moveTo(this.pendingJointA.x, this.pendingJointA.y);
        this.ghostGraphics.lineTo(to.x, to.y);
        this.ghostGraphics.strokePath();
      }

    } else if (this._blockState.material && this._blockState.size) {
      // Block mode: ghost beam follows cursor
      this._ghost.show();
      this._ghost.update(raw, this.joints, this._blockState.blockLength, this.SNAP_RADIUS, this._blockState.material);
    } else {
      this._ghost.hide();
    }

    this._hoverTarget = this._findHoverTarget(pointer.worldX, pointer.worldY);
  }

  // Build-mode base draw: road = thick black, beam = thinner orange.
  redrawBeams() {
    this.beamsGraphics.clear();
    for (const beam of this.beams) {
      const isRoad = beam.material?.type === 'road';
      this.beamsGraphics.lineStyle(
        isRoad ? VIZ.ROAD_THICKNESS : VIZ.BEAM_THICKNESS,
        isRoad ? VIZ.ROAD_COLOR     : VIZ.BEAM_COLOR, 1);
      this.beamsGraphics.beginPath();
      this.beamsGraphics.moveTo(beam.a.x, beam.a.y);
      this.beamsGraphics.lineTo(beam.b.x, beam.b.y);
      this.beamsGraphics.strokePath();
    }
    if (this._hoverTarget?.type === 'beam') {
      const hb = this.beams[this._hoverTarget.index];
      if (hb) {
        this.beamsGraphics.lineStyle(4, 0xff2222, 1);
        this.beamsGraphics.beginPath();
        this.beamsGraphics.moveTo(hb.a.x, hb.a.y);
        this.beamsGraphics.lineTo(hb.b.x, hb.b.y);
        this.beamsGraphics.strokePath();
      }
    }
  }

  // Map strain [0,1] to overlay style based on VIZ thresholds.
  // Returns null if below STRAIN_MED (no overlay).
  overlayStyleForStrain(s) {
    if (s < VIZ.STRAIN_MED) return null;
    let color, hz, thickness;
    if (s < VIZ.STRAIN_HIGH) {
      color = VIZ.OVERLAY_COLOR_MED;
      hz = VIZ.PULSE_HZ_MED;
      thickness = VIZ.BEAM_BASE_THICKNESS + VIZ.OVERLAY_THICKNESS_BONUS;
    } else if (s < VIZ.STRAIN_CRIT) {
      color = VIZ.OVERLAY_COLOR_HIGH;
      hz = VIZ.PULSE_HZ_HIGH;
      thickness = VIZ.BEAM_BASE_THICKNESS + VIZ.OVERLAY_THICKNESS_HIGH;
    } else {
      color = VIZ.OVERLAY_COLOR_CRIT;
      hz = VIZ.PULSE_HZ_CRIT;
      thickness = VIZ.BEAM_BASE_THICKNESS + VIZ.OVERLAY_THICKNESS_CRIT;
    }
    return { color, hz, thickness };
  }

  // Test-mode base draw: road = thick black bezier curve (droops with strain),
  // beam = thinner orange straight line.
  redrawBeamBases() {
    this.beamsGraphics.clear();
    for (const { constraint, type } of physics._beamConstraints) {
      const isRoad = type === 'road';
      this.beamsGraphics.lineStyle(
        isRoad ? VIZ.ROAD_THICKNESS : VIZ.BEAM_THICKNESS,
        isRoad ? VIZ.ROAD_COLOR     : VIZ.BEAM_COLOR, 1);
      const aX = constraint.bodyA.position.x, aY = constraint.bodyA.position.y;
      const bX = constraint.bodyB.position.x, bY = constraint.bodyB.position.y;
      const midX = (aX + bX) / 2;
      const midY = (aY + bY) / 2;
      this.beamsGraphics.beginPath();
      this.beamsGraphics.moveTo(aX, aY);
      if (isRoad) {
        const segLen = Math.hypot(bX - aX, bY - aY);
        const strain = physics.readStrainVisual(constraint);
        const sagDepth = strain * segLen * SAG_DEPTH_FACTOR;
        // Phaser Graphics has no quadraticCurveTo — approximate with 8 line segments.
        // Quadratic bezier: P0=start, P1=control (midX, midY+sagDepth*2), P2=end
        const cpX = midX, cpY = midY + sagDepth * 2;
        const STEPS = 8;
        for (let i = 1; i <= STEPS; i++) {
          const t = i / STEPS;
          const u = 1 - t;
          const px = u * u * aX + 2 * u * t * cpX + t * t * bX;
          const py = u * u * aY + 2 * u * t * cpY + t * t * bY;
          this.beamsGraphics.lineTo(px, py);
        }
      } else {
        this.beamsGraphics.lineTo(bX, bY);
      }
      this.beamsGraphics.strokePath();
    }
  }

  // Test-mode-only stress overlay. Draws on top of the brown base:
  //   - pulsing colored stroke above each loaded beam
  //   - perpendicular wobble offset at CRIT strain
  //   - crack hatches at CRIT strain
  // Returns Map<jointBody, maxStrain> for the joints pass to consume.
  redrawStressOverlay() {
    this.stressGraphics.clear();
    const jointStrain = new Map();
    const t = this.time.now / 1000;

    for (const { constraint } of physics._beamConstraints) {
      const s = physics.readStrainVisual(constraint);

      // Track max strain per joint regardless of whether overlay draws.
      const prevA = jointStrain.get(constraint.bodyA) ?? 0;
      const prevB = jointStrain.get(constraint.bodyB) ?? 0;
      if (s > prevA) jointStrain.set(constraint.bodyA, s);
      if (s > prevB) jointStrain.set(constraint.bodyB, s);

      const style = this.overlayStyleForStrain(s);
      if (!style) continue;

      let aX = constraint.bodyA.position.x, aY = constraint.bodyA.position.y;
      let bX = constraint.bodyB.position.x, bY = constraint.bodyB.position.y;

      // Wobble at CRIT (perpendicular sinusoidal offset on both endpoints).
      if (s >= VIZ.STRAIN_CRIT) {
        const perp = { x: -(bY - aY), y: (bX - aX) };
        const pm = Math.hypot(perp.x, perp.y) || 1;
        perp.x /= pm; perp.y /= pm;
        const wobble = Math.sin(t * 2 * Math.PI * 10) * 1.5;
        aX += perp.x * wobble; aY += perp.y * wobble;
        bX += perp.x * wobble; bY += perp.y * wobble;
      }

      const alpha = VIZ.OVERLAY_ALPHA_BASE
        + VIZ.OVERLAY_ALPHA_PULSE * 0.5 * (1 + Math.sin(2 * Math.PI * style.hz * t));
      const thickness = style.thickness;

      this.stressGraphics.lineStyle(thickness, style.color, alpha);
      this.stressGraphics.beginPath();
      this.stressGraphics.moveTo(aX, aY);
      this.stressGraphics.lineTo(bX, bY);
      this.stressGraphics.strokePath();

      // Crack hatching at CRIT.
      if (s >= VIZ.STRAIN_CRIT) this.drawCrackHatches(aX, aY, bX, bY);
    }

    return jointStrain;
  }

  // Short perpendicular hash marks scattered along a beam, evoking cracking
  // wood. Deterministic spacing (not time-jittered) so it reads as fracture,
  // not noise.
  drawCrackHatches(aX, aY, bX, bY) {
    const dx = bX - aX, dy = bY - aY;
    const len = Math.hypot(dx, dy) || 1;
    const ux = dx / len, uy = dy / len;       // along beam
    const px = -uy, py = ux;                  // perpendicular
    const half = VIZ.CRACK_LENGTH / 2;
    this.stressGraphics.lineStyle(1, VIZ.CRACK_COLOR, 0.85);
    for (let i = 0; i < VIZ.CRACK_COUNT; i++) {
      const f = (i + 0.5) / VIZ.CRACK_COUNT;  // 0..1 along beam
      const cx = aX + ux * len * f;
      const cy = aY + uy * len * f;
      this.stressGraphics.beginPath();
      this.stressGraphics.moveTo(cx - px * half, cy - py * half);
      this.stressGraphics.lineTo(cx + px * half, cy + py * half);
      this.stressGraphics.strokePath();
    }
  }

  // Render anchors as bolted plates (no animation) and mid-joints as pins
  // with optional load-reactive glow. jointStrain is a Map<jointBody, [0,1]>
  // built by redrawStressOverlay; pass an empty Map in build mode.
  redrawJoints(jointStrain) {
    this.jointsGraphics.clear();
    for (const body of physics._nodes.values()) {
      const x = body.position.x;
      const y = body.position.y;

      if (body.label === 'anchor') {
        // Poly Bridge-style: filled red circle with white ring.
        this.jointsGraphics.lineStyle(2, 0xffffff, 0.9);
        this.jointsGraphics.strokeCircle(x, y, VIZ.ANCHOR_RADIUS + 2);
        this.jointsGraphics.fillStyle(VIZ.ANCHOR_COLOR, 1);
        this.jointsGraphics.fillCircle(x, y, VIZ.ANCHOR_RADIUS);
        continue;
      }

      // Mid-joint pin: optional glow first (so pin draws on top), then ring,
      // then filled pin.
      const s = jointStrain.get(body) ?? 0;
      if (s >= VIZ.STRAIN_MED) {
        let glowInt;
        if (s < VIZ.STRAIN_HIGH) {
          glowInt = VIZ.JOINT_GLOW_COLOR_MED;
        } else if (s < VIZ.STRAIN_CRIT) {
          const denom = Math.max(VIZ.STRAIN_CRIT - VIZ.STRAIN_HIGH, 0.0001);
          const t = Math.min(1, Math.max(0, (s - VIZ.STRAIN_HIGH) / denom));
          const gc = Phaser.Display.Color.Interpolate.ColorWithColor(
            Phaser.Display.Color.IntegerToColor(VIZ.JOINT_GLOW_COLOR_HIGH),
            Phaser.Display.Color.IntegerToColor(VIZ.JOINT_GLOW_COLOR_CRIT),
            100, Math.round(t * 100)
          );
          glowInt = (gc.r << 16) | (gc.g << 8) | gc.b;
        } else {
          glowInt = VIZ.JOINT_GLOW_COLOR_CRIT;
        }
        this.jointsGraphics.fillStyle(glowInt, VIZ.JOINT_GLOW_ALPHA_MAX * s);
        this.jointsGraphics.fillCircle(x, y, VIZ.JOINT_GLOW_RADIUS_MAX * s);
      }
      this.jointsGraphics.lineStyle(1, VIZ.JOINT_RING_COLOR, 1);
      this.jointsGraphics.strokeCircle(x, y, VIZ.JOINT_RADIUS + 1);
      this.jointsGraphics.fillStyle(VIZ.JOINT_COLOR, 1);
      this.jointsGraphics.fillCircle(x, y, VIZ.JOINT_RADIUS);
    }
    if (this._hoverTarget?.type === 'joint') {
      const hj = this.joints[this._hoverTarget.index];
      if (hj) {
        this.jointsGraphics.lineStyle(3, 0xff2222, 1);
        this.jointsGraphics.strokeCircle(hj.x, hj.y, VIZ.JOINT_RADIUS + 4);
      }
    }
  }

  // Draws a persistent red X at the first snap point. Cleared each frame and
  // redrawn so the marker survives handleHover() clearing snapGraphics.
  redrawSnapMarkers() {
    this.snapGraphics.clear();
    if (!this._firstBreakPos) return;
    const { x, y } = this._firstBreakPos;
    const half = 10;
    this.snapGraphics.lineStyle(3, 0xff2222, 1);
    this.snapGraphics.beginPath();
    this.snapGraphics.moveTo(x - half, y - half);
    this.snapGraphics.lineTo(x + half, y + half);
    this.snapGraphics.strokePath();
    this.snapGraphics.beginPath();
    this.snapGraphics.moveTo(x + half, y - half);
    this.snapGraphics.lineTo(x - half, y + half);
    this.snapGraphics.strokePath();
  }

  // Spawn rectangular debris chunks when a beam snaps.
  _spawnDebris(c) {
    const ax = c.bodyA.position.x, ay = c.bodyA.position.y;
    const bx = c.bodyB.position.x, by = c.bodyB.position.y;
    const segLen = Math.hypot(bx - ax, by - ay);
    if (segLen < 4) return;
    const segAngle = Math.atan2(by - ay, bx - ax);
    const isRoad = c.material?.type === 'road';
    const color  = isRoad ? 0x3a3a3a : 0x7a5c2e;
    const pieceH = isRoad ? 14 : 7;
    const N = Math.max(2, Math.min(5, Math.round(segLen / 80)));

    for (let i = 0; i < N; i++) {
      const t  = (i + 0.5) / N;
      const cx = ax + (bx - ax) * t;
      const cy = ay + (by - ay) * t;
      const pw = (segLen / N) * 0.80;

      // Half the pieces fly one way perpendicular to the beam, half the other.
      const sign = Math.random() > 0.5 ? 1 : -1;
      const perpSpeed = 0.06 + Math.random() * 0.22;
      const vx = -Math.sin(segAngle) * perpSpeed * sign + (Math.random() - 0.5) * 0.06;
      const vy =  Math.cos(segAngle) * perpSpeed * sign + (Math.random() - 0.5) * 0.06;
      const angVel = (Math.random() - 0.5) * 0.008; // rad/ms
      const life   = 1500 + Math.random() * 1000;

      this._debris.push({ x: cx, y: cy, w: pw, h: pieceH,
        angle: segAngle, vx, vy, angVel, color, life, maxLife: life });
    }
  }

  _updateDebris(delta) {
    const GRAV   = 0.0005; // px/ms² — gentler than game gravity so pieces drift visibly
    const waterY = this.level?.terrain?.waterY ?? 900;
    for (let i = this._debris.length - 1; i >= 0; i--) {
      const d = this._debris[i];
      d.vy    += GRAV * delta;
      d.x     += d.vx * delta;
      d.y     += d.vy * delta;
      d.angle += d.angVel * delta;
      d.life  -= delta;
      if (d.life <= 0 || d.y > waterY + 40) this._debris.splice(i, 1);
    }
  }

  _drawDebris() {
    this._debrisGfx.clear();
    for (const d of this._debris) {
      const alpha  = Math.max(0, d.life / d.maxLife);
      const cos = Math.cos(d.angle), sin = Math.sin(d.angle);
      const hw = d.w / 2, hh = d.h / 2;
      const corners = [
        { x: d.x + (-hw) * cos - (-hh) * sin, y: d.y + (-hw) * sin + (-hh) * cos },
        { x: d.x +   hw  * cos - (-hh) * sin, y: d.y +   hw  * sin + (-hh) * cos },
        { x: d.x +   hw  * cos -   hh  * sin, y: d.y +   hw  * sin +   hh  * cos },
        { x: d.x + (-hw) * cos -   hh  * sin, y: d.y + (-hw) * sin +   hh  * cos },
      ];
      this._debrisGfx.fillStyle(d.color, alpha);
      this._debrisGfx.fillPoints(corners, true);
      this._debrisGfx.lineStyle(1.5, 0xbbbbbb, alpha * 0.45);
      this._debrisGfx.strokePoints(corners, true);
    }
  }

  _buildCheatGui() {
    const p = this._cheatParams;
    const gui = new GUI({ width: 280, title: 'Cheat Panel' });
    this._gui = gui;

    const veh = gui.addFolder('Vehicle  (takes effect at next TEST)');
    this._guiWeightCtrl = veh.add(p, 'weight',       1, 10, 1).name('Weight');
    this._guiSpeedCtrl  = veh.add(p, 'speed',        1, 10, 1).name('Speed');
    this._guiAccelCtrl  = veh.add(p, 'acceleration', 1, 10, 1).name('Acceleration');

    const road = gui.addFolder('Material (Road)');
    road.add(p, 'roadStiffness', 0.05, 1.0, 0.01).name('Stiffness').onChange(v => {
      this.level.materials.road.stiffness = v;
    });
    road.add(p, 'roadSnapThreshold', 0.001, 0.5, 0.001).name('Snap Threshold').onChange(v => {
      this.level.materials.road.snapThreshold = v;
    });

    if (this.level.materials.wood) {
      const beam = gui.addFolder('Material (Beam/Wood)');
      beam.add(p, 'beamStiffness', 0.05, 1.0, 0.01).name('Stiffness').onChange(v => {
        this.level.materials.wood.stiffness = v;
      });
      beam.add(p, 'beamSnapThreshold', 0.001, 0.5, 0.001).name('Snap Threshold').onChange(v => {
        this.level.materials.wood.snapThreshold = v;
      });
    }

    const viz = gui.addFolder('Visual');
    viz.add(p, 'visualFullStrain', 0.001, 0.1, 0.001).name('Full Strain Sat').onChange(v => {
      physics.setVisualFullStrain(v);
    });
    viz.add(p, 'strainMed', 0.01, 0.5, 0.01).name('Strain MED').onChange(v => {
      VIZ.STRAIN_MED = v;
    });
    viz.add(p, 'strainHigh', 0.01, 1.0, 0.01).name('Strain HIGH').onChange(v => {
      VIZ.STRAIN_HIGH = v;
    });
    viz.add(p, 'strainCrit', 0.01, 1.0, 0.01).name('Strain CRIT').onChange(v => {
      VIZ.STRAIN_CRIT = v;
    });

    const phys = gui.addFolder('Physics');
    phys.add(p, 'gravityY', 0.5, 10.0, 0.1).name(`Gravity Y  [level: ${this.level.gravity?.label ?? 'Normal'}]`).onChange(v => {
      physics.setGravity(v);
    });
  }

  toggleTest() {
    if (this.mode === 'build') {
      physics.captureSnapshot();
      this.mode = 'test';
      this.snapTarget = null;
      physics.setTimeScale(1.0);
      physics.setGravity(this._cheatParams.gravityY);
      physics.setRunnerEnabled(true);   // start simulating
      // Cheat panel is the live source of truth for the vehicle — seeded from
      // the resolved design at create(), then editable via the GUI sliders.
      const design = {
        weight:       this._cheatParams.weight,
        speed:        this._cheatParams.speed,
        acceleration: this._cheatParams.acceleration,
      };
      const spawn = this._spawnPoint();
      const vehicleConfig = {
        ...this.level.vehicles[0], // spec §2 rule 3: always an array
        ...vehicleParamsFromDesign(design),
        spawnX: spawn.x,
        spawnY: spawn.y,
      };
      physics.spawnVehicle(vehicleConfig);
      // Frame the whole bridge for the test run instead of chasing the vehicle.
      // World == canvas (1280x720), so zoom 1 / scroll 0 keeps the full span in view.
      cam.follow(null);
      this.cameras.main.setZoom(1.0);
      this.cameras.main.scrollX = 0;
      this.cameras.main.scrollY = 0;
      this.testEndAt = 0;
      this._undoStack = [];
      this._freeformPendingNewJoint = null;
      this._updateUndoBtn();
      this._setTestMode();
      this._ghost.hide();
      tutorial.hideCard();
      this._hoverTarget = null;
      bus.emit('mode:changed', 'test');
    } else {
      // Set mode and clear the auto-return timer FIRST so the update loop
      // cannot re-enter this branch if anything below throws.
      this.mode = 'build';
      this.testEndAt = 0;
      juice.reset();
      this.rebuildBridge();
      cam.follow(null);
      this.cameras.main.setZoom(1.0);
      this.cameras.main.scrollX = 0;
      this.cameras.main.scrollY = 0;
      physics.setRunnerEnabled(false);
      this._setBlueprintMode();
      this.vehicleGraphics?.clear();
      this._vehicleSprite?.setVisible(false);
      this.stressGraphics.clear();
      this._jointStrain = null;
      this._firstBreakPos = null;
      this._debris = [];
      this._debrisGfx.clear();
      this.redrawBeams();
      this.redrawJoints(new Map());
      this.winOverlay?.destroy(); this.winOverlay = null;
      this.failOverlay?.destroy(); this.failOverlay = null;
      const _freshB = this._freshBudget();
      this._budgetRoad = _freshB.road;
      this._budgetWood = _freshB.wood;
      this._updateBudgetDisplay();
      bus.emit('mode:changed', 'build');
    }
  }

  _onToolSelect(toolKey) {
    if (toolKey === 'road' || toolKey === 'beam') {
      // Free-form only: skip block/ghost mode, enter freeform with the selected material.
      this._removeMode = false;
      const matKey = toolKey === 'road' ? 'road' : 'wood';
      const mat = this.level.materials[matKey];
      if (!mat) return;
      this.material = mat;
      this._blockState = { freeform: true, material: null, size: null, blockLength: 0 };
      this._ghost.hide();
      bus.emit('sizes:hide');
    } else if (toolKey === 'free') {
      this._removeMode = false;
      this._blockState.freeform = !this._blockState.freeform;
      this._blockState.material = null;
      this._blockState.size = null;
      this._blockState.blockLength = 0;
      this._ghost.hide();
      this.pendingJointA = null;
      bus.emit('sizes:hide');
    } else if (toolKey === 'remove') {
      if (this._ui.delete === false) return;
      this._removeMode = true;
      this._blockState = { freeform: false, material: null, size: null, blockLength: 0 };
      this.pendingJointA = null;
      this._ghost.hide();
      bus.emit('sizes:hide');
    } else if (toolKey === 'zoom-in') {
      this.cameras.main.setZoom(Math.min(this.cameras.main.zoom * 1.1, 2.5));
    } else if (toolKey === 'zoom-out') {
      this.cameras.main.setZoom(Math.max(this.cameras.main.zoom / 1.1, 0.5));
    }
    // grid / snap / nodes / cable / hydraulic / spring / remove are no-ops in this scope.
  }

  _onSizeSelect(sizeKey) {
    const mat = this._blockState.material;
    if (!mat) return;
    const block = mat.blocks[sizeKey];
    if (!block) return;
    this._blockState.size = sizeKey;
    this._blockState.blockLength = block.length;
    this._ghost.show();
    const sizes = Object.entries(mat.blocks).map(([key, b]) => ({ key, length: b.length, cost: b.cost }));
    bus.emit('sizes:show', { sizes, current: sizeKey });
  }

  _applyGravityPreset(_key) {
    // Hook for future preset list — only 'normal' exists today.
    physics.setGravity?.(this._cheatParams.gravityY);
  }

  // Full level reset: wipe the Matter world, rebuild terrain and rocks, then
  // rebuild every joint and beam from the scene-side data. The player's
  // design (this.joints + this.beams) is preserved across the reset.
  rebuildBridge() {
    physics.reset();
    physics.buildTerrain(this.level.terrain);
    physics.buildRocks(this.level.rocks ?? []);
    for (const j of this.joints) {
      physics.ensureJointNode(j.bodyId, j.x, j.y, j.isAnchor);
    }
    for (const beam of this.beams) {
      const matA = physics._nodes.get(beam.a.bodyId);
      const matB = physics._nodes.get(beam.b.bodyId);
      if (matA && matB) beam.constraint = physics.buildBeam(matA, matB, beam.material ?? this.material);
    }
  }

  // Wipe the player's bridge design. Called before auto-restart after
  // win/fail so the next round starts on an empty level.
  clearBridgeData() {
    this.beams = [];
    this.pendingJointA = null;
    this.joints = [
      ...this.level.anchors.map(a => ({ x: a.x, y: a.y, isAnchor: true, bodyId: a.id })),
      ...(this.level.rocks ?? []).flatMap(rock =>
        (rock.anchors ?? []).map(a => ({ x: a.x, y: a.y, isAnchor: true, bodyId: a.id }))
      ),
    ];
    this._firstBreakPos = null;
    this._debris = [];
    this._applyPrebuilt();
  }

  // Push the level's prebuilt joints/beams into the scene data arrays.
  // Pure data — physics is created by the next rebuildBridge() call.
  _applyPrebuilt() {
    if (!this.level.prebuilt) return;
    const { joints, beams } = expandPrebuilt(this.level);
    this.joints.push(...joints);
    const byId = new Map(this.joints.map(j => [j.bodyId, j]));
    for (const b of beams) {
      const jA = byId.get(b.a);
      const jB = byId.get(b.b);
      if (!jA || !jB) continue;
      this.beams.push({ a: jA, b: jB, material: b.material, cost: b.cost, constraint: null });
    }
  }

  // Budget always starts net of the prebuilt bridge cost (spec).
  _freshBudget() {
    const b = this.level.budget;
    return {
      road: (b.road ?? 0) - (this._prebuiltCost.road ?? 0),
      wood: (b.wood ?? 0) - (this._prebuiltCost.wood ?? 0),
    };
  }

  update(_time, delta) {
    // Debris continues falling across mode transitions so pieces finish even
    // after the test ends and the fail overlay appears.
    this._updateDebris(delta);
    this._drawDebris();

    if (this.mode === 'test') {
      physics.tickWatchdog();
      // Stop driving once a win/fail is in flight so the car doesn't drift
      // past the result.
      if (!this.testEndAt) physics.driveVehicle();
      physics.applyBeamWeight();
      physics.applyVehicleLoad();
      physics.evaluateStress(this.time.now, physics.getTimeScale());
      juice.tick(this.time.now, physics.isCascadeActive(this.time.now));
      cam.tick(this.time.now);
      this.updateCreakAudio();
      this.redrawBeamBases();
      // Stress glow is a taught concept (L04 "Gravity Pulls Down"). Levels
      // before it set stressGlow:false so the glow stays a fresh reveal.
      if (this.level.stressGlow === false) {
        this.stressGraphics.clear();
        this._jointStrain = null;
        this.redrawJoints(new Map());
      } else {
        this._jointStrain = this.redrawStressOverlay();
        this.redrawJoints(this._jointStrain);
      }
      this.redrawSnapMarkers();
      this.redrawVehicle();
      this._updateDebugHud();
      this.checkWin();
      this.checkFall();
      // Auto-return to build mode after the result has been on screen ~1.5s.
      // Wipe the player's design first so they start each round with a clean
      // level (manual RESET, by contrast, keeps the design intact).
      if (this.testEndAt && this.time.now >= this.testEndAt) {
        this.clearBridgeData();
        this.toggleTest();
      }
    }
  }

  _handleRightClickDelete(pointer) {
    if (this._ui.delete === false) return;
    if (this.mode !== 'build') return;
    const target = this._findHoverTarget(pointer.worldX, pointer.worldY);
    if (!target) return;
    if (target.type === 'beam') {
      this._deleteBeam(target.index);
    } else if (target.type === 'joint') {
      this._deleteJoint(target.index);
    }
    this._hoverTarget = null;
  }

  _deleteBeam(index) {
    const beam = this.beams[index];
    if (!beam) return;

    // Find and remove the undo entry so budget is refunded and undo stack stays clean.
    const undoIdx = this._undoStack.findIndex(e => e.beam === beam);
    let cost = 0;
    let newJoints = [];
    if (undoIdx !== -1) {
      ({ cost, newJoints } = this._undoStack[undoIdx]);
      this._undoStack.splice(undoIdx, 1);
    } else {
      cost = beam.cost ?? 0;
    }

    physics.removeBeam(beam.constraint);
    this.beams.splice(index, 1);

    // Remove joints that were created for this beam and are now unconnected.
    for (const j of newJoints) {
      const stillUsed = this.beams.some(b => b.a.bodyId === j.bodyId || b.b.bodyId === j.bodyId);
      if (!stillUsed) {
        physics.removeJointNode(j.bodyId);
        const ji = this.joints.indexOf(j);
        if (ji !== -1) this.joints.splice(ji, 1);
      }
    }

    if (cost > 0) {
      const removePool = beam.material.type === 'road' ? '_budgetRoad' : '_budgetWood';
      this[removePool] += cost;
      this._updateBudgetDisplay();
    }

    this._hoverTarget = null;
    this._updateUndoBtn();
    this.redrawBeams();
    this.redrawJoints(new Map());
  }

  _deleteJoint(index) {
    const joint = this.joints[index];
    if (!joint || joint.isAnchor) return;
    physics.removeJointNode(joint.bodyId);
    this.joints.splice(index, 1);
    this._hoverTarget = null;
    this.redrawBeams();
    this.redrawJoints(new Map());
  }

  // Chassis below the world bottom → treat as fail and stop the camera so
  // the overlay stays in view. Prevents infinite scroll when the car drives
  // off an edge or the bridge gives way.
  checkFall() {
    const pos = physics.getVehicleChassisPosition();
    if (!pos) return;
    if (pos.y > this.level.worldHeight + 40 && !this.failOverlay && !this.winOverlay) {
      cam.follow(null);
      this.showFail();
    }
  }

  updateCreakAudio() {
    for (const { constraint } of physics._beamConstraints) {
      const stress = physics.readStressSmoothed(constraint);
      if (stress > 0.85) audio.startCreak(constraint, stress);
      else audio.stopCreak(constraint);
      audio.updateCreak(constraint, stress);
    }
  }

  onBeamSnapped() {
    // Win takes priority — don't trigger fail if the player already crossed.
    if (!this.failOverlay && !this.winOverlay) this.showFail();
  }

  showFail() {
    tutorial.onFail(this.level);
    cam.follow(null); // stop chasing the vehicle as it falls through the broken bridge
    this.failOverlay = this.add.text(640, 360, 'BRIDGE FAILED',
      { fontSize: '64px', color: '#ff3333', fontStyle: 'bold' })
      .setOrigin(0.5).setScrollFactor(0);
    this.endTest();
  }

  showWin() {
    physics.freezeVehicle();
    this.testEndAt = 0; // no auto-return on win — the modal owns the exit
    cam.follow(null);
    const i = LEVEL_ORDER.indexOf(this.levelId);
    bus.emit('level:result', {
      won: true,
      text: this.level.tutorial?.success?.text ?? '',
      budgetLeft: this._budgetRoad + this._budgetWood,
      hasNext: i >= 0 && i < LEVEL_ORDER.length - 1,
    });
    this.winOverlay = { destroy: () => bus.emit('level:result-hide') };
  }

  // Called when win or fail triggers: freeze the car and schedule auto-return
  // to build mode. The 1.5s window lets the player see the result.
  endTest() {
    physics.freezeVehicle();
    this.testEndAt = this.time.now + 1500;
  }

  checkWin() {
    const pos = physics.getVehicleChassisPosition();
    if (!pos) return;
    // Win when the vehicle reaches the checkpoint partway across the far
    // landmass — not merely the near edge of the right cliff.
    if (pos.x >= this._checkpointX && !this.winOverlay && !this.failOverlay) {
      this.showWin();
    }
  }

  redrawVehicle() {
    this.vehicleGraphics.clear();
    const v = physics._vehicle;
    if (!v) {
      this._vehicleSprite?.setVisible(false);
      return;
    }
    const c = v.chassis;
    const cx = c.position.x, cy = c.position.y;
    const key = this._vehiclePreset;

    if (this.textures.exists(key) && assets.has(key)) {
      if (!this._vehicleSprite) {
        this._vehicleSprite = this.add.image(cx, cy, key).setOrigin(0.5, 0.5).setDepth(2).setDisplaySize(120, 72);
      }
      this._vehicleSprite.setTexture(key).setVisible(true)
        .setDisplaySize(120, 72).setPosition(cx, cy).setRotation(c.angle);
      return;
    }
    this._vehicleSprite?.setVisible(false);

    // Procedural fallback — Poly Bridge style rectangle chassis + wheels.
    this.vehicleGraphics.fillStyle(0x222222, 1);
    if (v.wheelA) {
      this.vehicleGraphics.fillCircle(v.wheelA.position.x, v.wheelA.position.y, 10);
      this.vehicleGraphics.fillCircle(v.wheelB.position.x, v.wheelB.position.y, 10);
    }
    const cos = Math.cos(c.angle), sin = Math.sin(c.angle);
    const hw = 40, hh = 12;
    const corners = [
      { x: cx - hw * cos + hh * sin, y: cy - hw * sin - hh * cos },
      { x: cx + hw * cos + hh * sin, y: cy + hw * sin - hh * cos },
      { x: cx + hw * cos - hh * sin, y: cy + hw * sin + hh * cos },
      { x: cx - hw * cos - hh * sin, y: cy - hw * sin + hh * cos },
    ];
    this.vehicleGraphics.fillStyle(0xf08c1a, 1);
    this.vehicleGraphics.fillPoints(corners, true);
    this.vehicleGraphics.lineStyle(2, 0x331a00, 1);
    this.vehicleGraphics.strokePoints(corners, true);
  }

  _handleSave() {
    saveLayout(this.levelId, this.joints, this.beams, this._vehiclePreset);
    bus.emit('layout:saved');
  }

  _handleLoad() {
    const data = loadLayout(this.levelId);
    if (!data) return;
    this._loadFromSave(data);
  }

  _loadFromSave(data) {
    // hardReset clears to anchors-only, exits test mode, wipes physics.
    this.hardReset();

    // Build a lookup of all joint objects (anchors already in this.joints after hardReset).
    const jointMap = new Map(this.joints.map(j => [j.bodyId, j]));

    // Restore saved mid-joints.
    for (const saved of data.joints) {
      const entry = { x: saved.x, y: saved.y, isAnchor: false, bodyId: saved.id };
      this.joints.push(entry);
      jointMap.set(saved.id, entry);
    }

    // Restore saved beams.
    for (const savedBeam of data.beams) {
      const jA = jointMap.get(savedBeam.a);
      const jB = jointMap.get(savedBeam.b);
      if (!jA || !jB) continue;
      const material = savedBeam.material === 'road'
        ? this.level.materials.road
        : (this.level.materials.wood ?? this.level.materials.road);
      this.beams.push({ a: jA, b: jB, material, constraint: null });
    }

    // Rebuild physics from the restored this.joints + this.beams.
    this.rebuildBridge();

    // Restore vehicle selection.
    if (data.vehicle) this._selectVehicle(data.vehicle);

    this.redrawBeams();
    this.redrawJoints(new Map());
  }
}
