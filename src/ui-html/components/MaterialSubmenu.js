import { bus } from '../bus.js';
import { tilePrice } from '../../data/materials.js';

// One-line personality copy per material id (shown as a hover tooltip).
const TIPS = {
  dirt: 'Cheapest. Saggy and weak — short light spans only.',
  asphalt: 'The balanced default deck.',
  concrete: 'Stiff, strong, heavy and pricey. Holds trucks across long gaps.',
  rope: 'Cheapest brace. Floppy and weak — pulls only.',
  wood: 'The classic all-rounder brace.',
  steel: 'Stiff, strong workhorse. Holds heavy loads without bending.',
};

// Draw a material swatch the way it reads in-world: 3-tone body + surface motif,
// chunky/high-contrast (toy style), not photoreal. Mirrors the approved mockup.
function drawSwatch(ctx, w, h, m) {
  const v = m.visual;
  const hex = (n) => '#' + n.toString(16).padStart(6, '0');
  const th = m.type === 'road' ? h * 0.62 : (m.thickness ? h * 0.34 : h * 0.5);
  const y = (h - th) / 2;
  const edge = Math.max(2, th * 0.16);
  ctx.fillStyle = hex(v.base); ctx.fillRect(0, y, w, th);
  ctx.fillStyle = hex(v.edgeTop); ctx.fillRect(0, y, w, edge);
  ctx.fillStyle = hex(v.edgeBottom); ctx.fillRect(0, y + th - edge, w, edge);
  const rnd = (s) => { const x = Math.sin(s * 99.13) * 43758.5; return x - Math.floor(x); };
  if (v.motif === 'speckle') {
    ctx.fillStyle = 'rgba(0,0,0,.22)';
    for (let i = 0; i < w * th / 22; i++) ctx.fillRect(rnd(i + 1) * w, y + 2 + rnd(i * 2) * (th - 4), 1.6, 1.6);
    ctx.fillStyle = 'rgba(255,255,255,.12)';
    for (let i = 0; i < w * th / 55; i++) ctx.fillRect(rnd(i + 40) * w, y + 2 + rnd(i * 3) * (th - 4), 1.6, 1.6);
  } else if (v.motif === 'grain') {
    ctx.strokeStyle = 'rgba(0,0,0,.22)'; ctx.lineWidth = 1;
    for (let i = 1; i < 4; i++) { const gy = y + th * i / 4; ctx.beginPath(); for (let x = 0; x <= w; x += 6) ctx.lineTo(x, gy + Math.sin((x + i * 13) / 9)); ctx.stroke(); }
  } else if (v.motif === 'sheen') {
    const g = ctx.createLinearGradient(0, y, 0, y + th);
    g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(.32, 'rgba(255,255,255,.55)'); g.addColorStop(.5, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.fillRect(0, y, w, th);
  } else if (v.motif === 'twist') {
    ctx.strokeStyle = 'rgba(0,0,0,.28)'; ctx.lineWidth = 1.3;
    for (let x = -th; x < w; x += 7) { ctx.beginPath(); ctx.moveTo(x, y + th); ctx.lineTo(x + th, y); ctx.stroke(); }
  } else if (v.motif === 'plate') {
    ctx.strokeStyle = 'rgba(0,0,0,.30)'; ctx.lineWidth = 1.2;
    for (let x = 16; x < w; x += 16) { ctx.beginPath(); ctx.moveTo(x, y + 2); ctx.lineTo(x, y + th - 2); ctx.stroke(); }
  }
  if (v.centerLine) {
    ctx.fillStyle = 'rgba(245,213,74,.9)';
    for (let x = 5; x < w - 5; x += 15) ctx.fillRect(x, y + th / 2 - 1, 8, 2);
  }
}

export function mountMaterialSubmenu(root) {
  const el = document.createElement('div');
  el.className = 'material-submenu';
  el.innerHTML = '<div class="matsub-head"><span class="matsub-cat"></span><span class="matsub-sel"></span></div><div class="matsub-row"></div>';
  root.appendChild(el);
  const catEl = el.querySelector('.matsub-cat');
  const selEl = el.querySelector('.matsub-sel');
  const rowEl = el.querySelector('.matsub-row');

  let currentType = null;

  function anchorToTile(type) {
    const tile = document.querySelector(`#ui-toolbar [data-tool="${type}"]`);
    if (tile) el.style.left = Math.max(12, tile.getBoundingClientRect().left - 8) + 'px';
  }

  function render({ type, list, current }) {
    currentType = type;
    catEl.textContent = `${type === 'road' ? 'Road' : 'Beam'} material`;
    rowEl.innerHTML = '';
    for (const m of list) {
      const tile = document.createElement('button');
      tile.type = 'button';
      tile.className = 'btn btn--white mat-tile';
      tile.dataset.material = m.id;
      if (m.id === current) tile.dataset.active = 'true';

      const cv = document.createElement('canvas');
      cv.width = 88; cv.height = 48; cv.className = 'mat-swatch';
      const ctx = cv.getContext('2d');
      if (ctx) drawSwatch(ctx, 88, 48, m); // jsdom has no 2d context — skip in tests

      const nm = document.createElement('span');
      nm.className = 'mat-name'; nm.textContent = m.name;
      const ct = document.createElement('span');
      ct.className = 'mat-cost'; ct.textContent = `$${tilePrice(m)}`;
      const tip = document.createElement('span');
      tip.className = 'mat-tip'; tip.textContent = TIPS[m.id] ?? '';

      tile.append(cv, nm, ct, tip);
      tile.addEventListener('click', () => bus.emit('material:select', { id: m.id }));
      rowEl.appendChild(tile);
    }
    const cur = list.find(m => m.id === current) ?? list[0];
    if (cur) selEl.innerHTML = `${cur.name} · <b>$${tilePrice(cur)}/block</b>`;
    anchorToTile(type);
    el.classList.remove('open'); void el.offsetWidth; el.classList.add('open');
  }

  bus.on('materials:show', render);
  bus.on('material:active', ({ id }) => {
    for (const t of rowEl.querySelectorAll('.mat-tile')) {
      if (t.dataset.material === id) t.dataset.active = 'true'; else delete t.dataset.active;
    }
    const cur = rowEl.querySelector(`.mat-tile[data-material="${id}"] .mat-name`);
    if (cur) selEl.innerHTML = `${cur.textContent} · <b>$${rowEl.querySelector(`.mat-tile[data-material="${id}"] .mat-cost`).textContent.slice(1)}/block</b>`;
  });
  bus.on('materials:hide', () => el.classList.remove('open'));
  // Reposition if the window resizes while open.
  window.addEventListener('resize', () => { if (currentType) anchorToTile(currentType); });
}
