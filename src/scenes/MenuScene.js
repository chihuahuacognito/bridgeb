// src/scenes/MenuScene.js
import Phaser from 'phaser';
import { ALL_LEVELS, LEVEL_ORDER, menuEntries } from '../data/leveldata.js';
import { bus } from '../ui-html/bus.js';

const PHASE_COLORS = { tutorial: 0x2e7d32, topic: 0x1565c0, challenge: 0x7b1fa2 };
const PHASE_LABELS = { tutorial: 'LEARN THE ROPES', topic: 'DISCOVER', challenge: 'PROVE IT' };

export class MenuScene extends Phaser.Scene {
  constructor() {
    super('MenuScene');
  }

  create() {
    bus.emit('ui:screen', 'menu');
    this.cameras.main.setBackgroundColor('#1a1a2e');

    this.add.text(640, 70, 'BRIDGE BUILDER', {
      fontSize: '48px', color: '#ffffff', fontStyle: 'bold',
    }).setOrigin(0.5);
    this.add.text(640, 120, 'Pick a level', {
      fontSize: '18px', color: '#aaaaaa',
    }).setOrigin(0.5);

    const entries = menuEntries(ALL_LEVELS, LEVEL_ORDER);
    const COLS = 4, CW = 270, CH = 108, GX = 26, GY = 38;
    const x0 = 640 - ((COLS - 1) * (CW + GX)) / 2;

    entries.forEach((e, i) => {
      const x = x0 + (i % COLS) * (CW + GX);
      const y = 220 + Math.floor(i / COLS) * (CH + GY);

      const card = this.add.rectangle(x, y, CW, CH, PHASE_COLORS[e.phase] ?? 0x444444)
        .setStrokeStyle(2, 0xffffff, 0.25)
        .setInteractive({ useHandCursor: true });
      this.add.text(x, y - 22, `${i + 1}`, {
        fontSize: '30px', color: '#ffffff', fontStyle: 'bold',
      }).setOrigin(0.5);
      this.add.text(x, y + 14, e.title, {
        fontSize: '17px', color: '#e8e8e8',
      }).setOrigin(0.5);
      this.add.text(x, y + 38, PHASE_LABELS[e.phase] ?? '', {
        fontSize: '11px', color: '#ffffff',
      }).setOrigin(0.5).setAlpha(0.6);

      card.on('pointerdown', () => this.scene.start('LevelScene', { levelId: e.id }));
      card.on('pointerover', () => card.setAlpha(0.8));
      card.on('pointerout',  () => card.setAlpha(1));
    });

    // Dev back door: ?dev in the URL exposes the stress level.
    if (typeof window !== 'undefined' && window.location.search.includes('dev')) {
      const devBtn = this.add.rectangle(640, 660, 300, 44, 0x7b1fa2).setInteractive();
      this.add.text(640, 660, 'DEV — STRESS TEST', { fontSize: '16px', color: '#fff' }).setOrigin(0.5);
      devBtn.on('pointerdown', () => this.scene.start('LevelScene', { levelId: 'DEV_STRESS' }));
    }
  }
}
