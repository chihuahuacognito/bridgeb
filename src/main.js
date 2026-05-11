import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene.js';
import { LevelScene } from './scenes/LevelScene.js';

const config = {
  type: Phaser.AUTO,
  parent: 'game',
  width: 1280,
  height: 720,
  backgroundColor: '#87ceeb',
  scene: [BootScene, LevelScene],
};

new Phaser.Game(config);
