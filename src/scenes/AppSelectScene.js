// src/scenes/AppSelectScene.js
// Top-level app picker (root). The hub is a calm engineering lab; each tile shows
// a slice of its own world. Bridge Builder is playable; Rocket and Farm are shown
// as "in construction" until their games exist.
import Phaser from 'phaser';
import { APPS } from '../data/leveldata.js';
import { bus } from '../ui-html/bus.js';
import { T, FONT_DISPLAY, FONT_BODY, shade, drawHub, makeBrick, makeChip, popIn } from './ui/menuTheme.js';

const ICON = { bridge: '🌉', rocket: '🚀', farm: '🌱' };
const ROUTE = { bridge: 'ModuleSelectScene' };

// Per-app world slice: a 2-stop face gradient + a few accent shapes.
const THEME = {
  bridge: { grad: [0x9ad2f7, 0x2f7fc4], accents: cloudsAccent },
  rocket: { grad: [0x2c2f74, 0x070a1f], accents: starsAccent },
  farm:   { grad: [0x9fe0ff, 0x42ab51], accents: sunAccent },
};

function cloudsAccent(g, w, h) {
  g.fillStyle(0xffffff, 0.85);
  g.fillCircle(-w / 2 + 60, -h / 2 + 46, 13);
  g.fillCircle(-w / 2 + 80, -h / 2 + 50, 16);
  g.fillCircle(-w / 2 + 102, -h / 2 + 46, 11);
}
function starsAccent(g, w, h) {
  g.fillStyle(0xffffff, 0.9);
  const pts = [[-70, -70], [50, -86], [88, -40], [-30, -100], [20, -54], [-96, -34]];
  for (const [px, py] of pts) g.fillCircle(px, py, 2 + (px % 2 ? 1 : 0));
}
function sunAccent(g, w, h) {
  g.fillStyle(0xffe27a, 1);
  g.fillCircle(w / 2 - 56, -h / 2 + 52, 22);
  g.fillStyle(0xffe27a, 0.35);
  g.fillCircle(w / 2 - 56, -h / 2 + 52, 32);
}

export class AppSelectScene extends Phaser.Scene {
  constructor() {
    super('AppSelectScene');
  }

  create() {
    bus.emit('ui:screen', 'menu');
    drawHub(this);

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
      const th = THEME[app.id];
      const b = makeBrick(this, {
        x, y, w: W, h: H, gradient: th.grad, accents: th.accents,
        bevelColor: shade(th.grad[1], 0.62), locked,
        onClick: locked ? null : () => this.scene.start(ROUTE[app.id]),
      });
      const cy = b.faceCenterY;

      const icon = this.add.text(0, cy - 62, ICON[app.id], { fontSize: '70px' })
        .setOrigin(0.5).setAlpha(locked ? 0.55 : 1);
      const name = this.add.text(0, cy + 28, app.title.toUpperCase(), {
        fontFamily: FONT_DISPLAY, fontStyle: '700', fontSize: '26px', color: '#ffffff',
        align: 'center', lineSpacing: 2,
      }).setOrigin(0.5).setShadow(0, 2, '#0b1a30', 5, false, true);
      b.face.add([icon, name]);

      const badge = makeChip(this, {
        x: 0, y: cy + 94,
        text: locked ? '🚧 In construction' : '▶ Play',
        fill: locked ? 0x1f2a44 : 0x12233e,
        textColor: locked ? '#ffd27a' : '#ffe9c4',
        fontSize: 15,
      });
      b.face.add(badge);
      return b.container;
    });

    popIn(this, bricks);

    this.add.text(640, 690, 'More worlds are under construction — keep building!', {
      fontFamily: FONT_BODY, fontStyle: '600', fontSize: '15px', color: T.textMute,
    }).setOrigin(0.5);
  }
}
