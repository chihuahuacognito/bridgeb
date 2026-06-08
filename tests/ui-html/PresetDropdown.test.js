import { describe, it, expect, beforeEach, vi } from 'vitest';
import { bus } from '../../src/ui-html/bus.js';
import { PresetDropdown } from '../../src/ui-html/components/PresetDropdown.js';

describe('PresetDropdown', () => {
  beforeEach(() => bus._reset());

  it('renders the current label and chevron', () => {
    const dd = PresetDropdown({
      label: 'LOAD PRESET',
      options: [{ key: 'normal', label: 'NORMAL — G' }],
      initial: 'normal',
    });
    expect(dd.textContent).toContain('LOAD PRESET');
    expect(dd.textContent).toContain('NORMAL');
  });

  it('opens a menu on click and emits gravity:preset on option click', () => {
    const spy = vi.fn();
    bus.on('gravity:preset', spy);
    const dd = PresetDropdown({
      label: 'LOAD PRESET',
      options: [{ key: 'normal', label: 'NORMAL — G' }, { key: 'low', label: 'LOW — G' }],
      initial: 'normal',
    });
    document.body.appendChild(dd);
    dd.click();
    const opts = dd.querySelectorAll('.menu .opt');
    expect(opts.length).toBe(2);
    opts[1].click();
    expect(spy).toHaveBeenCalledWith('low');
  });
});
