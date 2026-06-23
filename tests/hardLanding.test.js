// tests/hardLanding.test.js
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
// Import the SAME functions the runtime uses — never duplicate the formula.
import physics, {
  isGroundLabel, classifyLandingPair, landingPower,
  LANDING_VY_THRESHOLD, REF_LANDING_VY, LANDING_COOLDOWN_MS,
} from '../src/systems/physics.js';

describe('isGroundLabel', () => {
  it('matches the four landable surfaces', () => {
    for (const l of ['terrain', 'rock', 'beam', 'beam-cap']) expect(isGroundLabel(l)).toBe(true);
  });
  it('rejects non-ground labels', () => {
    for (const l of ['vehicle-wheel', 'vehicle-chassis', 'joint', 'anchor', '']) expect(isGroundLabel(l)).toBe(false);
  });
});

describe('classifyLandingPair', () => {
  it('returns which body is the wheel when paired with ground', () => {
    expect(classifyLandingPair('vehicle-wheel', 'terrain')).toBe('A');
    expect(classifyLandingPair('beam', 'vehicle-wheel')).toBe('B');
  });
  it('returns null for non wheel-ground pairs (e.g. chassis, wheel-wheel)', () => {
    expect(classifyLandingPair('vehicle-chassis', 'terrain')).toBe(null);
    expect(classifyLandingPair('vehicle-wheel', 'vehicle-wheel')).toBe(null);
    expect(classifyLandingPair('vehicle-wheel', 'joint')).toBe(null);
  });
});

describe('landingPower', () => {
  it('normalizes downward vy against the reference and clamps to 0..1', () => {
    expect(landingPower(0, REF_LANDING_VY)).toBe(0);
    expect(landingPower(REF_LANDING_VY, REF_LANDING_VY)).toBe(1);
    expect(landingPower(REF_LANDING_VY * 2, REF_LANDING_VY)).toBe(1);
    expect(landingPower(REF_LANDING_VY / 2, REF_LANDING_VY)).toBeCloseTo(0.5);
  });
  it('returns 0 for non-positive vy (upward / resting)', () => {
    expect(landingPower(-5, REF_LANDING_VY)).toBe(0);
  });
});

// ---- Collision handler integration (mock scene captures the registered cb) ----
function mkPhysScene() {
  const handlers = {};
  return {
    _handlers: handlers,
    time: { now: 1000 },
    matter: {
      world: {
        on: (evt, cb) => { handlers[evt] = cb; },
        off: (evt) => { delete handlers[evt]; },
        remove: () => {},
      },
    },
  };
}
function pair(labelA, vyA, labelB, vyB, { idA = 1, idB = 2, x = 100, y = 200 } = {}) {
  return {
    bodyA: { label: labelA, velocity: { y: vyA }, position: { x, y }, id: idA },
    bodyB: { label: labelB, velocity: { y: vyB }, position: { x, y }, id: idB },
  };
}

describe('physics hard-landing collision handler', () => {
  beforeEach(() => physics.detach());

  it('fires onHardLanding for a wheel hitting ground above the vy threshold', () => {
    const scene = mkPhysScene();
    const cb = vi.fn();
    physics.attach(scene);
    physics.setOnHardLanding(cb);
    const vy = LANDING_VY_THRESHOLD + 4;
    scene._handlers['collisionstart']({ pairs: [pair('vehicle-wheel', vy, 'terrain', 0, { x: 320, y: 540 })] });
    expect(cb).toHaveBeenCalledTimes(1);
    expect(cb).toHaveBeenCalledWith(expect.objectContaining({
      x: 320, y: 540, power: landingPower(vy, REF_LANDING_VY),
    }));
  });

  it('ignores landings below the vy threshold', () => {
    const scene = mkPhysScene();
    const cb = vi.fn();
    physics.attach(scene);
    physics.setOnHardLanding(cb);
    scene._handlers['collisionstart']({ pairs: [pair('vehicle-wheel', LANDING_VY_THRESHOLD - 1, 'terrain', 0)] });
    expect(cb).not.toHaveBeenCalled();
  });

  it('ignores chassis-on-ground (label match, not collision category)', () => {
    const scene = mkPhysScene();
    const cb = vi.fn();
    physics.attach(scene);
    physics.setOnHardLanding(cb);
    scene._handlers['collisionstart']({ pairs: [pair('vehicle-chassis', 20, 'terrain', 0)] });
    expect(cb).not.toHaveBeenCalled();
  });

  it('debounces repeat landings of the same wheel within the cooldown', () => {
    const scene = mkPhysScene();
    const cb = vi.fn();
    physics.attach(scene);
    physics.setOnHardLanding(cb);
    const vy = LANDING_VY_THRESHOLD + 4;
    const p = () => pair('vehicle-wheel', vy, 'terrain', 0, { idA: 7 });
    scene._handlers['collisionstart']({ pairs: [p()] });
    scene.time.now += LANDING_COOLDOWN_MS - 1;               // still within cooldown
    scene._handlers['collisionstart']({ pairs: [p()] });
    expect(cb).toHaveBeenCalledTimes(1);
    scene.time.now += 2;                                     // now past cooldown
    scene._handlers['collisionstart']({ pairs: [p()] });
    expect(cb).toHaveBeenCalledTimes(2);
  });

  it('reset() clears the per-wheel debounce map', () => {
    const scene = mkPhysScene();
    const cb = vi.fn();
    physics.attach(scene);
    physics.setOnHardLanding(cb);
    const vy = LANDING_VY_THRESHOLD + 4;
    const p = () => pair('vehicle-wheel', vy, 'terrain', 0, { idA: 9 });
    scene._handlers['collisionstart']({ pairs: [p()] });
    physics.reset();                                         // wheels recreated each spawn → map cleared
    scene._handlers['collisionstart']({ pairs: [p()] });    // same time, but map was cleared
    expect(cb).toHaveBeenCalledTimes(2);
  });
});
