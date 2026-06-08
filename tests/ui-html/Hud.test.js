import { describe, it, expect, beforeEach } from 'vitest';
import { bus } from '../../src/ui-html/bus.js';
import { mountHud } from '../../src/ui-html/components/Hud.js';

describe('Hud', () => {
  let host;
  beforeEach(() => {
    bus._reset();
    host = document.createElement('div');
    document.body.appendChild(host);
  });

  it('renders rows for SPD, ACCEL, DRIVE, CHASSIS, ANGVEL, SLOPE', () => {
    mountHud(host);
    for (const k of ['SPD', 'ACCEL', 'DRIVE', 'CHASSIS', 'ANGVEL', 'SLOPE']) {
      expect(host.textContent).toContain(k);
    }
  });

  it('writes all six values when hud:update fires', () => {
    mountHud(host);
    bus.emit('hud:update', { spd: '1.5', accel: '0.2', drive: '3.0', chassis: '-12.3°', angvel: '0.4', slope: '5°' });
    expect(host.querySelector('[data-key="spd"]').textContent).toBe('1.5');
    expect(host.querySelector('[data-key="accel"]').textContent).toBe('0.2');
    expect(host.querySelector('[data-key="drive"]').textContent).toBe('3.0');
    expect(host.querySelector('[data-key="chassis"]').textContent).toBe('-12.3°');
    expect(host.querySelector('[data-key="angvel"]').textContent).toBe('0.4');
    expect(host.querySelector('[data-key="slope"]').textContent).toBe('5°');
  });
});
