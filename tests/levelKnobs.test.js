// tests/levelKnobs.test.js
import { describe, it, expect } from 'vitest';
import {
  mergeLevelKnobs, parseLevelsCsv, parseDesignsCsv,
  KNOWN_VEHICLE_TYPES, KNOWN_SIZES,
} from '../src/data/levelKnobs.js';

// Minimal fake material builders (stand in for roadMat/woodMat).
const roadMat = (sizes) => ({ type: 'road', sizes: [...sizes] });
const woodMat = (sizes) => ({ type: 'beam', sizes: [...sizes] });
const deps = { roadMat, woodMat };

const base = () => ({
  id: 'L', title: 'T', span: 4, terrain: { x: 1 },   // terrain passes through untouched
  budget: { road: 8 },
  vehicles: [{ type: 'car', spawnAt: 'left' }],
  materials: { road: roadMat(['S', 'M']), wood: woodMat(['S', 'M']) },
  ui: { vehicleSelect: false },
  gravity: { y: 1.5, label: 'Normal' },
});

describe('mergeLevelKnobs', () => {
  it('returns the base unchanged when there are no knobs', () => {
    const b = base();
    expect(mergeLevelKnobs(b, null, deps)).toBe(b);
  });

  it('overrides only the knobs present; leaves geometry/title alone', () => {
    const out = mergeLevelKnobs(base(), { budget: { road: 20, wood: 12 } }, deps);
    expect(out.budget).toEqual({ road: 20, wood: 12 });
    expect(out.terrain).toEqual({ x: 1 });   // untouched
    expect(out.title).toBe('T');
  });

  it('expands a vehicle type-list into the convoy array with per-type designs', () => {
    const out = mergeLevelKnobs(base(), {
      vehicles: ['car', 'car', 'truck'], spawnAt: 'left', convoyGapMs: 1400,
      designs: { truck: { weight: 6, speed: 4, acceleration: 5 } },
    }, deps);
    expect(out.convoyGapMs).toBe(1400);
    expect(out.vehicles).toEqual([
      { type: 'car', spawnAt: 'left' },
      { type: 'car', spawnAt: 'left' },
      { type: 'truck', spawnAt: 'left', design: { weight: 6, speed: 4, acceleration: 5 } },
    ]);
  });

  it('rebuilds materials from size lists', () => {
    const out = mergeLevelKnobs(base(), { roadSizes: ['M', 'L'], woodSizes: ['S'] }, deps);
    expect(out.materials.road).toEqual({ type: 'road', sizes: ['M', 'L'] });
    expect(out.materials.wood).toEqual({ type: 'beam', sizes: ['S'] });
  });

  it('merges ui flags onto the base ui', () => {
    const out = mergeLevelKnobs(base(), { ui: { delete: false, tools: ['road', 'beam'] } }, deps);
    expect(out.ui).toEqual({ vehicleSelect: false, delete: false, tools: ['road', 'beam'] });
  });
});

describe('parseLevelsCsv', () => {
  it('parses rows, splitting ; lists and omitting blank cells', () => {
    const csv = [
      'id,vehicles,spawn_at,convoy_gap_ms,budget_road,budget_wood,road_sizes,wood_sizes,tools,span,gravity_y,gravity_label,vehicle_select,delete,budget_meter,stress_glow',
      'L10,car;car;truck,left,1400,48,32,S;M;L;XL,S;M;L;XL,road;beam,7.6,1.5,Normal,false,,,',
      'L01,car,left,,8,,L,,road,1.6,1.5,Normal,false,false,false,false',
    ].join('\n');
    const out = parseLevelsCsv(csv);
    expect(out.L10.vehicles).toEqual(['car', 'car', 'truck']);
    expect(out.L10.convoyGapMs).toBe(1400);
    expect(out.L10.budget).toEqual({ road: 48, wood: 32 });
    expect(out.L10.roadSizes).toEqual(['S', 'M', 'L', 'XL']);
    expect(out.L10.ui).toEqual({ vehicleSelect: false, tools: ['road', 'beam'] }); // blanks omitted
    expect(out.L01.budget).toEqual({ road: 8 });            // wood blank → omitted
    expect(out.L01.ui).toEqual({ vehicleSelect: false, delete: false, budgetMeter: false, tools: ['road'] });
    expect(out.L01.stressGlow).toBe(false);
  });
});

describe('parseDesignsCsv', () => {
  it('maps (level,type) to a design, omitting blank fields', () => {
    const csv = [
      'level_id,type,weight,speed,acceleration',
      'L05,truck,6,4,5',
      'L99,car,6,,',
    ].join('\n');
    const out = parseDesignsCsv(csv);
    expect(out.L05.truck).toEqual({ weight: 6, speed: 4, acceleration: 5 });
    expect(out.L99.car).toEqual({ weight: 6 });
  });
});

describe('constants', () => {
  it('exposes the known types and sizes', () => {
    expect(KNOWN_VEHICLE_TYPES).toEqual(['car', 'truck', 'tank']);
    expect(KNOWN_SIZES).toEqual(['S', 'M', 'L', 'XL']);
  });
});
