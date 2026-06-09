import { describe, it, expect, beforeEach } from 'vitest';
import { saveLayout, loadLayout, hasSave } from '../src/systems/saveload.js';

const ANCHORS = [
  { x: 400, y: 480, isAnchor: true, bodyId: 'anchor_left_0' },
  { x: 880, y: 480, isAnchor: true, bodyId: 'anchor_right_0' },
];
const MID = { x: 640, y: 440, isAnchor: false, bodyId: 'joint_123' };
const MAT_ROAD = { type: 'road', stiffness: 0.6, snapThreshold: 0.065 };
const MAT_BEAM = { type: 'beam', stiffness: 0.4, snapThreshold: 0.08 };

beforeEach(() => localStorage.clear());

describe('hasSave', () => {
  it('returns false when nothing saved', () => {
    expect(hasSave('L1')).toBe(false);
  });
  it('returns true after saveLayout', () => {
    saveLayout('L1', [MID], [], 'car');
    expect(hasSave('L1')).toBe(true);
  });
  it('is per-level', () => {
    saveLayout('L1', [], [], 'car');
    expect(hasSave('DEV_STRESS')).toBe(false);
  });
});

describe('saveLayout / loadLayout round-trip', () => {
  it('returns null when nothing saved', () => {
    expect(loadLayout('L1')).toBeNull();
  });

  it('returns null for malformed JSON', () => {
    localStorage.setItem('bridgebuilder:save:L1', 'not-json{{{');
    expect(loadLayout('L1')).toBeNull();
  });

  it('returns null for structurally invalid data', () => {
    localStorage.setItem('bridgebuilder:save:L1', '"just-a-string"');
    expect(loadLayout('L1')).toBeNull();
  });

  it('serializes only non-anchor joints', () => {
    saveLayout('L1', [...ANCHORS, MID], [], 'car');
    const data = loadLayout('L1');
    expect(data.joints).toHaveLength(1);
    expect(data.joints[0]).toEqual({ id: 'joint_123', x: 640, y: 440 });
  });

  it('serializes beams with endpoint bodyIds and material type', () => {
    const beams = [
      { a: ANCHORS[0], b: MID, material: MAT_ROAD, constraint: {} },
      { a: MID, b: ANCHORS[1], material: MAT_BEAM, constraint: {} },
    ];
    saveLayout('L1', [...ANCHORS, MID], beams, 'truck');
    const data = loadLayout('L1');
    expect(data.beams).toEqual([
      { a: 'anchor_left_0', b: 'joint_123', material: 'road' },
      { a: 'joint_123',     b: 'anchor_right_0', material: 'beam' },
    ]);
  });

  it('serializes vehicle and levelId', () => {
    saveLayout('DEV_STRESS', [], [], 'tank');
    const data = loadLayout('DEV_STRESS');
    expect(data.vehicle).toBe('tank');
    expect(data.levelId).toBe('DEV_STRESS');
  });

  it('rounds joint coordinates to integers', () => {
    const fuzzy = { x: 640.7, y: 440.3, isAnchor: false, bodyId: 'j1' };
    saveLayout('L1', [fuzzy], [], 'car');
    const data = loadLayout('L1');
    expect(data.joints[0].x).toBe(641);
    expect(data.joints[0].y).toBe(440);
  });

  it('overwrites previous save for same level', () => {
    saveLayout('L1', [MID], [], 'car');
    saveLayout('L1', [], [], 'truck');
    const data = loadLayout('L1');
    expect(data.joints).toHaveLength(0);
    expect(data.vehicle).toBe('truck');
  });
});
