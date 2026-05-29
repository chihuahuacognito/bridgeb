// src/scenes/LevelScene.js
import Phaser from 'phaser';
import GUI from 'lil-gui';
import { ALL_LEVELS } from '../data/leveldata.js';
import physics from '../systems/physics.js';
import audio from '../systems/audio.js';
import juice from '../systems/juice.js';
import cam from '../systems/camera.js';
import { findBeamSnap } from '../utils/snapGeometry.js';
import { BlockPalette } from '../ui/BlockPalette.js';
import { GhostBeam } from '../ui/GhostBeam.js';

// Flip to false (or gate on build flag) to hide the metrics overlay in production.
const DEBUG_HUD = true;
const SAG_DEPTH_FACTOR = 0.10;

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
  GRID_ALPHA: 0.18,
  GRID_STEP:  40,

  // Blueprint build-mode background
  BLUEPRINT_BG:          '#1e2d4a',
  BLUEPRINT_MINOR:       0xffffff,
  BLUEPRINT_MINOR_ALPHA: 0.10,
  BLUEPRINT_MAJOR:       0x7ab8d8,
  BLUEPRINT_MAJOR_ALPHA: 0.28,
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
    this.levelId = data.levelId || 'L1';
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
  }

  create() {
    this.drawSky();
    this._blueprintGrid = this.drawBlueprintGrid();
    this._testGrid      = this.drawTestGrid();
    this._setBlueprintMode();            // start in build mode
    this.drawTerrain();
    this.drawRocks();
    this.drawWater();

    this.beamsGraphics   = this.add.graphics(); // back: beam bases
    this.stressGraphics  = this.add.graphics(); // mid: stress overlay (test mode only)
    this.jointsGraphics  = this.add.graphics(); // front: anchor circles + joint pins + glow
    this.vehicleGraphics = this.add.graphics(); // vehicle chassis + visual wheels
    this.ghostGraphics   = this.add.graphics();
    this.snapGraphics    = this.add.graphics();
    this._debrisGfx      = this.add.graphics().setDepth(5);
    this.snapTarget = null;

    this.input.on('pointerdown', (pointer) => this.handleClick(pointer));
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
    this._budgetRemaining = this.level.budget;
    this.beamConstraints = [];           // mirrors physics._beamConstraints, for rendering

    this._vehiclePreset = VEHICLE_PRESETS[0].key;
    const _vp0 = VEHICLE_PRESETS[0];
    this._cheatParams = {
      weight:              _vp0.weight,
      speed:               _vp0.speed,
      acceleration:        _vp0.acceleration,
      roadStiffness:       this.level.materials.road.stiffness,
      roadSnapThreshold:   this.level.materials.road.snapThreshold,
      beamStiffness:       this.level.materials.wood.stiffness,
      beamSnapThreshold:   this.level.materials.wood.snapThreshold,
      visualFullStrain:    0.05,
      strainMed:           VIZ.STRAIN_MED,
      strainHigh:          VIZ.STRAIN_HIGH,
      strainCrit:          VIZ.STRAIN_CRIT,
      gravityY:            this.level.gravity?.y ?? 1.5,
    };
    this._buildCheatGui();
    physics.setVisualFullStrain(this._cheatParams.visualFullStrain);

    // Block palette (replaces old ROAD/BEAM buttons).
    this._palette = new BlockPalette(this, this.level.materials);
    this._palette.onChange(ev => this._onPaletteChange(ev));
    this._ghost = new GhostBeam(this);

    // Keyboard shortcuts drive the palette.
    this.input.keyboard.on('keydown-R', () => this._palette.selectMaterial('road'));
    this.input.keyboard.on('keydown-B', () => this._palette.selectMaterial('wood'));
    this.input.keyboard.on('keydown-F', () => this._palette.selectFreeform());

    // Vehicle preset selector — second toolbar row at y=95 (taller for icon + label).
    this._vehicleBtns = {};
    const vpX = [160, 310, 460];
    VEHICLE_PRESETS.forEach((vp, i) => {
      const active = vp.key === this._vehiclePreset;
      const btn = this.add.rectangle(vpX[i], 95, 130, 54, active ? vp.color : 0x444444)
        .setInteractive().setScrollFactor(0);
      btn.on('pointerdown', (_p, _lx, _ly, ev) => { ev.stopPropagation(); this._selectVehicle(vp.key); });
      this._vehicleBtns[vp.key] = btn;
    });
    this._drawVehicleIcons(); // silhouettes above buttons
    VEHICLE_PRESETS.forEach((vp, i) => {  // labels above icons
      this.add.text(vpX[i], 114, vp.label, { fontSize: '11px', color: '#ffffff' })
        .setOrigin(0.5).setScrollFactor(0);
    });
    this.input.keyboard.on('keydown-ONE',   () => this._selectVehicle('car'));
    this.input.keyboard.on('keydown-TWO',   () => this._selectVehicle('truck'));
    this.input.keyboard.on('keydown-THREE', () => this._selectVehicle('tank'));

    // Gravity label — level-baked, shown as a read-only tag next to the vehicle row.
    const gravLabel = (this.level.gravity?.label ?? 'Normal').toUpperCase() + '-G';
    this.add.rectangle(640, 95, 130, 54, 0x1a2a3a).setScrollFactor(0);
    this.add.text(640, 95, gravLabel, { fontSize: '13px', color: '#88aacc' })
      .setOrigin(0.5).setScrollFactor(0);

    // UNDO — removes the last placed beam (Ctrl+Z).
    this._undoBtn   = this.add.rectangle(330, 40, 120, 40, 0x444444).setInteractive().setScrollFactor(0);
    this._undoLabel = this.add.text(330, 40, 'UNDO', { fontSize: '16px', color: '#888888' }).setOrigin(0.5).setScrollFactor(0);
    this._undoBtn.on('pointerdown', (_p, _lx, _ly, ev) => { ev.stopPropagation(); this._undoLastPlacement(); });
    this.input.keyboard.on('keydown-Z', (ev) => { if (ev.ctrlKey || ev.metaKey) this._undoLastPlacement(); });

    // Hard RESET — clears all beams and joints, returns to a clean build state.
    this._resetBtn   = this.add.rectangle(480, 40, 130, 40, 0x8b1a1a).setInteractive().setScrollFactor(0);
    this._resetLabel = this.add.text(480, 40, 'CLEAR', { fontSize: '16px', color: '#ffffff' }).setOrigin(0.5).setScrollFactor(0);
    this._resetBtn.on('pointerdown', (_p, _lx, _ly, ev) => { ev.stopPropagation(); this.hardReset(); });

    // TEST / RESET SIM toggle
    this.testButton = this.add.rectangle(640, 40, 140, 40, 0x2e7d32).setInteractive().setScrollFactor(0);
    this.testButtonLabel = this.add.text(640, 40, 'TEST', { fontSize: '18px', color: '#fff' }).setOrigin(0.5).setScrollFactor(0);
    this.testButton.on('pointerdown', (_p, _lx, _ly, ev) => { ev.stopPropagation(); this.toggleTest(); });
    this._budgetBg    = this.add.rectangle(800, 40, 130, 40, 0x1a3a2a).setScrollFactor(0);
    this._budgetLabel = this.add.text(800, 40, `LEFT: ${this.level.budget}`, { fontSize: '16px', color: '#ffffff' })
      .setOrigin(0.5).setScrollFactor(0);

    // Debug HUD — shows live physics metrics in test mode. Toggle with D.
    if (DEBUG_HUD) {
      this._debugHudVisible = true;
      this._debugBg = this.add.rectangle(220, 510, 424, 96, 0x000000, 0.72)
        .setScrollFactor(0).setDepth(100);
      this._debugText = this.add.text(12, 466, '', {
        fontSize: '13px', color: '#00ff88', fontFamily: 'monospace', lineSpacing: 4,
      }).setScrollFactor(0).setDepth(101);
      this.input.keyboard.on('keydown-D', () => {
        this._debugHudVisible = !this._debugHudVisible;
        this._debugBg.setVisible(this._debugHudVisible);
        this._debugText.setVisible(this._debugHudVisible);
      });
    }

    // Start paused: pause Matter until the player hits TEST.
    physics.setRunnerEnabled(false);
    this.redrawJoints(new Map());

    this.events.on('shutdown', () => {
      physics.detach(this);
      audio.detach(this);
      juice.detach(this);
      cam.detach(this);
      this._gui?.destroy();
      this._palette?.destroy();
      this._ghost?.destroy();
    });
  }

  drawSky() {
    this.cameras.main.setBackgroundColor('#b2b9c2');
  }

  drawBlueprintGrid() {
    const g = this.add.graphics();
    const { worldWidth: w, worldHeight: h } = this.level;
    // Minor grid — every 40px
    g.lineStyle(1, VIZ.BLUEPRINT_MINOR, VIZ.BLUEPRINT_MINOR_ALPHA);
    for (let x = 0; x <= w; x += VIZ.GRID_STEP) {
      g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.strokePath();
    }
    for (let y = 0; y <= h; y += VIZ.GRID_STEP) {
      g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.strokePath();
    }
    // Major grid — every 160px (L-block interval), drawn on top at higher alpha
    g.lineStyle(1, VIZ.BLUEPRINT_MAJOR, VIZ.BLUEPRINT_MAJOR_ALPHA);
    for (let x = 0; x <= w; x += VIZ.BLUEPRINT_MAJOR_STEP) {
      g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.strokePath();
    }
    for (let y = 0; y <= h; y += VIZ.BLUEPRINT_MAJOR_STEP) {
      g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.strokePath();
    }
    return g;
  }

  drawTestGrid() {
    const g = this.add.graphics().setVisible(false);
    g.lineStyle(1, VIZ.GRID_COLOR, VIZ.GRID_ALPHA);
    for (let x = 0; x <= this.level.worldWidth; x += VIZ.GRID_STEP) {
      g.beginPath(); g.moveTo(x, 0); g.lineTo(x, this.level.worldHeight); g.strokePath();
    }
    for (let y = 0; y <= this.level.worldHeight; y += VIZ.GRID_STEP) {
      g.beginPath(); g.moveTo(0, y); g.lineTo(this.level.worldWidth, y); g.strokePath();
    }
    return g;
  }

  _setBlueprintMode() {
    this.cameras.main.setBackgroundColor(VIZ.BLUEPRINT_BG);
    this._blueprintGrid?.setVisible(true);
    this._testGrid?.setVisible(false);
  }

  _setTestMode() {
    this.cameras.main.setBackgroundColor(VIZ.TEST_BG);
    this._blueprintGrid?.setVisible(false);
    this._testGrid?.setVisible(true);
  }

  drawTerrain() {
    const g = this.add.graphics();
    const { left, right } = this.level.terrain;
    for (const side of [left, right]) {
      g.fillStyle(side.color ?? 0x2c3033, 1);
      g.fillPoints(side.verts, true);
      g.lineStyle(2, 0x1a1d20, 1);
      g.strokePoints(side.verts, true);
    }
  }

  drawRocks() {
    const g = this.add.graphics();
    for (const rock of (this.level.rocks ?? [])) {
      g.fillStyle(rock.color ?? 0x8b6a2e, 1);
      g.fillPoints(rock.verts, true);
      g.lineStyle(2, 0x1a1d20, 1);
      g.strokePoints(rock.verts, true);
    }
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
    if (this._palette.isOverPalette(pointer)) return;
    if (this._blockState.freeform) {
      this._handleFreeformClick(pointer);
    } else if (this._blockState.material && this._blockState.size) {
      this._handleBlockPlace();
    }
  }

  _handleFreeformClick(pointer) {
    const raw = { x: pointer.worldX, y: pointer.worldY };
    const jointSnap = this.findNearestJoint(raw);
    let p;
    let beamSnapResult = null;

    if (jointSnap) {
      p = { x: jointSnap.x, y: jointSnap.y, bodyId: jointSnap.bodyId };
    } else {
      beamSnapResult = findBeamSnap(raw, this.beams, this.SNAP_RADIUS);
      p = beamSnapResult ? { x: beamSnapResult.point.x, y: beamSnapResult.point.y } : raw;
    }

    if (!this.pendingJointA) {
      if (beamSnapResult) {
        const newJoint = this.splitBeam(beamSnapResult.beamIndex, beamSnapResult.point);
        this.pendingJointA = newJoint;
        this._freeformPendingNewJoint = null; // split-beam — not tracked for undo
        this.redrawBeams();
        this.redrawJoints(new Map());
      } else {
        const isNew = !p.bodyId;
        this.pendingJointA = isNew ? this.registerNewJoint(p) : p;
        this._freeformPendingNewJoint = isNew ? this.pendingJointA : null;
      }
    } else {
      const cost = this.material.cost;
      if (this._budgetRemaining < cost) {
        this._flashBudget();
        this.pendingJointA = null;
        return;
      }
      let endpoint;
      let endpointIsNew = false;
      if (beamSnapResult) {
        endpoint = this.splitBeam(beamSnapResult.beamIndex, beamSnapResult.point);
      } else {
        endpointIsNew = !p.bodyId;
        endpoint = endpointIsNew ? this.registerNewJoint(p) : p;
      }
      const matA = physics._nodes.get(this.pendingJointA.bodyId);
      const matB = physics._nodes.get(endpoint.bodyId);
      const constraint = physics.buildBeam(matA, matB, this.material);
      const beam = { a: this.pendingJointA, b: endpoint, material: this.material, constraint };
      this.beams.push(beam);
      if (!beamSnapResult) {
        const newJoints = [];
        if (this._freeformPendingNewJoint) newJoints.push(this._freeformPendingNewJoint);
        if (endpointIsNew) newJoints.push(endpoint);
        this._undoStack.push({ beam, newJoints, cost });
        this._updateUndoBtn();
      }
      this._freeformPendingNewJoint = null;
      this._budgetRemaining -= cost;
      this._updateBudgetDisplay();
      this.pendingJointA = null;
      this.redrawBeams();
      this.redrawJoints(new Map());
    }
  }

  _handleBlockPlace() {
    const placement = this._ghost.getPlacement();
    if (!placement) { this._flashBudget(); return; }

    const mat = this._blockState.material;
    const cost = mat.blocks[this._blockState.size].cost;
    if (this._budgetRemaining < cost) { this._flashBudget(); return; }

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
    const beam = { a: anchorJoint, b: endJoint, material: mat, constraint };
    this.beams.push(beam);
    this._undoStack.push({ beam, newJoints, cost });
    this._updateUndoBtn();
    this._budgetRemaining -= cost;
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

  // Called by palette onChange events — updates _blockState and this.material.
  _onPaletteChange(ev) {
    if (ev.type === 'material') {
      const mat = ev.material ? this.level.materials[ev.material] : null;
      this._blockState.material = mat;
      this._blockState.size = null;
      this._blockState.blockLength = 0;
      this._blockState.freeform = false;
      this.material = mat ?? this.material; // keep this.material valid for rebuildBridge
      this._ghost.hide();
    } else if (ev.type === 'size') {
      const mat = this.level.materials[ev.material];
      const block = mat?.blocks?.[ev.size];
      this._blockState.material = mat;
      this._blockState.size = ev.size;
      this._blockState.blockLength = block?.length ?? 0;
      this._blockState.freeform = false;
      this.material = mat;
      this._ghost.show();
    } else if (ev.type === 'freeform') {
      this._blockState.freeform = ev.active;
      this._blockState.material = null;
      this._blockState.size = null;
      this._blockState.blockLength = 0;
      this._ghost.hide();
      this.pendingJointA = null;
    } else if (ev.type === 'reset') {
      this._blockState = { freeform: false, material: null, size: null, blockLength: 0 };
      this._ghost.hide();
      this.pendingJointA = null;
    }
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

    this._budgetRemaining += cost;
    this._updateBudgetDisplay();
    this._updateUndoBtn();
    this.redrawBeams();
    this.redrawJoints(new Map());
  }

  _updateUndoBtn() {
    const hasHistory = this._undoStack.length > 0 || !!this.pendingJointA;
    this._undoBtn?.setFillStyle(hasHistory ? 0x1a4a6e : 0x444444);
    this._undoLabel?.setColor(hasHistory ? '#ffffff' : '#888888');
  }

  // Keep as thin wrapper for callers in hardReset that need a default state.
  _selectMaterial(type) {
    this._palette?.selectMaterial(type === 'road' ? 'road' : 'wood');
  }

  _updateBudgetDisplay() {
    const n = this._budgetRemaining;
    this._budgetLabel.setText(`LEFT: ${n}`);
    if (n === 0) {
      this._budgetLabel.setColor('#ff4444');
      this._budgetBg.setFillStyle(0x3a1a1a);
    } else {
      this._budgetLabel.setColor('#ffffff');
      this._budgetBg.setFillStyle(0x1a3a2a);
    }
  }

  _updateDebugHud() {
    if (!this._debugText) return;
    const info = physics.getDebugInfo();
    if (!info) { this._debugText.setText('no vehicle'); return; }
    const { vx, vy, speed, angleDeg, angVelDeg, driveForce, accel, slopeDeg, closestDist } = info;
    const accelStr = (accel >= 0 ? '+' : '') + accel.toFixed(3);
    const slopeStr = slopeDeg != null ? slopeDeg.toFixed(1) + '°' : '--';
    this._debugText.setText([
      `SPD ${speed.toFixed(2)}  VX ${vx.toFixed(2)}  VY ${vy.toFixed(2)}`,
      `ACCEL ${accelStr}/tick   DRIVE ${driveForce.toExponential(2)}`,
      `CHASSIS ${angleDeg.toFixed(1)}°  ANGVEL ${angVelDeg.toFixed(2)}°/tick`,
      `SLOPE ${slopeStr}  BEAM-DIST ${closestDist.toFixed(0)}px    [D] toggle`,
    ].join('\n'));
  }

  _flashBudget() {
    this.tweens.killTweensOf(this._budgetLabel);
    this.tweens.add({
      targets: this._budgetLabel,
      x: '+=4',
      yoyo: true,
      repeat: 3,
      duration: 40,
    });
  }

  _selectVehicle(key) {
    const preset = VEHICLE_PRESETS.find(p => p.key === key);
    if (!preset) return;
    this._vehiclePreset = key;
    this._cheatParams.weight       = preset.weight;
    this._cheatParams.speed        = preset.speed;
    this._cheatParams.acceleration = preset.acceleration;
    // Sync GUI sliders so the dev panel reflects the preset values.
    this._guiWeightCtrl?.updateDisplay();
    this._guiSpeedCtrl?.updateDisplay();
    this._guiAccelCtrl?.updateDisplay();
    // Highlight the active button, dim the rest.
    for (const vp of VEHICLE_PRESETS) {
      this._vehicleBtns[vp.key]?.setFillStyle(vp.key === key ? vp.color : 0x444444);
    }
  }

  _drawVehicleIcons() {
    const gfx = this.add.graphics().setScrollFactor(0);
    const vpX = [160, 310, 460];
    const iy = 89; // icon center y within the 130×54 button at y=95
    this._drawCarIcon(gfx, vpX[0], iy);
    this._drawTruckIcon(gfx, vpX[1], iy);
    this._drawTankIcon(gfx, vpX[2], iy);
  }

  _drawCarIcon(gfx, cx, cy) {
    // Sedan: lower body + sloped roof + two wheels
    gfx.fillStyle(0xf08c1a, 1);
    gfx.fillRect(cx - 33, cy - 6, 66, 13); // body
    gfx.fillRect(cx - 18, cy - 17, 32, 12); // roof
    gfx.fillStyle(0x222222, 1);
    gfx.fillCircle(cx + 21, cy + 8, 8); // front wheel
    gfx.fillCircle(cx - 21, cy + 8, 8); // rear wheel
    gfx.fillStyle(0x888888, 1);
    gfx.fillCircle(cx + 21, cy + 8, 3); // hub
    gfx.fillCircle(cx - 21, cy + 8, 3);
  }

  _drawTruckIcon(gfx, cx, cy) {
    // Delivery truck: cargo box (left/rear) + short cab (right/front) + dual rear wheels
    gfx.fillStyle(0xcc7722, 1);
    gfx.fillRect(cx - 38, cy - 17, 44, 25); // cargo box
    gfx.fillRect(cx + 6, cy - 9, 24, 17);   // cab
    gfx.fillStyle(0x88bbdd, 1);
    gfx.fillRect(cx + 20, cy - 8, 7, 7);    // windshield
    gfx.fillStyle(0x222222, 1);
    gfx.fillCircle(cx + 18, cy + 9, 7);     // front wheel
    gfx.fillCircle(cx - 28, cy + 9, 7);     // rear outer
    gfx.fillCircle(cx - 18, cy + 9, 6);     // rear inner (dual)
    gfx.fillStyle(0x888888, 1);
    gfx.fillCircle(cx + 18, cy + 9, 3);
    gfx.fillCircle(cx - 28, cy + 9, 3);
    gfx.fillCircle(cx - 18, cy + 9, 2);
  }

  _drawTankIcon(gfx, cx, cy) {
    // Military tank: tread + olive hull + turret + barrel
    gfx.fillStyle(0x222222, 1);
    gfx.fillRect(cx - 40, cy - 1, 80, 11); // tread band
    gfx.fillStyle(0x556b2f, 1);            // olive drab
    gfx.fillRect(cx - 36, cy - 9, 72, 18); // hull
    gfx.fillRect(cx - 10, cy - 21, 28, 14); // turret
    gfx.fillStyle(0x3d4f22, 1);
    gfx.fillRect(cx + 18, cy - 17, 22, 5); // barrel
    gfx.fillStyle(0x333333, 1);
    for (let i = -3; i <= 3; i++) {        // tread segments
      gfx.fillRect(cx + i * 11 - 1, cy - 1, 2, 11);
    }
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
      this.testButtonLabel.setText('TEST');
      this._setBlueprintMode();
    }
    // Wipe player design and rebuild physics with only anchors.
    this.clearBridgeData();
    this.rebuildBridge();
    this.pendingJointA = null;
    this.snapTarget = null;
    // Clear all graphics layers.
    this.vehicleGraphics?.clear();
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
    this._palette.reset();       // clears selection, fires reset onChange
    this.material = this.level.materials.road;
    this.redrawBeams();
    this.redrawJoints(new Map());
    this._budgetRemaining = this.level.budget;
    this._updateBudgetDisplay();
  }

  handleHover(pointer) {
    if (this.mode !== 'build') return;

    if (this._palette.isOverPalette(pointer)) {
      this._ghost.hide();
      this.snapGraphics.clear();
      this.ghostGraphics.clear();
      return;
    }

    const raw = { x: pointer.worldX, y: pointer.worldY };
    this.snapGraphics.clear();
    this.ghostGraphics.clear();

    if (this._blockState.freeform) {
      // Freeform: show snap ring + pending wire (original behaviour)
      const jointSnap = this.findNearestJoint(raw);
      const beamSnap = jointSnap ? null : findBeamSnap(raw, this.beams, this.SNAP_RADIUS);

      if (jointSnap) {
        this.snapTarget = { x: jointSnap.x, y: jointSnap.y, bodyId: jointSnap.bodyId };
        this.snapGraphics.lineStyle(3, VIZ.JOINT_COLOR, 0.9);
        this.snapGraphics.strokeCircle(jointSnap.x, jointSnap.y, VIZ.JOINT_RADIUS + 5);
      } else if (beamSnap) {
        const { x, y } = beamSnap.point;
        this.snapTarget = { x, y };
        const GREEN = 0x44dd44;
        this.snapGraphics.fillStyle(GREEN, 0.5);
        this.snapGraphics.fillCircle(x, y, 8);
        this.snapGraphics.lineStyle(2, GREEN, 0.9);
        this.snapGraphics.strokeCircle(x, y, 8);
        const HALF = 12;
        this.snapGraphics.beginPath();
        this.snapGraphics.moveTo(x - HALF, y);
        this.snapGraphics.lineTo(x + HALF, y);
        this.snapGraphics.moveTo(x, y - HALF);
        this.snapGraphics.lineTo(x, y + HALF);
        this.snapGraphics.strokePath();
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

    const beam = gui.addFolder('Material (Beam/Wood)');
    beam.add(p, 'beamStiffness', 0.05, 1.0, 0.01).name('Stiffness').onChange(v => {
      this.level.materials.wood.stiffness = v;
    });
    beam.add(p, 'beamSnapThreshold', 0.001, 0.5, 0.001).name('Snap Threshold').onChange(v => {
      this.level.materials.wood.snapThreshold = v;
    });

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
      this.testButtonLabel.setText('RESET');
      physics.setTimeScale(1.0);
      physics.setGravity(this._cheatParams.gravityY);
      physics.setRunnerEnabled(true);   // start simulating
      const vehicleConfig = {
        ...this.level.vehicles[0], // spec §2 rule 3: always an array
        ...vehicleParamsFromDesign({
          weight:       this._cheatParams.weight,
          speed:        this._cheatParams.speed,
          acceleration: this._cheatParams.acceleration,
        }),
      };
      physics.spawnVehicle(vehicleConfig);
      cam.follow(() => physics.getVehicleChassisPosition());
      this.testEndAt = 0;
      this._undoStack = [];
      this._freeformPendingNewJoint = null;
      this._updateUndoBtn();
      this._setTestMode();
      this._ghost.hide();
    } else {
      juice.reset();
      this.rebuildBridge();
      cam.follow(null);
      this.cameras.main.setZoom(1.0);
      this.cameras.main.scrollX = 0;
      this.cameras.main.scrollY = 0;
      this.mode = 'build';
      this.testButtonLabel.setText('TEST');
      physics.setRunnerEnabled(false);
      this._setBlueprintMode();
      this.vehicleGraphics?.clear();
      this.stressGraphics.clear();
      this._jointStrain = null;
      this._firstBreakPos = null;
      this._debris = [];
      this._debrisGfx.clear();
      this.redrawBeams();
      this.redrawJoints(new Map());
      this.winOverlay?.destroy(); this.winOverlay = null;
      this.failOverlay?.destroy(); this.failOverlay = null;
      this.testEndAt = 0;
      this._budgetRemaining = this.level.budget;
      this._updateBudgetDisplay();
    }
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
      this._jointStrain = this.redrawStressOverlay();
      this.redrawJoints(this._jointStrain);
      this.redrawSnapMarkers();
      this.redrawVehicle();
      if (DEBUG_HUD && this._debugHudVisible) this._updateDebugHud();
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
    // Task 8.5 will trigger slow-mo here; for now just register the fail.
    if (!this.failOverlay) this.showFail();
  }

  showFail() {
    cam.follow(null); // stop chasing the vehicle as it falls through the broken bridge
    this.failOverlay = this.add.text(640, 360, 'BRIDGE FAILED',
      { fontSize: '64px', color: '#ff3333', fontStyle: 'bold' })
      .setOrigin(0.5).setScrollFactor(0);
    this.endTest();
  }

  showWin() {
    this.winOverlay = this.add.text(640, 360, 'BRIDGE HOLDS',
      { fontSize: '64px', color: '#33cc33', fontStyle: 'bold' })
      .setOrigin(0.5).setScrollFactor(0);
    this.endTest();
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
    const rightAnchor = this.level.anchors.find(a => a.side === 'right');
    if (pos.x >= rightAnchor.x - 20 && !this.winOverlay && !this.failOverlay) {
      this.showWin();
    }
  }

  redrawVehicle() {
    this.vehicleGraphics.clear();
    const v = physics._vehicle;
    if (!v) return;
    const c = v.chassis;
    const cx = c.position.x, cy = c.position.y;
    const cos = Math.cos(c.angle), sin = Math.sin(c.angle);
    const hw = 40, hh = 12;

    // Wheels are real physics bodies — draw at their actual positions so they
    // always appear exactly where they contact the road surface.
    this.vehicleGraphics.fillStyle(0x222222, 1);
    if (v.wheelA) {
      this.vehicleGraphics.fillCircle(v.wheelA.position.x, v.wheelA.position.y, 10);
      this.vehicleGraphics.fillCircle(v.wheelB.position.x, v.wheelB.position.y, 10);
    }

    // Chassis drawn on top so it covers the wheel tops, leaving the lower arcs
    // visible below — the standard Poly Bridge vehicle look.
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
}
