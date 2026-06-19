// src/scenes/BootScene.js
import Phaser from 'phaser';
import { assets } from '../systems/assets.js';

const WORLD_ASSET_KEYS = [
  'background',
  'cliff-left', 'cliff-right', 'rocky_cliff', 'rock-pillar',
  'car', 'truck', 'tank',
  'cloud-1', 'cloud-2', 'cloud-3',
  'water', 'flag', 'tree',
];

export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  preload() {
    for (const key of WORLD_ASSET_KEYS) {
      this.load.image(key, `assets/world/${key}.png`);
    }
    this.load.on('loaderror', (file) => {
      assets.markMissing(file.key);
      console.warn(`[assets] missing: ${file.key}.png — placeholder will render (Phase 2 TODO)`);
    });
  }

  create() {
    this.scene.start('MenuScene');
  }
}
