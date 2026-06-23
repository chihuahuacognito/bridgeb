// src/scenes/AppSelectScene.js
// Top-level app picker (root scene). Bridge Builder is unlocked; the other apps
// render as visual-only locked tiles until their apps exist.
import Phaser from 'phaser';
import { APPS } from '../data/leveldata.js';
import { bus } from '../ui-html/bus.js';
import { T, FONT_DISPLAY, FONT_BODY, drawBlueprint, makeBrick, makeChip, popIn } from './ui/menuTheme.js';

const FACE = { bridge: T.faces.bridge, rocket: T.faces.rocket, farm: T.faces.farm };
const ICON = { bridge: '🌉', rocket: '🚀', farm: '🌱' };
const ROUTE = { bridge: 'ModuleSelectScene' };

export class AppSelectScene extends Phaser.Scene {
  constructor() {
    super('AppSelectScene');
  }

  create() {
    bus.emit('ui:screen', 'menu'); // keep the in-game HTML HUD hidden
    drawBlueprint(this);

    this.add.text(640, 92, 'STEM LAB', {
      fontFamily: FONT_BODY, fontStyle: '800', fontSize: '20px', color: '#36e0d8',
    }).setOrigin(0.5).setLetterSpacing(6);
    this.add.text(640, 138, 'Choose a world', {
      fontFamily: FONT_DISPLAY, fontStyle: '700', fontSize: '52px', color: T.textHi,
    }).setOrigin(0.5);

    const W = 300, H = 270, GAP = 50;
    const x0 = 640 - ((APPS.length - 1) * (W + GAP)) / 2;
    const y = 410;

    const bricks = APPS.map((app, i) => {
      const x = x0 + i * (W + GAP);
      const locked = app.locked;
      const b = makeBrick(this, {
        x, y, w: W, h: H, color: FACE[app.id], locked,
        onClick: locked ? null : () => this.scene.start(ROUTE[app.id]),
      });
      const cy = b.faceCenterY;

      const icon = this.add.text(0, cy - 64, ICON[app.id], { fontSize: '70px' })
        .setOrigin(0.5).setAlpha(locked ? 0.5 : 1);
      b.face.add(icon);

      const name = this.add.text(0, cy + 26, app.title.toUpperCase(), {
        fontFamily: FONT_DISPLAY, fontStyle: '700', fontSize: '26px',
        color: locked ? '#9fb0cc' : T.onBrick, align: 'center', lineSpacing: 2,
      }).setOrigin(0.5);
      b.face.add(name);

      const badge = makeChip(this, {
        x: 0, y: cy + 92,
        text: locked ? '🔒 Coming soon' : '▶ Play',
        fill: locked ? 0x2b3a57 : T.onBrick,
        textColor: locked ? '#9fb0cc' : '#ffe9c4',
        fontSize: 15,
      });
      b.face.add(badge);
      return b.container;
    });

    popIn(this, bricks);

    this.add.text(640, 690, 'Two more worlds coming soon — keep building!', {
      fontFamily: FONT_BODY, fontStyle: '600', fontSize: '15px', color: T.textMute,
    }).setOrigin(0.5);
  }
}
