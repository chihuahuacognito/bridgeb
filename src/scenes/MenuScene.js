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

    // Dev stress test — always visible below the level grid.
    const rows = Math.ceil(entries.length / COLS);
    const gridBottom = 220 + (rows - 1) * (CH + GY) + CH / 2;
    const devY = gridBottom + 50;
    const devBtn = this.add.rectangle(640, devY, 300, 44, 0x6a1b9a)
      .setStrokeStyle(2, 0xce93d8, 0.5)
      .setInteractive({ useHandCursor: true });
    this.add.text(640, devY, 'Dev — Stress Test', { fontSize: '16px', color: '#e1bee7' }).setOrigin(0.5);
    devBtn.on('pointerdown', () => this.scene.start('LevelScene', { levelId: 'DEV_STRESS' }));
    devBtn.on('pointerover', () => devBtn.setAlpha(0.8));
    devBtn.on('pointerout',  () => devBtn.setAlpha(1));
  }
}
