import Phaser from 'phaser';

const config = {
  type: Phaser.AUTO,
  parent: 'game',
  width: 1280,
  height: 720,
  backgroundColor: '#87ceeb', // placeholder sky
  scene: [], // populated in Task 1
};

new Phaser.Game(config);
