import { bus } from '../bus.js';

export function VehicleCard({ key, label, color }) {
  const row = document.createElement('div');
  row.className = 'vehicle-row';
  row.setAttribute('role', 'button');
  row.setAttribute('aria-label', label);
  row.dataset.key = key;

  const icon = document.createElement('div');
  icon.className = 'icon';
  icon.style.width = '36px';
  icon.style.height = '24px';
  icon.style.background = color;
  icon.style.borderRadius = '6px';

  const lbl = document.createElement('span');
  lbl.className = 'label';
  lbl.textContent = label.toUpperCase();

  row.append(icon, lbl);

  row.addEventListener('click', () => bus.emit('vehicle:select', key));
  bus.on('vehicle:active', (activeKey) => {
    if (activeKey === key) row.dataset.selected = 'true';
    else delete row.dataset.selected;
  });

  return row;
}
