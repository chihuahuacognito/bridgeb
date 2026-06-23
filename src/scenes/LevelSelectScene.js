// src/scenes/LevelSelectScene.js
// Per-module level picker. Receives { moduleId } and renders that module's four
// levels. Cards keep their per-level phase colour/label (modules are not
// phase-homogeneous). Generalized from the former flat MenuScene.
import Phaser from 'phaser';
import { ALL_LEVELS, MODULES, MODULE_ORDER, menuEntries } from '../data/leveldata.js';
import { bus } from '../ui-html/bus.js';

const PHASE_COLORS = { tutorial: 0x2e7d32, topic: 0x1565c0, challenge: 0x7b1fa2 };
const PHASE_LABELS = { tutorial: 'LEARN THE ROPES', topic: 'DISCOVER', challenge: 'PROVE IT' };

export class LevelSelectScene extends Phaser.Scene {
  constructor() {
    super('LevelSelectScene');
  }

  init(data) {
    this.moduleId = (data && data.moduleId) || MODULE_ORDER[0];
  }

  create() {
    bus.emit('ui:screen', 'menu');
    this.cameras.main.setBackgroundColor('#1a1a2e');

    const mod = MODULES[this.moduleId] ?? MODULES[MODULE_ORDER[0]];

    this.add.text(640, 80, mod.title.toUpperCase(), {
      fontSize: '44px', color: '#ffffff', fontStyle: 'bold',
    }).setOrigin(0.5);
    this.add.text(640, 126, 'Pick a level', {
      fontSize: '18px', color: '#aaaaaa',
    }).setOrigin(0.5);

    // Build cards from this module's levelIds → numbers read 1..4 within the module.
    const entries = menuEntries(ALL_LEVELS, mod.levelIds);
    const COLS = 4, CW = 270, CH = 130, GX = 26;
    const x0 = 640 - ((COLS - 1) * (CW + GX)) / 2;
    const y = 320;

    entries.forEach((e, i) => {
      const x = x0 + i * (CW + GX);
      const card = this.add.rectangle(x, y, CW, CH, PHASE_COLORS[e.phase] ?? 0x444444)
        .setStrokeStyle(2, 0xffffff, 0.25)
        .setInteractive({ useHandCursor: true });
      this.add.text(x, y - 30, `${i + 1}`, {
        fontSize: '32px', color: '#ffffff', fontStyle: 'bold',
      }).setOrigin(0.5);
      this.add.text(x, y + 10, e.title, {
        fontSize: '18px', color: '#e8e8e8', align: 'center', wordWrap: { width: CW - 30 },
      }).setOrigin(0.5);
      this.add.text(x, y + 44, PHASE_LABELS[e.phase] ?? '', {
        fontSize: '11px', color: '#ffffff',
      }).setOrigin(0.5).setAlpha(0.6);

      card.on('pointerdown', () => this.scene.start('LevelScene', { levelId: e.id }));
      card.on('pointerover', () => card.setAlpha(0.8));
      card.on('pointerout', () => card.setAlpha(1));
    });

    // Back → module picker.
    const b = this.add.rectangle(80, 40, 110, 40, 0x33384d)
      .setStrokeStyle(2, 0xffffff, 0.2)
      .setInteractive({ useHandCursor: true });
    this.add.text(80, 40, '← Back', { fontSize: '16px', color: '#cfd3e0' }).setOrigin(0.5);
    b.on('pointerdown', () => this.scene.start('ModuleSelectScene'));
    b.on('pointerover', () => b.setAlpha(0.8));
    b.on('pointerout', () => b.setAlpha(1));
  }
}
