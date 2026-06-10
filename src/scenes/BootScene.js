// src/scenes/BootScene.js
import Phaser from 'phaser';
import { assets } from '../systems/assets.js';

const WORLD_ASSET_KEYS = [
  'background',
  'cliff-left', 'cliff-right',
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
    this.cameras.main.setBackgroundColor('#1a1a2e');

    this.add.text(640, 140, 'BRIDGE BUILDER', {
      fontSize: '48px', color: '#ffffff', fontStyle: 'bold',
    }).setOrigin(0.5);
    this.add.text(640, 200, 'Select a level', {
      fontSize: '18px', color: '#aaaaaa',
    }).setOrigin(0.5);

    const levels = [
      { id: 'L1',         label: 'L1 — Forces & Gravity',  color: 0x2e7d32 },
      { id: 'DEV_STRESS', label: 'Dev — Stress Test',      color: 0x7b1fa2 },
    ];

    levels.forEach(({ id, label, color }, i) => {
      const y = 320 + i * 80;
      const btn = this.add.rectangle(640, y, 400, 58, color).setInteractive();
      this.add.text(640, y, label, { fontSize: '24px', color: '#fff' }).setOrigin(0.5);
      btn.on('pointerdown', () => this.scene.start('LevelScene', { levelId: id }));
      btn.on('pointerover',  () => btn.setAlpha(0.75));
      btn.on('pointerout',   () => btn.setAlpha(1));
    });
  }
}
