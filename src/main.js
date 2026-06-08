import './ui-html/styles/index.css';
import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene.js';
import { LevelScene } from './scenes/LevelScene.js';

const config = {
  type: Phaser.AUTO,
  parent: 'game',
  width: 1280,
  height: 720,
  backgroundColor: '#87ceeb',
  physics: {
    default: 'matter',
    matter: {
      gravity: { y: 1.5 },            // spec §3.4
      enableSleeping: false,           // spec §3.4
      positionIterations: 8,           // spec §3.4 (defensive headroom)
      velocityIterations: 6,
      constraintIterations: 4,
      debug: false,                   // flip to true for collision debug
    },
  },
  scene: [BootScene, LevelScene],
};

new Phaser.Game(config);
