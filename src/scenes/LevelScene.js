// src/scenes/LevelScene.js
import Phaser from 'phaser';
import { ALL_LEVELS } from '../data/leveldata.js';
import physics from '../systems/physics.js';
import audio from '../systems/audio.js';
import juice from '../systems/juice.js';
import cam from '../systems/camera.js';

const VIZ = {
  // Stress visual thresholds (independent of snap tuning)
  STRAIN_MED:  0.05,
  STRAIN_HIGH: 0.20,
  STRAIN_CRIT: 0.50,

  // Beam base
  BEAM_BASE_COLOR: 0x9b6b3a,
  BEAM_BASE_THICKNESS: 6,

  // Stress overlay (additive on top of base)
  OVERLAY_COLOR_MED:  0xffd24a,
  OVERLAY_COLOR_HIGH: 0xff8a1f,
  OVERLAY_COLOR_CRIT: 0xff2e2e,
  OVERLAY_THICKNESS_BONUS: 6,
  OVERLAY_ALPHA_BASE: 0.50,
  OVERLAY_ALPHA_PULSE: 0.45,
  PULSE_HZ_MED:  2.0,
  PULSE_HZ_HIGH: 4.5,
  PULSE_HZ_CRIT: 8.0,

  // Crack hatching at CRIT
  CRACK_COUNT: 6,
  CRACK_LENGTH: 12,
  CRACK_COLOR: 0x1a0a0a,

  // Joint visuals
  ANCHOR_COLOR: 0xc23030,
  ANCHOR_SIZE: 14,
  JOINT_COLOR: 0x6b4a25,
  JOINT_RADIUS: 5,
  JOINT_RING_COLOR: 0x3a2510,
  JOINT_GLOW_COLOR_HIGH: 0xff8a1f,
  JOINT_GLOW_COLOR_CRIT: 0xff2e2e,
  JOINT_GLOW_RADIUS_MAX: 22,
  JOINT_GLOW_ALPHA_MAX: 0.55,
};

export class LevelScene extends Phaser.Scene {
  constructor() {
    super('LevelScene');
  }

  init(data) {
    this.levelId = data.levelId || 'L1';
    this.level = ALL_LEVELS[this.levelId];
    this.beams = [];
    this.pendingJointA = null;
    this.joints = this.level.anchors.map(a => ({ x: a.x, y: a.y, isAnchor: true, bodyId: a.id }));
    this.SNAP_RADIUS = 20;
  }

