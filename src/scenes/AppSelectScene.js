// src/scenes/AppSelectScene.js
// Top-level app picker (root scene). Bridge Builder is unlocked; the other apps
// render as visual-only locked tiles until their apps exist.
import Phaser from 'phaser';
import { APPS } from '../data/leveldata.js';
import { bus } from '../ui-html/bus.js';

const APP_ROUTE = { bridge: 'ModuleSelectScene' };

export class AppSelectScene extends Phaser.Scene {
  constructor() {
    super('AppSelectScene');
  }

  create() {
    bus.emit('ui:screen', 'menu'); // keep the in-game HTML HUD hidden
    this.cameras.main.setBackgroundColor('#1a1a2e');

    this.add.text(640, 90, 'STEM LAB', {
      fontSize: '52px', color: '#ffffff', fontStyle: 'bold',
    }).setOrigin(0.5);
    this.add.text(640, 145, 'Choose an app', {
      fontSize: '18px', color: '#aaaaaa',
    }).setOrigin(0.5);

    const TW = 320, TH = 220, GX = 40;
    const x0 = 640 - (APPS.length - 1) * (TW + GX) / 2;
    const y = 380;

    APPS.forEach((app, i) => {
      const x = x0 + i * (TW + GX);
      const fill = app.locked ? 0x33384d : 0x2e7d32;
      const tile = this.add.rectangle(x, y, TW, TH, fill)
        .setStrokeStyle(2, 0xffffff, app.locked ? 0.12 : 0.3);
      this.add.text(x, y - 10, app.title, {
        fontSize: '26px', color: app.locked ? '#7c8196' : '#ffffff', fontStyle: 'bold',
        align: 'center', wordWrap: { width: TW - 40 },
      }).setOrigin(0.5);

      if (app.locked) {
        tile.setAlpha(0.85);
        this.add.text(x, y + 48, '🔒 Coming soon', {
          fontSize: '16px', color: '#9aa0b5',
        }).setOrigin(0.5);
      } else {
        tile.setInteractive({ useHandCursor: true });
        this.add.text(x, y + 48, 'PLAY', {
          fontSize: '15px', color: '#d6f5d6', fontStyle: 'bold',
        }).setOrigin(0.5).setAlpha(0.8);
        const route = APP_ROUTE[app.id];
        tile.on('pointerdown', () => route && this.scene.start(route));
        tile.on('pointerover', () => tile.setAlpha(0.85));
        tile.on('pointerout', () => tile.setAlpha(1));
      }
    });
  }
}
