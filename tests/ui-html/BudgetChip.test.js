import { describe, it, expect, beforeEach } from 'vitest';
import { bus } from '../../src/ui-html/bus.js';
import { BudgetChip } from '../../src/ui-html/components/BudgetChip.js';

describe('BudgetChip', () => {
  beforeEach(() => bus._reset());

  it('renders 0 by default', () => {
    const chip = BudgetChip();
    expect(chip.querySelector('.budget-num').textContent).toBe('0');
  });

  it('updates the number node when bus emits budget:update', () => {
    const chip = BudgetChip();
    bus.emit('budget:update', 250);
    expect(chip.querySelector('.budget-num').textContent).toBe('250');
  });

  it('shows the BUDGET LEFT label', () => {
    const chip = BudgetChip();
    expect(chip.textContent).toContain('BUDGET LEFT');
  });
});
