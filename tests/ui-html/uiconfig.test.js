// tests/ui-html/uiconfig.test.js
// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { bus } from '../../src/ui-html/bus.js';
import { mountTopBar } from '../../src/ui-html/components/TopBar.js';
import { mountToolbar } from '../../src/ui-html/components/Toolbar.js';

describe('ui:config', () => {
  beforeEach(() => {
    bus._reset();
    document.body.innerHTML = '<header id="t"></header><nav id="n"></nav>';
  });

  it('budgetMeter:false hides the budget chip; default shows it', () => {
    mountTopBar(document.getElementById('t'));
    const chip = document.querySelector('.budget-chip');
    bus.emit('ui:config', { budgetMeter: false });
    expect(chip.style.display).toBe('none');
    bus.emit('ui:config', {});
    expect(chip.style.display).toBe('');
  });

  it('tools whitelist hides non-listed active tools but keeps utility + play', () => {
    mountToolbar(document.getElementById('n'));
    bus.emit('ui:config', { tools: ['road'] });
    const tile = (k) => document.querySelector(`#n [data-tool="${k}"]`);
    expect(tile('road').style.display).toBe('');
    expect(tile('beam').style.display).toBe('none');
    expect(tile('remove').style.display).toBe('none');
    expect(tile('grid').style.display).toBe('');   // utility row untouched
    bus.emit('ui:config', {});                      // no whitelist → all visible
    expect(tile('beam').style.display).toBe('');
  });

  it('REMOVE tile is enabled (not aria-disabled)', () => {
    mountToolbar(document.getElementById('n'));
    const remove = document.querySelector('#n [data-tool="remove"]');
    expect(remove.getAttribute('aria-disabled')).not.toBe('true');
  });
});
