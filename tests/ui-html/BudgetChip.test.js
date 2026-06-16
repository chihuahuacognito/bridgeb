import { describe, it, expect, beforeEach } from 'vitest';
import { bus } from '../../src/ui-html/bus.js';
import { BudgetChip } from '../../src/ui-html/components/BudgetChip.js';

describe('BudgetChip', () => {
  beforeEach(() => bus._reset());

  it('road chip renders 0 by default', () => {
    const chip = BudgetChip({ type: 'road' });
    expect(chip.querySelector('.budget-num').textContent).toBe('0');
  });

  it('road chip updates number when bus emits budget:update', () => {
    const chip = BudgetChip({ type: 'road' });
    bus.emit('budget:update', { road: 250, wood: null });
    expect(chip.querySelector('.budget-num').textContent).toBe('250');
  });

  it('wood chip updates number when bus emits budget:update', () => {
    const chip = BudgetChip({ type: 'wood' });
    bus.emit('budget:update', { road: 100, wood: 50 });
    expect(chip.querySelector('.budget-num').textContent).toBe('50');
  });

  it('wood chip hides when wood payload is null', () => {
    const chip = BudgetChip({ type: 'wood' });
    bus.emit('budget:update', { road: 100, wood: null });
    expect(chip.style.display).toBe('none');
  });

  it('road chip shows ROAD label', () => {
    const chip = BudgetChip({ type: 'road' });
    expect(chip.textContent).toContain('ROAD');
  });

  it('wood chip shows WOOD label', () => {
    const chip = BudgetChip({ type: 'wood' });
    expect(chip.textContent).toContain('WOOD');
  });
});
