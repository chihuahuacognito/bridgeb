// src/scenes/LevelScene.js
import Phaser from 'phaser';
import { ALL_LEVELS } from '../data/leveldata.js';
import physics from '../systems/physics.js';

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

    // Create anchor bodies and add them to the joints registry by id.
    for (const a of this.level.anchors) {
      physics.ensureJointNode(a.id, a.x, a.y, /* isAnchor */ true);
      // Match data joint to physics body for snap-back resolution.
      const dataJoint = this.joints.find(j => j.x === a.x && j.y === a.y);
      if (dataJoint) dataJoint.bodyId = a.id;
    }

    this.mode = 'build';                 // 'build' | 'test'
    this.material = this.level.materials.wood;
    this.beamConstraints = [];           // mirrors physics._beamConstraints, for rendering

    // Test/Reset button overlay
    this.testButton = this.add.rectangle(640, 40, 200, 50, 0x2e7d32).setInteractive();
    this.testButtonLabel = this.add.text(640, 40, 'TEST', { fontSize: '20px', color: '#fff' }).setOrigin(0.5);
    this.testButton.on('pointerdown', () => this.toggleTest());

    // Start paused: pause Matter until the player hits TEST.
    physics.setRunnerEnabled(false);

    this.events.on('shutdown', () => physics.detach(this));
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
    this.beamsGraphics.lineStyle(6, 0x9b6b3a, 1);
    for (const { constraint } of physics._beamConstraints) {
      this.beamsGraphics.beginPath();
      this.beamsGraphics.moveTo(constraint.bodyA.position.x, constraint.bodyA.position.y);
      this.beamsGraphics.lineTo(constraint.bodyB.position.x, constraint.bodyB.position.y);
      this.beamsGraphics.strokePath();
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
      this.vehicleGraphics = this.add.graphics();
    } else {
      physics.softRestart();
      this.mode = 'build';
      this.testButtonLabel.setText('TEST');
      physics.setRunnerEnabled(false);
      this.redrawBeams();
      this.vehicleGraphics?.clear();
    }
  }

  update() {
    if (this.mode === 'test') {
      physics.tickWatchdog();
      physics.driveVehicle();
      this.redrawBeamsFromBodies();
      this.redrawVehicle();
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
