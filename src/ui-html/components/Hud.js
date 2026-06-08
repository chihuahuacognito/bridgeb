import { bus } from '../bus.js';

const ROWS = [
  { key: 'spd',     label: 'SPD',     color: '#2D9CDB' },
  { key: 'chassis', label: 'CHASSIS', color: '#8E5BD9' },
  { key: 'accel',   label: 'ACCEL',   color: '#5AB942' },
  { key: 'angvel',  label: 'ANGVEL',  color: '#F7941E' },
  { key: 'drive',   label: 'DRIVE',   color: '#EB4D3D' },
  { key: 'slope',   label: 'SLOPE',   color: '#F5B423' },
];

export function mountHud(root) {
  const panel = document.createElement('div');
  panel.className = 'hud-panel';

  const grid = document.createElement('div');
  grid.className = 'grid';

  const valueNodes = {};
  for (const r of ROWS) {
    const row = document.createElement('div');
    row.className = 'hud-row';

    const dot = document.createElement('span');
    dot.className = 'dot';
    dot.style.background = r.color;

    const label = document.createElement('span');
    label.className = 'label';
    label.textContent = r.label;

    const num = document.createElement('span');
    num.className = 'num';
    num.dataset.key = r.key;
    num.textContent = '0';

    row.append(dot, label, num);
    grid.appendChild(row);
    valueNodes[r.key] = num;
  }
  panel.appendChild(grid);
  root.appendChild(panel);

  bus.on('hud:update', (vals) => {
    for (const k of Object.keys(valueNodes)) {
      if (vals[k] !== undefined) valueNodes[k].textContent = String(vals[k]);
    }
  });
}
