import { bus } from '../bus.js';
import { ToolTile } from './ToolTile.js';
import { CtaButton } from './CtaButton.js';
import * as I from '../icons/index.js';

const ACTIVE_TOOLS = [
  { tool: 'nodes',     label: 'NODES',     iconSvg: I.nodes(),     accent: 'red',    disabled: true  },
  { tool: 'road',      label: 'ROAD',      iconSvg: I.road(),      accent: 'gray',   disabled: false },
  { tool: 'beam',      label: 'BEAM',      iconSvg: I.beam(),      accent: 'orange', disabled: false },
  { tool: 'cable',     label: 'CABLE',     iconSvg: I.cable(),     accent: undefined, disabled: true },
  { tool: 'hydraulic', label: 'HYDRAULIC', iconSvg: I.hydraulic(), accent: 'gray',   disabled: true },
  { tool: 'spring',    label: 'SPRING',    iconSvg: I.spring(),    accent: 'purple', disabled: true },
  { tool: 'remove',    label: 'REMOVE',    iconSvg: I.remove(),    accent: 'red',    disabled: false },
];

const UTILITY = [
  { tool: 'free',     label: 'FREE',  iconSvg: I.beam(),    accent: undefined, disabled: false },
  { tool: 'grid',     label: 'GRID',  iconSvg: I.grid(),    accent: undefined, disabled: false },
  { tool: 'snap',     label: 'SNAP',  iconSvg: I.snap(),    accent: undefined, disabled: false },
  { tool: 'zoom-out', label: '',      iconSvg: I.zoomOut(), accent: undefined, disabled: false },
  { tool: 'zoom-in',  label: '',      iconSvg: I.zoomIn(),  accent: undefined, disabled: false },
];

export function mountToolbar(root) {
  const tiles = {};

  for (const t of ACTIVE_TOOLS) {
    const tile = ToolTile(t);
    tiles[t.tool] = tile;
    root.appendChild(tile);
  }

  const divider = document.createElement('div');
  divider.className = 'divider';
  root.appendChild(divider);

  for (const t of UTILITY) {
    const tile = ToolTile(t);
    if (t.tool.startsWith('zoom')) tile.classList.add('zoom');
    tiles[t.tool] = tile;
    root.appendChild(tile);
  }

  const play = CtaButton({
    label: 'PLAY', size: 'small',
    onClick: () => bus.emit('mode:toggle'),
  });
  play.classList.add('play-small');
  root.appendChild(play);

  bus.on('tool:select', (key) => {
    for (const [tool, el] of Object.entries(tiles)) {
      if (tool === key) el.dataset.active = 'true';
      else delete el.dataset.active;
    }
  });

  bus.on('ui:config', (cfg) => {
    const allowed = cfg?.tools;
    for (const t of ACTIVE_TOOLS) {
      tiles[t.tool].style.display =
        allowed && !allowed.includes(t.tool) ? 'none' : '';
    }
  });
}
