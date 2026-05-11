// src/scenes/LevelScene.js
import Phaser from 'phaser';
import { ALL_LEVELS } from '../data/leveldata.js';

export class LevelScene extends Phaser.Scene {
  constructor() {
    super('LevelScene');
  }

  init(data) {
    this.levelId = data.levelId || 'L1';
    this.level = ALL_LEVELS[this.levelId];
  }

  create() {
    this.drawSky();
    this.drawCanyon();
    this.drawWater();
    this.drawAnchors();

    this.beams = [];               // [{ a: {x,y}, b: {x,y} }]
    this.pendingJointA = null;     // first click waiting for second
    this.beamsGraphics = this.add.graphics();
    this.ghostGraphics = this.add.graphics();

    this.input.on('pointerdown', (pointer) => this.handleClick(pointer));
    this.input.on('pointermove', (pointer) => this.handleHover(pointer));
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

  handleClick(pointer) {
    const p = { x: pointer.worldX, y: pointer.worldY };
    if (!this.pendingJointA) {
      this.pendingJointA = p;
    } else {
      this.beams.push({ a: this.pendingJointA, b: p });
      this.pendingJointA = null;
      this.redrawBeams();
    }
  }

  handleHover(pointer) {
    this.ghostGraphics.clear();
    if (this.pendingJointA) {
      this.ghostGraphics.lineStyle(4, 0x9b6b3a, 0.4);
      this.ghostGraphics.beginPath();
      this.ghostGraphics.moveTo(this.pendingJointA.x, this.pendingJointA.y);
      this.ghostGraphics.lineTo(pointer.worldX, pointer.worldY);
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
}
