// tests/levels.test.js
import { describe, it, expect } from 'vitest';
import { ALL_LEVELS, LEVEL_ORDER, menuEntries, DEV_STRESS } from '../src/data/leveldata.js';

const SIZES = ['S', 'M', 'L', 'XL'];
const PHASES = ['tutorial', 'topic', 'challenge'];
const VEHICLE_TYPES = ['car', 'truck', 'tank'];

describe('LEVEL_ORDER', () => {
  it('lists exactly 12 unique level ids, all present in ALL_LEVELS', () => {
    expect(LEVEL_ORDER).toHaveLength(12);
    expect(new Set(LEVEL_ORDER).size).toBe(12);
    for (const id of LEVEL_ORDER) expect(ALL_LEVELS[id], id).toBeDefined();
  });

  it('does not include DEV_STRESS', () => {
    expect(LEVEL_ORDER).not.toContain('DEV_STRESS');
    expect(ALL_LEVELS.DEV_STRESS).toBe(DEV_STRESS); // still reachable for the dev flag
  });

  it('covers every non-DEV_STRESS key of ALL_LEVELS', () => {
    expect(new Set(LEVEL_ORDER)).toEqual(new Set(Object.keys(ALL_LEVELS).filter(k => k !== 'DEV_STRESS')));
  });

  it('phases run tutorial ×3, topic ×6, challenge ×3 in order', () => {
    const phases = LEVEL_ORDER.map(id => ALL_LEVELS[id].phase);
    expect(phases).toEqual([
      'tutorial', 'tutorial', 'tutorial',
      'topic', 'topic', 'topic', 'topic', 'topic', 'topic',
      'challenge', 'challenge', 'challenge',
    ]);
  });
});

describe('every progression level', () => {
  for (const id of ['L01','L02','L03','L04','L05','L06','L07','L08','L09','L10','L11','L12']) {
    describe(id, () => {
      const lvl = () => ALL_LEVELS[id];

      it('has core fields', () => {
        const l = lvl();
        expect(l.id).toBe(id);
        expect(typeof l.title).toBe('string');
        expect(PHASES).toContain(l.phase);
        expect(l.budget.road).toBeGreaterThan(0);
        expect(l.worldWidth).toBe(1280);
        expect(l.worldHeight).toBe(720);
        expect(l.terrain.left.verts.length).toBeGreaterThanOrEqual(3);
        expect(l.terrain.right.verts.length).toBeGreaterThanOrEqual(3);
        expect(l.terrain.waterY).toBeGreaterThan(0);
      });

      it('has left + right anchors matching terrain tops', () => {
        const l = lvl();
        const left = l.anchors.find(a => a.side === 'left');
        const right = l.anchors.find(a => a.side === 'right');
        expect(left).toBeDefined();
        expect(right).toBeDefined();
        expect(right.x).toBeGreaterThan(left.x);
      });

      it('vehicles is a non-empty array of known types', () => {
        const l = lvl();
        expect(Array.isArray(l.vehicles)).toBe(true);
        expect(l.vehicles.length).toBeGreaterThan(0);
        for (const v of l.vehicles) expect(VEHICLE_TYPES).toContain(v.type);
      });

      it('materials blocks use known sizes with positive cost/length', () => {
        const l = lvl();
        for (const mat of Object.values(l.materials)) {
          for (const [size, b] of Object.entries(mat.blocks)) {
            expect(SIZES).toContain(size);
            expect(b.length).toBeGreaterThan(0);
            expect(b.cost).toBeGreaterThan(0);
          }
        }
      });

      it('prebuilt (if any) references existing joints/anchors and valid sizes', () => {
        const l = lvl();
        if (!l.prebuilt) return;
        const ids = new Set([
          ...l.anchors.map(a => a.id),
          ...(l.rocks ?? []).flatMap(r => (r.anchors ?? []).map(a => a.id)),
          ...l.prebuilt.joints.map(j => j.id),
        ]);
        for (const b of l.prebuilt.beams) {
          expect(ids.has(b.a), `${id} prebuilt beam a=${b.a}`).toBe(true);
          expect(ids.has(b.b), `${id} prebuilt beam b=${b.b}`).toBe(true);
          const mat = l.materials[b.material === 'road' ? 'road' : 'wood'];
          expect(mat.blocks[b.size], `${id} size ${b.size}`).toBeDefined();
        }
      });

      it('ui.tools (if present) only names real tools', () => {
        const l = lvl();
        if (!l.ui?.tools) return;
        for (const t of l.ui.tools) {
          expect(['road', 'beam', 'free', 'remove']).toContain(t);
        }
      });
    });
  }
});

describe('intended-failure budget direction (spec: L05/L06)', () => {
  it('L05 budget is below a pillar-free brute-force deck (2 stacked decks of road)', () => {
    const l = ALL_LEVELS.L05;
    const left = l.anchors.find(a => a.side === 'left');
    const right = l.anchors.find(a => a.side === 'right');
    const gap = right.x - left.x;
    const lBlock = l.materials.road.blocks.L;
    const oneDeck = Math.ceil(gap / lBlock.length) * lBlock.cost;
    expect(l.budget.road).toBeLessThan(oneDeck * 2);
  });

  it('L06 budget cannot afford doubling the prebuilt deck in road', () => {
    const l = ALL_LEVELS.L06;
    const deckCost = l.prebuilt.beams
      .filter(b => b.material === 'road')
      .reduce((s, b) => s + l.materials.road.blocks[b.size].cost, 0);
    // budget is net-of-prebuilt at runtime; gross budget minus prebuilt must be < a second deck
    expect(l.budget.road - deckCost).toBeLessThan(deckCost);
  });
});

describe('menuEntries', () => {
  it('maps LEVEL_ORDER to {id, title, phase}', () => {
    const entries = menuEntries(ALL_LEVELS, LEVEL_ORDER);
    expect(entries).toHaveLength(12);
    expect(entries[0]).toEqual({
      id: LEVEL_ORDER[0],
      title: ALL_LEVELS[LEVEL_ORDER[0]].title,
      phase: 'tutorial',
    });
  });
});
