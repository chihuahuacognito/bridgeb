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
    // Gate on web-font readiness so the canvas menus render in Fredoka/Nunito
    // instead of a fallback that Phaser won't auto-redraw once the font loads.
    const fonts = ['600 16px Fredoka', '700 16px Fredoka', '400 16px Nunito', '700 16px Nunito', '800 16px Nunito'];
    const ready = (typeof document !== 'undefined' && document.fonts)
      ? Promise.all(fonts.map((f) => document.fonts.load(f))).catch(() => {})
      : Promise.resolve();
    ready.finally(() => this.scene.start('AppSelectScene'));
  }
}