  create() {
    this.drawSky();
    this.drawCanyon();
    this.drawWater();

    this.beamsGraphics  = this.add.graphics(); // back: brown base
    this.stressGraphics = this.add.graphics(); // mid: stress overlay (test mode only)
    this.jointsGraphics = this.add.graphics(); // front: anchor plates + joint pins + glow
    this.ghostGraphics = this.add.graphics();
    this.snapGraphics = this.add.graphics();
    this.snapTarget = null;

    this.input.on('pointerdown', (pointer) => this.handleClick(pointer));
    this.input.on('pointermove', (pointer) => this.handleHover(pointer));

    physics.attach(this);
    physics.buildCanyon(this.level.canyon);

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
      juice.onSnap(this.time.now);
      // Punch-in on the snap midpoint
      const mx = (c.bodyA.position.x + c.bodyB.position.x) / 2;
      const my = (c.bodyA.position.y + c.bodyB.position.y) / 2;
      cam.punchIn(mx, my, this.time.now);
      audio.stopCreak(c);
      this.onBeamSnapped();
    });
    this.winOverlay = null;
    this.failOverlay = null;
    this.testEndAt = 0; // when > 0, auto-return to build mode at this timestamp

    this.mode = 'build';                 // 'build' | 'test'
    this.material = this.level.materials.wood;
    this.beamConstraints = [];           // mirrors physics._beamConstraints, for rendering

    // Test/Reset button overlay
    this.testButton = this.add.rectangle(640, 40, 200, 50, 0x2e7d32).setInteractive();
    this.testButtonLabel = this.add.text(640, 40, 'TEST', { fontSize: '20px', color: '#fff' }).setOrigin(0.5);
    this.testButton.on('pointerdown', () => this.toggleTest());

    // Start paused: pause Matter until the player hits TEST.
    physics.setRunnerEnabled(false);
    this.redrawJoints(new Map());

    this.events.on('shutdown', () => {
      physics.detach(this);
      audio.detach(this);
      juice.detach(this);
      cam.detach(this);
    });
  }

  drawSky() {
    // Solid for now; parallax happens in Phase 2.
    this.cameras.main.setBackgroundColor('#87ceeb');
  }

  drawCanyon() {
    const g = this.add.graphics();
    g.fillStyle(0x6b4f3a, 1); // earthy brown
    const { leftWall, rightWall } = this.level.canyon;
    g.fillRect(leftWall.x - leftWall.width / 2,  leftWall.y - leftWall.height / 2,
               leftWall.width, leftWall.height);
    g.fillRect(rightWall.x - rightWall.width / 2, rightWall.y - rightWall.height / 2,
               rightWall.width, rightWall.height);
  }

  drawWater() {
    const g = this.add.graphics();
    g.fillStyle(0x3a7fc4, 0.85);
    g.fillRect(0, this.level.canyon.waterY, this.level.worldWidth,
               this.level.worldHeight - this.level.canyon.waterY);
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
    const raw = { x: pointer.worldX, y: pointer.worldY };
    const snap = this.findNearestJoint(raw);
    const p = snap ? { x: snap.x, y: snap.y, bodyId: snap.bodyId } : raw;

    if (!this.pendingJointA) {
      this.pendingJointA = p.bodyId ? p : this.registerNewJoint(p);
    } else {
      const endpoint = p.bodyId ? p : this.registerNewJoint(p);
      const matA = physics._nodes.get(this.pendingJointA.bodyId);
      const matB = physics._nodes.get(endpoint.bodyId);
      physics.buildBeam(matA, matB, this.material);
      this.beams.push({ a: this.pendingJointA, b: endpoint });
      this.pendingJointA = null;
      this.redrawBeams();
      this.redrawJoints(new Map());
    }
  }

  registerNewJoint(p) {
    const id = 'j' + (this.joints.length + 1);
    this.joints.push({ x: p.x, y: p.y, isAnchor: false, bodyId: id });
    physics.ensureJointNode(id, p.x, p.y, /* isAnchor */ false);
    return { x: p.x, y: p.y, bodyId: id };
  }

  handleHover(pointer) {
    this.ghostGraphics.clear();
    this.snapGraphics.clear();
    const raw = { x: pointer.worldX, y: pointer.worldY };
    const snap = this.findNearestJoint(raw);
    if (snap) {
      this.snapGraphics.lineStyle(2, 0xffff00, 1);
      this.snapGraphics.strokeCircle(snap.x, snap.y, 18);
    }
    if (this.pendingJointA) {
      const endpoint = snap || raw;
      this.ghostGraphics.lineStyle(4, 0x9b6b3a, 0.4);
      this.ghostGraphics.beginPath();
      this.ghostGraphics.moveTo(this.pendingJointA.x, this.pendingJointA.y);
      this.ghostGraphics.lineTo(endpoint.x, endpoint.y);
      this.ghostGraphics.strokePath();
    }
  }

  // Build-mode base draw: brown wood planks from the design-time data.
  redrawBeams() {
    this.beamsGraphics.clear();
    this.beamsGraphics.lineStyle(VIZ.BEAM_BASE_THICKNESS, VIZ.BEAM_BASE_COLOR, 1);
    for (const beam of this.beams) {
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
    let color, hz;
    if (s < VIZ.STRAIN_HIGH) {
      color = VIZ.OVERLAY_COLOR_MED;
      hz = VIZ.PULSE_HZ_MED;
    } else if (s < VIZ.STRAIN_CRIT) {
      color = VIZ.OVERLAY_COLOR_HIGH;
      hz = VIZ.PULSE_HZ_HIGH;
    } else {
      color = VIZ.OVERLAY_COLOR_CRIT;
      hz = VIZ.PULSE_HZ_CRIT;
    }
    return { color, hz };
  }

  // Test-mode base draw: brown wood planks from live physics bodies. Always
  // brown, never color-shifted — stress is its own layer (redrawStressOverlay).
  redrawBeamBases() {
    this.beamsGraphics.clear();
    this.beamsGraphics.lineStyle(VIZ.BEAM_BASE_THICKNESS, VIZ.BEAM_BASE_COLOR, 1);
    for (const { constraint } of physics._beamConstraints) {
      const aX = constraint.bodyA.position.x, aY = constraint.bodyA.position.y;
      const bX = constraint.bodyB.position.x, bY = constraint.bodyB.position.y;
      this.beamsGraphics.beginPath();
      this.beamsGraphics.moveTo(aX, aY);
      this.beamsGraphics.lineTo(bX, bY);
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
      const thickness = VIZ.BEAM_BASE_THICKNESS + VIZ.OVERLAY_THICKNESS_BONUS * s;

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
        // Filled square with 4 rivet dots at the corners.
        const half = VIZ.ANCHOR_SIZE / 2;
        this.jointsGraphics.fillStyle(VIZ.ANCHOR_COLOR, 1);
        this.jointsGraphics.fillRect(x - half, y - half, VIZ.ANCHOR_SIZE, VIZ.ANCHOR_SIZE);
        this.jointsGraphics.fillStyle(0x3a0a0a, 1);
        const r = half - 3;
        for (const [dx, dy] of [[-r, -r], [r, -r], [-r, r], [r, r]]) {
          this.jointsGraphics.fillCircle(x + dx, y + dy, 1.5);
        }
        continue;
      }

      // Mid-joint pin: optional glow first (so pin draws on top), then ring,
      // then filled pin.
      const s = jointStrain.get(body) ?? 0;
      if (s >= VIZ.STRAIN_HIGH) {
        const denom = Math.max(VIZ.STRAIN_CRIT - VIZ.STRAIN_HIGH, 0.0001);
        const t = Math.min(1, Math.max(0, (s - VIZ.STRAIN_HIGH) / denom));
        const glowColor = Phaser.Display.Color.Interpolate.ColorWithColor(
          Phaser.Display.Color.IntegerToColor(VIZ.JOINT_GLOW_COLOR_HIGH),
          Phaser.Display.Color.IntegerToColor(VIZ.JOINT_GLOW_COLOR_CRIT),
          100, Math.round(t * 100)
        );
        const glowInt = (glowColor.r << 16) | (glowColor.g << 8) | glowColor.b;
        this.jointsGraphics.fillStyle(glowInt, VIZ.JOINT_GLOW_ALPHA_MAX * s);
        this.jointsGraphics.fillCircle(x, y, VIZ.JOINT_GLOW_RADIUS_MAX * s);
      }
      this.jointsGraphics.lineStyle(1, VIZ.JOINT_RING_COLOR, 1);
      this.jointsGraphics.strokeCircle(x, y, VIZ.JOINT_RADIUS + 1);
      this.jointsGraphics.fillStyle(VIZ.JOINT_COLOR, 1);
      this.jointsGraphics.fillCircle(x, y, VIZ.JOINT_RADIUS);
    }
  }

  toggleTest() {
    if (this.mode === 'build') {
      physics.captureSnapshot();
      this.mode = 'test';
      this.testButtonLabel.setText('RESET');
      physics.setTimeScale(1.0);
      physics.setRunnerEnabled(true);   // start simulating
      const vehicleConfig = this.level.vehicles[0]; // spec §2 rule 3: always an array
      physics.spawnVehicle(vehicleConfig);
      cam.follow(() => physics.getVehicleChassisPosition());
      this.vehicleGraphics = this.add.graphics();
      this.testEndAt = 0;
    } else {
      this.rebuildBridge();
      cam.follow(null);
      this.cameras.main.scrollX = 0;
      this.cameras.main.scrollY = 0;
      this.mode = 'build';
      this.testButtonLabel.setText('TEST');
      physics.setRunnerEnabled(false);
      this.vehicleGraphics?.clear();
      this.stressGraphics.clear();
      this._jointStrain = null;
      this.redrawBeams();
      this.redrawJoints(new Map());
      this.winOverlay?.destroy(); this.winOverlay = null;
      this.failOverlay?.destroy(); this.failOverlay = null;
      this.testEndAt = 0;
    }
  }

  // Full level reset: wipe the Matter world, rebuild the canyon walls, then
  // rebuild every joint and beam from the scene-side data. The player's
  // design (this.joints + this.beams) is preserved across the reset.
  rebuildBridge() {
    physics.reset();
    physics.buildCanyon(this.level.canyon);
    for (const j of this.joints) {
      physics.ensureJointNode(j.bodyId, j.x, j.y, j.isAnchor);
    }
    for (const beam of this.beams) {
      const matA = physics._nodes.get(beam.a.bodyId);
      const matB = physics._nodes.get(beam.b.bodyId);
      if (matA && matB) physics.buildBeam(matA, matB, this.material);
    }
  }

  // Wipe the player's bridge design. Called before auto-restart after
  // win/fail so the next round starts on an empty canyon.
  clearBridgeData() {
    this.beams = [];
    this.pendingJointA = null;
    this.joints = this.level.anchors.map(
      a => ({ x: a.x, y: a.y, isAnchor: true, bodyId: a.id })
    );
  }

  update() {
    if (this.mode === 'test') {
      physics.tickWatchdog();
      // Stop driving once a win/fail is in flight so the car doesn't drift
      // past the result.
      if (!this.testEndAt) physics.driveVehicle();
      physics.evaluateStress(this.time.now, physics.getTimeScale());
      juice.tick(this.time.now, physics.isCascadeActive(this.time.now));
      cam.tick(this.time.now);
      this.updateCreakAudio();
      this.redrawBeamBases();
      this._jointStrain = this.redrawStressOverlay();
      this.redrawJoints(this._jointStrain);
      this.redrawVehicle();
      this.checkWin();
      this.checkFall();
      // Auto-return to build mode after the result has been on screen ~1.5s.
      // Wipe the player's design first so they start each round with a clean
      // canyon (manual RESET, by contrast, keeps the design intact).
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
    if (!this.vehicleGraphics) return;
    this.vehicleGraphics.clear();
    const v = physics._vehicle;
    if (!v) return;
    const c = v.chassis;
    this.vehicleGraphics.fillStyle(0xf08c1a, 1);
    this.vehicleGraphics.fillRect(c.position.x - 40, c.position.y - 12, 80, 24);
    this.vehicleGraphics.lineStyle(2, 0x331a00, 1);
    this.vehicleGraphics.strokeRect(c.position.x - 40, c.position.y - 12, 80, 24);
    this.vehicleGraphics.fillStyle(0x222222, 1);
    for (const w of v.wheels) {
      this.vehicleGraphics.fillCircle(w.position.x, w.position.y, 12);
    }
  }
}
