import { describe, it, expect, beforeEach } from 'vitest';
import { bus } from '../../src/ui-html/bus.js';
import { BudgetChip } from '../../src/ui-html/components/BudgetChip.js';

describe('BudgetChip', () => {
  beforeEach(() => bus._reset());

  it('renders 0 by default with a BUDGET label', () => {
    const chip = BudgetChip();
    expect(chip.querySelector('.budget-num').textContent).toBe('0');
    expect(chip.textContent).toContain('BUDGET');
  });

  it('updates the total when bus emits budget:update', () => {
    const chip = BudgetChip();
    bus.emit('budget:update', { total: 250 });
    expect(chip.querySelector('.budget-num').textContent).toBe('250');
  });

  it('flashes on budget:flash', () => {
    const chip = BudgetChip();
    bus.emit('budget:flash');
    expect(chip.classList.contains('budget-chip--flash')).toBe(true);
  });
});
