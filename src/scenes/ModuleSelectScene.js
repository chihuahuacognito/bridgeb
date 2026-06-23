// src/scenes/ModuleSelectScene.js
// Bridge Builder module picker: three STEM modules + the Dev Stress Test.
import Phaser from 'phaser';
import { MODULES, MODULE_ORDER } from '../data/leveldata.js';
import { bus } from '../ui-html/bus.js';
import { T, FONT_DISPLAY, FONT_BODY, drawWorld, makeBrick, makeChip, popIn } from './ui/menuTheme.js';

const MODULE_FACE = { M1_GRAVITY: T.faces.sky, M2_SHAPES: T.faces.violet, M3_WEIGHT: T.faces.amber };

export class ModuleSelectScene extends Phaser.Scene {
  constructor() {
    super('ModuleSelectScene');
  }

  create() {
    bus.emit('ui:screen', 'menu');
    drawWorld(this);

    makeChip(this, { x: 84, y: 44, text: '← Back', fill: 0x24375c, onClick: () => this.scene.start('AppSelectScene') });

    this.add.text(640, 88, 'BRIDGE BUILDER', {
      fontFamily: FONT_DISPLAY, fontStyle: '700', fontSize: '46px', color: T.textHi,
    }).setOrigin(0.5);
    this.add.text(640, 132, 'Pick a module to start building', {
      fontFamily: FONT_BODY, fontStyle: '600', fontSize: '17px', color: T.textMute,
    }).setOrigin(0.5);

    const W = 360, H = 240, GAP = 40;
    const x0 = 640 - ((MODULE_ORDER.length - 1) * (W + GAP)) / 2;
    const y = 350;

    const bricks = MODULE_ORDER.map((id, i) => {
      const m = MODULES[id];
      const x = x0 + i * (W + GAP);
      const b = makeBrick(this, {
        x, y, w: W, h: H, color: MODULE_FACE[id] ?? T.faces.sky,
        onClick: () => this.scene.start('LevelSelectScene', { moduleId: id }),
      });
      const cy = b.faceCenterY;

      const num = this.add.text(0, cy - 74, `MODULE ${i + 1}`, {
        fontFamily: FONT_BODY, fontStyle: '800', fontSize: '14px', color: T.onBrickSoft,
      }).setOrigin(0.5).setLetterSpacing(3).setAlpha(0.85);
      const title = this.add.text(0, cy - 30, m.title, {
        fontFamily: FONT_DISPLAY, fontStyle: '700', fontSize: '27px', color: T.onBrick,
        align: 'center', wordWrap: { width: W - 56 },
      }).setOrigin(0.5);
      const blurb = this.add.text(0, cy + 44, m.blurb, {
        fontFamily: FONT_BODY, fontStyle: '600', fontSize: '15px', color: T.onBrickSoft,
        align: 'center', wordWrap: { width: W - 56 }, lineSpacing: 3,
      }).setOrigin(0.5);
      b.face.add([num, title, blurb]);
      return b.container;
    });

    popIn(this, bricks);

    // Dev Stress Test — a small utility chip, set apart from the lesson modules.
    makeChip(this, {
      x: 640, y: y + H / 2 + 66, text: '🔧 Dev — Stress Test', fill: 0x6a1b9a, textColor: '#e9d4f5',
      onClick: () => this.scene.start('LevelScene', { levelId: 'DEV_STRESS' }),
    });
  }
}
