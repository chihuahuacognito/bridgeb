import './ui-html/styles/index.css';
import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene.js';
import { AppSelectScene } from './scenes/AppSelectScene.js';
import { ModuleSelectScene } from './scenes/ModuleSelectScene.js';
import { LevelSelectScene } from './scenes/LevelSelectScene.js';
import { LevelScene } from './scenes/LevelScene.js';
import { mountUi } from './ui-html/index.js';

mountUi({
  presetOptions: [{ key: 'normal', label: 'NORMAL — G' }],
  initialPreset: 'normal',
  initialVehicle: 'car',
});

const config = {
  type: Phaser.AUTO,
  parent: 'game',
  width: 1280,
  height: 720,
  backgroundColor: '#87ceeb',
  resolution: window.devicePixelRatio || 1,
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  physics: {
    default: 'matter',
    matter: {
      gravity: { y: 1.5 },
      enableSleeping: false,
      positionIterations: 8,
      velocityIterations: 6,
      constraintIterations: 4,
      debug: false,
    },
  },
  scene: [BootScene, AppSelectScene, ModuleSelectScene, LevelSelectScene, LevelScene],
};

new Phaser.Game(config);
