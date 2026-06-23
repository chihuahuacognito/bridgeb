// src/scenes/ModuleSelectScene.js
// Bridge Builder module picker: three STEM modules + the Dev Stress Test.
import Phaser from 'phaser';
import { MODULES, MODULE_ORDER } from '../data/leveldata.js';
import { bus } from '../ui-html/bus.js';

const MODULE_COLORS = { M1_GRAVITY: 0x2e7d32, M2_SHAPES: 0x1565c0, M3_WEIGHT: 0x7b1fa2 };

export class ModuleSelectScene extends Phaser.Scene {
  constructor() {
    super('ModuleSelectScene');
  }

  create() {
    bus.emit('ui:screen', 'menu');
    this.cameras.main.setBackgroundColor('#1a1a2e');

    this.add.text(640, 80, 'BRIDGE BUILDER', {
      fontSize: '48px', color: '#ffffff', fontStyle: 'bold',
    }).setOrigin(0.5);
    this.add.text(640, 128, 'Choose a module', {
      fontSize: '18px', color: '#aaaaaa',
    }).setOrigin(0.5);

    const CW = 360, CH = 200, GX = 36;
    const x0 = 640 - (MODULE_ORDER.length - 1) * (CW + GX) / 2;
    const y = 330;

    MODULE_ORDER.forEach((id, i) => {
      const m = MODULES[id];
      const x = x0 + i * (CW + GX);
      const card = this.add.rectangle(x, y, CW, CH, MODULE_COLORS[id] ?? 0x444444)
        .setStrokeStyle(2, 0xffffff, 0.25)
        .setInteractive({ useHandCursor: true });
      this.add.text(x, y - 50, `${i + 1}`, {
        fontSize: '28px', color: '#ffffff', fontStyle: 'bold',
      }).setOrigin(0.5).setAlpha(0.7);
      this.add.text(x, y - 8, m.title, {
        fontSize: '24px', color: '#ffffff', fontStyle: 'bold',
        align: 'center', wordWrap: { width: CW - 48 },
      }).setOrigin(0.5);
      this.add.text(x, y + 50, m.blurb, {
        fontSize: '14px', color: '#e8e8e8', align: 'center', wordWrap: { width: CW - 48 },
      }).setOrigin(0.5).setAlpha(0.8);

      card.on('pointerdown', () => this.scene.start('LevelSelectScene', { moduleId: id }));
      card.on('pointerover', () => card.setAlpha(0.85));
      card.on('pointerout', () => card.setAlpha(1));
    });

    // Dev Stress Test — separate from the modules.
    const devY = y + CH / 2 + 70;
    const devBtn = this.add.rectangle(640, devY, 300, 44, 0x6a1b9a)
      .setStrokeStyle(2, 0xce93d8, 0.5)
      .setInteractive({ useHandCursor: true });
    this.add.text(640, devY, 'Dev — Stress Test', { fontSize: '16px', color: '#e1bee7' }).setOrigin(0.5);
    devBtn.on('pointerdown', () => this.scene.start('LevelScene', { levelId: 'DEV_STRESS' }));
    devBtn.on('pointerover', () => devBtn.setAlpha(0.8));
    devBtn.on('pointerout', () => devBtn.setAlpha(1));

    this._addBack(() => this.scene.start('AppSelectScene'));
  }

  _addBack(onClick) {
    const b = this.add.rectangle(80, 40, 110, 40, 0x33384d)
      .setStrokeStyle(2, 0xffffff, 0.2)
      .setInteractive({ useHandCursor: true });
    this.add.text(80, 40, '← Back', { fontSize: '16px', color: '#cfd3e0' }).setOrigin(0.5);
    b.on('pointerdown', onClick);
    b.on('pointerover', () => b.setAlpha(0.8));
    b.on('pointerout', () => b.setAlpha(1));
  }
}
