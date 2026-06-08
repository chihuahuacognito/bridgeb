import { describe, it, expect, vi, beforeEach } from 'vitest';
import { bus } from '../../src/ui-html/bus.js';

describe('bus', () => {
  beforeEach(() => bus._reset());

  it('delivers an emitted event to a subscribed listener', () => {
    const spy = vi.fn();
    bus.on('hello', spy);
    bus.emit('hello', 42);
    expect(spy).toHaveBeenCalledWith(42);
  });

  it('supports multiple listeners on the same event', () => {
    const a = vi.fn();
    const b = vi.fn();
    bus.on('x', a);
    bus.on('x', b);
    bus.emit('x', 'hi');
    expect(a).toHaveBeenCalledWith('hi');
    expect(b).toHaveBeenCalledWith('hi');
  });

  it('off() removes a single listener', () => {
    const spy = vi.fn();
    bus.on('x', spy);
    bus.off('x', spy);
    bus.emit('x');
    expect(spy).not.toHaveBeenCalled();
  });

  it('does not throw when emitting an event with no listeners', () => {
    expect(() => bus.emit('nobody')).not.toThrow();
  });

  it('is a shared singleton across imports', async () => {
    const { bus: again } = await import('../../src/ui-html/bus.js');
    expect(again).toBe(bus);
  });
});
