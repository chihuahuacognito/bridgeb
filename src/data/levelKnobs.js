// src/data/levelKnobs.js
// Pure CSV-knobs layer (NO Phaser). The build-time scripts parse gdd/*.csv into a
// per-level "knobs" map; mergeLevelKnobs applies those knobs over a code-defined level
// (geometry + defaults stay in leveldata.js). Material builders are injected so this
// module has no dependency on leveldata.js (avoids a circular import).

export const KNOWN_VEHICLE_TYPES = ['car', 'truck', 'tank'];
export const KNOWN_SIZES = ['S', 'M', 'L', 'XL'];

// Column order for gdd/levels.csv — parse and serialize MUST agree on this.
export const LEVEL_HEADER = [
  'id', 'vehicles', 'spawn_at', 'convoy_gap_ms', 'budget_road', 'budget_wood',
  'road_sizes', 'wood_sizes', 'tools', 'span', 'gravity_y', 'gravity_label',
  'vehicle_select', 'delete', 'budget_meter', 'stress_glow',
];
export const DESIGN_HEADER = ['level_id', 'type', 'weight', 'speed', 'acceleration'];

// ── cell helpers ────────────────────────────────────────────────────────────
const num  = (s) => (s === '' || s == null ? undefined : Number(s));
const bool = (s) => (s === '' || s == null ? undefined : s === 'true');
const list = (s) => (s === '' || s == null ? undefined : s.split(';'));
const str  = (v) => (v === undefined ? '' : String(v));

// ── merge ───────────────────────────────────────────────────────────────────
// Apply knobs over a code level. Only fields present in `knobs` are overridden;
// everything else (terrain, rocks, anchors, tutorial, …) passes through from base.
export function mergeLevelKnobs(base, knobs, { roadMat, woodMat }) {
  if (!knobs) return base;
  const out = { ...base };
  if (knobs.budget) out.budget = { ...knobs.budget };
  if (knobs.span != null) out.span = knobs.span;
  if (knobs.convoyGapMs != null) out.convoyGapMs = knobs.convoyGapMs;
  if (knobs.gravity) out.gravity = { ...knobs.gravity };
  if (knobs.stressGlow != null) out.stressGlow = knobs.stressGlow;

  if (knobs.roadSizes || knobs.woodSizes) {
    out.materials = { ...base.materials };
    if (knobs.roadSizes) out.materials.road = roadMat(knobs.roadSizes);
    if (knobs.woodSizes) out.materials.wood = woodMat(knobs.woodSizes);
  }

  if (knobs.ui) out.ui = { ...(base.ui ?? {}), ...knobs.ui };

  if (knobs.vehicles) {
    const designs = knobs.designs ?? {};
    out.vehicles = knobs.vehicles.map(type => {
      const e = { type, spawnAt: knobs.spawnAt ?? 'left' };
      if (designs[type]) e.design = { ...designs[type] };
      return e;
    });
  }
  return out;
}

// ── parse ─────────────────────────────────────────────────────────────────--
export function parseLevelsCsv(text) {
  const lines = text.trim().split(/\r?\n/);
  const header = lines[0].split(',');
  const at = (cells, name) => cells[header.indexOf(name)] ?? '';
  const out = {};
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const cells = lines[i].split(',');
    const id = at(cells, 'id');
    if (!id) continue;
    const k = {};
    const vehicles = list(at(cells, 'vehicles')); if (vehicles) k.vehicles = vehicles;
    const spawnAt = at(cells, 'spawn_at');         if (spawnAt) k.spawnAt = spawnAt;
    const gap = num(at(cells, 'convoy_gap_ms'));   if (gap != null) k.convoyGapMs = gap;

    const br = num(at(cells, 'budget_road'));
    const bw = num(at(cells, 'budget_wood'));
    if (br != null || bw != null) {
      k.budget = {};
      if (br != null) k.budget.road = br;
      if (bw != null) k.budget.wood = bw;
    }

    const rs = list(at(cells, 'road_sizes')); if (rs) k.roadSizes = rs;
    const ws = list(at(cells, 'wood_sizes')); if (ws) k.woodSizes = ws;
    const span = num(at(cells, 'span'));      if (span != null) k.span = span;

    const gy = num(at(cells, 'gravity_y'));
    const gl = at(cells, 'gravity_label');
    if (gy != null || gl) {
      k.gravity = {};
      if (gy != null) k.gravity.y = gy;
      if (gl) k.gravity.label = gl;
    }

    const sg = bool(at(cells, 'stress_glow')); if (sg != null) k.stressGlow = sg;

    const ui = {};
    const vs = bool(at(cells, 'vehicle_select')); if (vs != null) ui.vehicleSelect = vs;
    const del = bool(at(cells, 'delete'));        if (del != null) ui.delete = del;
    const bm = bool(at(cells, 'budget_meter'));   if (bm != null) ui.budgetMeter = bm;
    const tools = list(at(cells, 'tools'));        if (tools) ui.tools = tools;
    if (Object.keys(ui).length) k.ui = ui;

    out[id] = k;
  }
  return out;
}

export function parseDesignsCsv(text) {
  const lines = text.trim().split(/\r?\n/);
  const out = {};
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const [levelId, type, weight, speed, acceleration] = lines[i].split(',');
    const d = {};
    if (weight !== '' && weight != null) d.weight = Number(weight);
    if (speed !== '' && speed != null) d.speed = Number(speed);
    if (acceleration !== '' && acceleration != null) d.acceleration = Number(acceleration);
    (out[levelId] ??= {})[type] = d;
  }
  return out;
}

// ── serialize (export/seed) ─────────────────────────────────────────────────
export function serializeLevelsCsv(rawLevels, ids) {
  const rows = [LEVEL_HEADER.join(',')];
  for (const id of ids) {
    const lv = rawLevels[id];
    const ui = lv.ui ?? {};
    rows.push([
      id,
      lv.vehicles.map(v => v.type).join(';'),
      lv.vehicles[0]?.spawnAt ?? 'left',
      str(lv.convoyGapMs),
      str(lv.budget?.road),
      str(lv.budget?.wood),
      lv.materials?.road ? Object.keys(lv.materials.road.blocks).join(';') : '',
      lv.materials?.wood ? Object.keys(lv.materials.wood.blocks).join(';') : '',
      ui.tools ? ui.tools.join(';') : '',
      str(lv.span),
      str(lv.gravity?.y),
      lv.gravity?.label ?? '',
      str(ui.vehicleSelect),
      str(ui.delete),
      str(ui.budgetMeter),
      str(lv.stressGlow),
    ].join(','));
  }
  return rows.join('\n') + '\n';
}

export function serializeDesignsCsv(rawLevels, ids) {
  const rows = [DESIGN_HEADER.join(',')];
  for (const id of ids) {
    const lv = rawLevels[id];
    const byType = {};
    for (const v of lv.vehicles) if (v.design) byType[v.type] = v.design;
    for (const [type, d] of Object.entries(byType)) {
      rows.push([id, type, str(d.weight), str(d.speed), str(d.acceleration)].join(','));
    }
  }
  return rows.join('\n') + '\n';
}
