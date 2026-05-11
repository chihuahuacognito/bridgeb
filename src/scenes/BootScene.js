// src/scenes/BootScene.js
import Phaser from 'phaser';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  // Phase 1 loads no external assets — Phase 2 will populate this.
  preload() {}

  create() {
    this.scene.start('LevelScene', { levelId: 'L1' });
  }
}
