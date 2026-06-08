import { describe, it, expect, beforeEach, vi } from 'vitest';
import { bus } from '../../src/ui-html/bus.js';
import { mountSizeRow } from '../../src/ui-html/components/SizeRow.js';

const SIZES = [
  { key: 'S',  length: 40,  cost: 2 },
  { key: 'M',  length: 80,  cost: 4 },
  { key: 'L',  length: 160, cost: 8 },
  { key: 'XL', length: 240, cost: 12 },
];

describe('SizeRow', () => {
  let host;
  beforeEach(() => {
    bus._reset();
    host = document.createElement('div');
    document.body.appendChild(host);
    mountSizeRow(host);
  });

  it('is hidden by default', () => {
    expect(host.dataset.visible).not.toBe('true');
  });

  it('renders S/M/L/XL tiles with cost labels when sizes:show fires', () => {
    bus.emit('sizes:show', { sizes: SIZES, current: 'M' });
    expect(host.dataset.visible).toBe('true');
    for (const sz of SIZES) {
      const tile = host.querySelector(`[data-size="${sz.key}"]`);
      expect(tile).not.toBeNull();
      expect(tile.textContent).toContain(sz.key);
      expect(tile.textContent).toContain(`$${sz.cost}`);
    }
  });

  it('marks the current size as active', () => {
    bus.emit('sizes:show', { sizes: SIZES, current: 'L' });
    expect(host.querySelector('[data-size="L"]').dataset.active).toBe('true');
    expect(host.querySelector('[data-size="M"]').dataset.active).not.toBe('true');
  });

  it('hides when sizes:hide fires', () => {
    bus.emit('sizes:show', { sizes: SIZES, current: 'M' });
    bus.emit('sizes:hide');
    expect(host.dataset.visible).not.toBe('true');
  });

  it('emits size:select on tile click', () => {
    const spy = vi.fn();
    bus.on('size:select', spy);
    bus.emit('sizes:show', { sizes: SIZES, current: 'M' });
    host.querySelector('[data-size="XL"]').click();
    expect(spy).toHaveBeenCalledWith('XL');
  });

  it('updates active marker when sizes:show fires again with a different current', () => {
    bus.emit('sizes:show', { sizes: SIZES, current: 'S' });
    bus.emit('sizes:show', { sizes: SIZES, current: 'XL' });
    expect(host.querySelector('[data-size="XL"]').dataset.active).toBe('true');
    expect(host.querySelector('[data-size="S"]').dataset.active).not.toBe('true');
  });
});
