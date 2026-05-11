// src/scenes/LevelScene.js
import Phaser from 'phaser';
import { ALL_LEVELS } from '../data/leveldata.js';
import physics from '../systems/physics.js';
import audio from '../systems/audio.js';
import juice from '../systems/juice.js';
import cam from '../systems/camera.js';

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
    this.drawAnchors();

    this.beamsGraphics = this.add.graphics();
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

    this.mode = 'build';                 // 'build' | 'test'
    this.material = this.level.materials.wood;
    this.beamConstraints = [];           // mirrors physics._beamConstraints, for rendering

    // Test/Reset button overlay
    this.testButton = this.add.rectangle(640, 40, 200, 50, 0x2e7d32).setInteractive();
    this.testButtonLabel = this.add.text(640, 40, 'TEST', { fontSize: '20px', color: '#fff' }).setOrigin(0.5);
    this.testButton.on('pointerdown', () => this.toggleTest());

    // Start paused: pause Matter until the player hits TEST.
    physics.setRunnerEnabled(false);

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

  drawAnchors() {
    const g = this.add.graphics();
    g.fillStyle(0xff3b3b, 1);
    for (const a of this.level.anchors) {
      g.fillCircle(a.x, a.y, 12);
      g.lineStyle(2, 0xffffff, 0.9);
      g.strokeCircle(a.x, a.y, 16);
    }
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

  redrawBeams() {
    this.beamsGraphics.clear();
    this.beamsGraphics.lineStyle(6, 0x9b6b3a, 1); // wood brown
    for (const beam of this.beams) {
      this.beamsGraphics.beginPath();
      this.beamsGraphics.moveTo(beam.a.x, beam.a.y);
      this.beamsGraphics.lineTo(beam.b.x, beam.b.y);
      this.beamsGraphics.strokePath();
    }
  }

  redrawBeamsFromBodies() {
    this.beamsGraphics.clear();
    for (const { constraint } of physics._beamConstraints) {
      const stress = physics.readStressSmoothed(constraint);
      const color = this.stressColor(stress);
      const thickness = 6 + stress * 2;

      let aX = constraint.bodyA.position.x, aY = constraint.bodyA.position.y;
      let bX = constraint.bodyB.position.x, bY = constraint.bodyB.position.y;
      if (stress > 0.85) {
        const t = this.time.now / 1000;
        const freq = 10; // 10 Hz, spec range 8-12
        const amp = 1.5; // px
        const perp = { x: -(bY - aY), y: (bX - aX) };
        const pm = Math.hypot(perp.x, perp.y) || 1;
        perp.x /= pm; perp.y /= pm;
        const wobble = Math.sin(t * 2 * Math.PI * freq) * amp;
        aX += perp.x * wobble; aY += perp.y * wobble;
        bX += perp.x * wobble; bY += perp.y * wobble;
      }

      this.beamsGraphics.lineStyle(thickness, color, 1);
      this.beamsGraphics.beginPath();
      this.beamsGraphics.moveTo(aX, aY);
      this.beamsGraphics.lineTo(bX, bY);
      this.beamsGraphics.strokePath();
      if (stress > 0.5) this.drawStressGlow(constraint, stress, color);
    }
  }

  stressColor(s) {
    // Green (0x33cc33) → Yellow (0xffcc00) → Red (0xff3333)
    if (s < 0.5) {
      const t = s / 0.5;
      return Phaser.Display.Color.GetColor(
        Math.round(0x33 + (0xff - 0x33) * t),
        Math.round(0xcc + (0xcc - 0xcc) * t),
        Math.round(0x33 + (0x00 - 0x33) * t)
      );
    }
    const t = (s - 0.5) / 0.5;
    return Phaser.Display.Color.GetColor(
      0xff,
      Math.round(0xcc - 0xcc * t * 0.6),
      Math.round(0x00 + (0x33 - 0x00) * t)
    );
  }

  drawStressGlow(c, stress, color) {
    const radius = 10 + stress * 12;
    this.beamsGraphics.fillStyle(color, 0.25 * stress);
    const mx = (c.bodyA.position.x + c.bodyB.position.x) / 2;
    const my = (c.bodyA.position.y + c.bodyB.position.y) / 2;
    this.beamsGraphics.fillCircle(mx, my, radius);
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
    } else {
      physics.softRestart();
      this.mode = 'build';
      this.testButtonLabel.setText('TEST');
      physics.setRunnerEnabled(false);
      this.redrawBeams();
      this.vehicleGraphics?.clear();
      this.winOverlay?.destroy(); this.winOverlay = null;
      this.failOverlay?.destroy(); this.failOverlay = null;
    }
  }

  update() {
    if (this.mode === 'test') {
      physics.tickWatchdog();
      physics.driveVehicle();
      physics.evaluateStress(this.time.now, physics.getTimeScale());
      juice.tick(this.time.now, physics.isCascadeActive(this.time.now));
      cam.tick(this.time.now);
      this.updateCreakAudio();
      this.redrawBeamsFromBodies();
      this.redrawVehicle();
      this.checkWin();
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
      { fontSize: '64px', color: '#ff3333', fontStyle: 'bold' }).setOrigin(0.5);
  }

  showWin() {
    this.winOverlay = this.add.text(640, 360, 'BRIDGE HOLDS',
      { fontSize: '64px', color: '#33cc33', fontStyle: 'bold' }).setOrigin(0.5);
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
