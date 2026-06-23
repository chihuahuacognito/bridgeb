// tests/tankFallThrough.test.js
// Regression: a heavy vehicle must not tunnel through a sagging road deck at the
// mid-joint. Drives the REAL physics.js against a headless matter-js world.
import { describe, it, expect, beforeEach } from 'vitest';
import physics from '../src/systems/physics.js';
import { createMatterScene } from './matterScene.js';

const ROAD = { type: 'road', stiffness: 0.08, snapThreshold: 0.025 };

// Build a 2-segment road deck: anchorL — midJoint(M) — anchorR, spawn a vehicle
// of the given density resting at the mid-joint, then load it for `steps` ticks
// (mirroring LevelScene.update's per-tick physics calls, minus snap evaluation
// so we isolate tunneling). Returns the final chassis + mid-joint positions.
function runDeckLoad({ density, steps = 320 }) {
  const { scene, step } = createMatterScene({ gravityY: 1.5 });
  physics.attach(scene);

  const L = physics.ensureJointNode('L', 400, 400, true);
  const M = physics.ensureJointNode('M', 580, 400, false);
  const R = physics.ensureJointNode('R', 760, 400, true);
  physics.buildBeam(L, M, ROAD);
  physics.buildBeam(M, R, ROAD);

  physics.spawnVehicle({ density, driveSpeed: 0, spawnX: 580, spawnY: 372 });
  const chassis = physics._vehicle.chassis;

  let maxChassisY = -Infinity;
  for (let i = 0; i < steps; i++) {
    physics.applyBeamWeight();
    physics.applyVehicleLoad();
    step(1);
    maxChassisY = Math.max(maxChassisY, chassis.position.y);
  }
  return { chassisY: chassis.position.y, midY: M.position.y, maxChassisY };
}

describe('vehicle does not tunnel through the road deck at the mid-joint', () => {
  beforeEach(() => physics.detach());

  it('heavy tank stays on top of the deck (rides above the mid-joint)', () => {
    const { chassisY, midY } = runDeckLoad({ density: 0.020 }); // tank
    // Riding the deck → chassis sits ABOVE the sagging mid-joint. Tunnelled →
    // chassis ends up well BELOW it.
    expect(chassisY).toBeLessThan(midY);
  });

  it('light car stays on top of the deck (control)', () => {
    const { chassisY, midY } = runDeckLoad({ density: 0.003 }); // car
    expect(chassisY).toBeLessThan(midY);
  });
});
