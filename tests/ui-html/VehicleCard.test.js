import { describe, it, expect, beforeEach, vi } from 'vitest';
import { bus } from '../../src/ui-html/bus.js';
import { VehicleCard } from '../../src/ui-html/components/VehicleCard.js';

describe('VehicleCard', () => {
  beforeEach(() => bus._reset());

  it('emits vehicle:select with its key when clicked', () => {
    const spy = vi.fn();
    bus.on('vehicle:select', spy);
    const card = VehicleCard({ key: 'truck', label: 'TRUCK', color: '#F7941E' });
    card.click();
    expect(spy).toHaveBeenCalledWith('truck');
  });

  it('marks data-selected when bus emits vehicle:active with its key', () => {
    const card = VehicleCard({ key: 'car', label: 'CAR', color: '#5AB942' });
    bus.emit('vehicle:active', 'car');
    expect(card.dataset.selected).toBe('true');
  });

  it('clears data-selected when vehicle:active fires for a different key', () => {
    const card = VehicleCard({ key: 'car', label: 'CAR', color: '#5AB942' });
    bus.emit('vehicle:active', 'car');
    bus.emit('vehicle:active', 'tank');
    expect(card.dataset.selected).not.toBe('true');
  });
});
