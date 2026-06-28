// tests/convoyPhysics.test.js
// Convoy: physics.js must hold MANY live vehicles at once (was a single _vehicle).
// Drives the REAL physics.js against a headless matter-js world.
import { describe, it, expect, beforeEach } from 'vitest';
import physics from '../src/systems/physics.js';
import { createMatterScene } from './matterScene.js';

describe('physics multi-vehicle (convoy)', () => {
  beforeEach(() => physics.detach());

  it('holds two vehicles at once with distinct ids', () => {
    const { scene } = createMatterScene({ gravityY: 1.5 });
    physics.attach(scene);
    const a = physics.spawnVehicle({ density: 0.003, spawnX: 300, spawnY: 300, spawnAt: 'left' });
    const b = physics.spawnVehicle({ density: 0.008, spawnX: 500, spawnY: 300, spawnAt: 'left' });
    expect(a.id).not.toBe(b.id);
    const live = physics.getVehicles();
    expect(live).toHaveLength(2);
    expect(new Set(live.map(v => v.id)).size).toBe(2);
  });

  it('drives both vehicles forward (both gain rightward velocity)', () => {
    const { scene, step } = createMatterScene({ gravityY: 0 }); // no gravity: isolate drive
    physics.attach(scene);
    physics.spawnVehicle({ density: 0.003, spawnX: 200, spawnY: 300, spawnAt: 'left', driveSpeed: 5 });
    physics.spawnVehicle({ density: 0.003, spawnX: 400, spawnY: 300, spawnAt: 'left', driveSpeed: 5 });
    for (let i = 0; i < 60; i++) { physics.driveVehicle(); step(1); }
    for (const v of physics.getVehicles()) {
      expect(v.position.x).toBeGreaterThan(v.id === 0 ? 200 : 400); // each moved right of its spawn
    }
  });

  it('removeVehicle(id) removes only that vehicle; reset clears all', () => {
    const { scene } = createMatterScene({ gravityY: 1.5 });
    physics.attach(scene);
    const a = physics.spawnVehicle({ density: 0.003, spawnX: 300, spawnY: 300, spawnAt: 'left' });
    physics.spawnVehicle({ density: 0.003, spawnX: 500, spawnY: 300, spawnAt: 'left' });
    physics.removeVehicle(a.id);
    expect(physics.getVehicles().map(v => v.id)).not.toContain(a.id);
    expect(physics.getVehicles()).toHaveLength(1);
    physics.reset();
    expect(physics.getVehicles()).toHaveLength(0);
  });
});
