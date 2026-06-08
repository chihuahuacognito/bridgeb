import { describe, it, expect, beforeEach } from 'vitest';
import { bus } from '../../src/ui-html/bus.js';
import { mountUi } from '../../src/ui-html/index.js';

function setupDom() {
  document.body.innerHTML = `
    <div id="app">
      <div id="game"></div>
      <div id="ui-root">
        <header id="ui-topbar"></header>
        <aside  id="ui-sidebar"></aside>
        <div    id="ui-hud"></div>
        <nav    id="ui-toolbar"></nav>
        <div    id="ui-size-row"></div>
        <div    id="ui-modals"></div>
      </div>
    </div>`;
}

describe('mountUi integration', () => {
  beforeEach(() => {
    bus._reset();
    setupDom();
    mountUi({
      presetOptions: [{ key: 'normal', label: 'NORMAL — G' }, { key: 'low', label: 'LOW — G' }],
      initialPreset: 'normal',
      initialVehicle: 'car',
    });
  });

  it('mounts content in every chrome region', () => {
    expect(document.querySelector('#ui-topbar').children.length).toBeGreaterThan(0);
    expect(document.querySelector('#ui-sidebar').children.length).toBeGreaterThan(0);
    expect(document.querySelector('#ui-hud').children.length).toBeGreaterThan(0);
    expect(document.querySelector('#ui-toolbar').children.length).toBeGreaterThan(0);
  });

  it('toggles sidebar-hidden / hud-hidden via mode:changed', () => {
    bus.emit('mode:changed', 'test');
    expect(document.querySelector('#ui-root').classList.contains('mode-test')).toBe(true);
    bus.emit('mode:changed', 'build');
    expect(document.querySelector('#ui-root').classList.contains('mode-build')).toBe(true);
  });

  it('budget:update propagates from scene to chip', () => {
    bus.emit('budget:update', 400);
    expect(document.querySelector('.budget-num').textContent).toBe('400');
  });

  it('hud:update propagates to HUD', () => {
    bus.emit('hud:update', { spd: '2.5' });
    expect(document.querySelector('[data-key="spd"]').textContent).toBe('2.5');
  });

  it('vehicle:active sets data-selected on the right card', () => {
    bus.emit('vehicle:active', 'truck');
    expect(document.querySelector('[data-key="truck"]').dataset.selected).toBe('true');
  });
});
