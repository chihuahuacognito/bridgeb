// src/scenes/LevelSelectScene.js
// Per-module level picker. Receives { moduleId } and renders that module's four
// levels as bricks. Phase (PLAY / DISCOVER / PROVE IT) shows as a small tag so
// mixed-phase modules read cleanly. Generalized from the former flat MenuScene.
import Phaser from 'phaser';
import { ALL_LEVELS, MODULES, MODULE_ORDER, menuEntries } from '../data/leveldata.js';
import { bus } from '../ui-html/bus.js';
import {
  T, FONT_DISPLAY, FONT_BODY, PHASE_LABEL,
  drawWorld, makeBrick, makeChip, popIn,
} from './ui/menuTheme.js';

const MODULE_FACE = { M1_GRAVITY: T.faces.sky, M2_SHAPES: T.faces.violet, M3_WEIGHT: T.faces.amber };

export class LevelSelectScene extends Phaser.Scene {
  constructor() {
    super('LevelSelectScene');
  }

  init(data) {
    this.moduleId = (data && data.moduleId) || MODULE_ORDER[0];
  }

  create() {
    bus.emit('ui:screen', 'menu');
    drawWorld(this);

    const mod = MODULES[this.moduleId] ?? MODULES[MODULE_ORDER[0]];
    const face = MODULE_FACE[this.moduleId] ?? T.faces.sky;

    makeChip(this, { x: 84, y: 44, text: '← Back', fill: 0x24375c, onClick: () => this.scene.start('ModuleSelectScene') });

    this.add.text(640, 88, mod.title, {
      fontFamily: FONT_DISPLAY, fontStyle: '700', fontSize: '44px', color: T.textHi,
    }).setOrigin(0.5);
    this.add.text(640, 132, 'Pick a level', {
      fontFamily: FONT_BODY, fontStyle: '600', fontSize: '17px', color: T.textMute,
    }).setOrigin(0.5);

    const entries = menuEntries(ALL_LEVELS, mod.levelIds);
    const W = 250, H = 190, GAP = 26;
    const x0 = 640 - ((entries.length - 1) * (W + GAP)) / 2;
    const y = 360;

    const bricks = entries.map((e, i) => {
      const x = x0 + i * (W + GAP);
      const b = makeBrick(this, {
        x, y, w: W, h: H, color: face,
        onClick: () => this.scene.start('LevelScene', { levelId: e.id }),
      });
      const cy = b.faceCenterY;

      const eyebrow = this.add.text(0, cy - 62, `LEVEL ${i + 1}`, {
        fontFamily: FONT_BODY, fontStyle: '800', fontSize: '13px', color: T.onBrickSoft,
      }).setOrigin(0.5).setLetterSpacing(3).setAlpha(0.85);
      const title = this.add.text(0, cy - 16, e.title, {
        fontFamily: FONT_DISPLAY, fontStyle: '700', fontSize: '20px', color: T.onBrick,
        align: 'center', wordWrap: { width: W - 40 }, lineSpacing: 2,
      }).setOrigin(0.5);
      b.face.add([eyebrow, title]);

      const pill = makeChip(this, {
        x: 0, y: cy + 58, text: PHASE_LABEL[e.phase] ?? '', fontSize: 12, padX: 12,
        fill: T.phase[e.phase] ?? 0x2b3a57, textColor: '#0d1b30',
      });
      b.face.add(pill);
      return b.container;
    });

    popIn(this, bricks);
  }
}
