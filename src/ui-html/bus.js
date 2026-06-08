const listeners = new Map();

function on(event, fn) {
  if (!listeners.has(event)) listeners.set(event, new Set());
  listeners.get(event).add(fn);
}

function off(event, fn) {
  listeners.get(event)?.delete(fn);
}

function emit(event, payload) {
  const set = listeners.get(event);
  if (!set) return;
  for (const fn of [...set]) fn(payload);
}

function _reset() {
  listeners.clear();
}

export const bus = { on, off, emit, _reset };
