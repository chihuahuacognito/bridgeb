import { PanelCard } from './PanelCard.js';
import { VehicleCard } from './VehicleCard.js';
import { PresetDropdown } from './PresetDropdown.js';

const VEHICLES = [
  { key: 'car',   label: 'CAR',   color: '#5AB942' },
  { key: 'truck', label: 'TRUCK', color: '#F7941E' },
  { key: 'tank',  label: 'TANK',  color: '#7A8C99' },
];

export function mountSidebar(root, { presetOptions, initialPreset }) {
  const panel = PanelCard({ title: 'VEHICLES' });
  for (const v of VEHICLES) panel.body.appendChild(VehicleCard(v));
  root.appendChild(panel);

  root.appendChild(PresetDropdown({
    label: 'LOAD PRESET',
    options: presetOptions,
    initial: initialPreset,
  }));
}
