import { describe, it, expect, beforeEach, vi } from 'vitest';
import { bus } from '../../src/ui-html/bus.js';
import { mountToolbar } from '../../src/ui-html/components/Toolbar.js';

describe('Toolbar', () => {
  let host;
  beforeEach(() => {
    bus._reset();
    host = document.createElement('nav');
    document.body.appendChild(host);
  });

  it('renders all active and disabled tool tiles', () => {
    mountToolbar(host);
    for (const k of ['ROAD', 'BEAM', 'FREE', 'NODES', 'CABLE', 'HYDRAULIC', 'SPRING', 'REMOVE', 'GRID', 'SNAP']) {
      expect(host.textContent.toUpperCase()).toContain(k);
    }
  });

  it('emits tool:select when an active tile is clicked', () => {
    const spy = vi.fn();
    bus.on('tool:select', spy);
    mountToolbar(host);
    host.querySelector('[data-tool="road"]').click();
    expect(spy).toHaveBeenCalledWith('road');
  });

  it('does not emit when a disabled tile is clicked', () => {
    const spy = vi.fn();
    bus.on('tool:select', spy);
    mountToolbar(host);
    host.querySelector('[data-tool="cable"]').click();
    expect(spy).not.toHaveBeenCalled();
  });

  it('marks the active tile via data-active when tool:select fires', () => {
    mountToolbar(host);
    bus.emit('tool:select', 'beam');
    expect(host.querySelector('[data-tool="beam"]').dataset.active).toBe('true');
    expect(host.querySelector('[data-tool="road"]').dataset.active).not.toBe('true');
  });

  it('PLAY button emits mode:toggle', () => {
    const spy = vi.fn();
    bus.on('mode:toggle', spy);
    mountToolbar(host);
    host.querySelector('.play-small').click();
    expect(spy).toHaveBeenCalled();
  });
});
