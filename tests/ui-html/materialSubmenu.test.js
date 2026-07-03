import { describe, it, expect, beforeEach } from 'vitest';
import { bus } from '../../src/ui-html/bus.js';
import { mountMaterialSubmenu } from '../../src/ui-html/components/MaterialSubmenu.js';
import { ROAD_MATERIALS, BEAM_MATERIALS, MATERIALS, tilePrice } from '../../src/data/materials.js';

describe('MaterialSubmenu', () => {
  let root;
  beforeEach(() => {
    bus._reset();
    document.body.innerHTML = '<div id="ui-toolbar"><button data-tool="road"></button></div><div id="root"></div>';
    root = document.getElementById('root');
    mountMaterialSubmenu(root);
  });

  it('renders one tile per material with name and price on materials:show', () => {
    bus.emit('materials:show', { type: 'road', list: ROAD_MATERIALS, current: 'asphalt' });
    const tiles = root.querySelectorAll('.mat-tile');
    expect(tiles).toHaveLength(ROAD_MATERIALS.length);
    const dirt = root.querySelector('.mat-tile[data-material="dirt"]');
    expect(dirt.querySelector('.mat-name').textContent).toBe('Dirt');
    expect(dirt.querySelector('.mat-cost').textContent).toBe(`$${tilePrice(MATERIALS.dirt)}`);
  });

  it('marks the current material active and opens', () => {
    bus.emit('materials:show', { type: 'beam', list: BEAM_MATERIALS, current: 'steel' });
    expect(root.querySelector('.material-submenu').classList.contains('open')).toBe(true);
    expect(root.querySelector('.mat-tile[data-material="steel"]').dataset.active).toBe('true');
  });

  it('clicking a tile emits material:select with its id', () => {
    let picked = null;
    bus.on('material:select', (p) => { picked = p; });
    bus.emit('materials:show', { type: 'road', list: ROAD_MATERIALS, current: 'asphalt' });
    root.querySelector('.mat-tile[data-material="concrete"]').click();
    expect(picked).toEqual({ id: 'concrete' });
  });

  it('materials:hide closes the submenu', () => {
    bus.emit('materials:show', { type: 'road', list: ROAD_MATERIALS, current: 'asphalt' });
    bus.emit('materials:hide');
    expect(root.querySelector('.material-submenu').classList.contains('open')).toBe(false);
  });
});
