import { bus } from '../bus.js';

// Small player-facing "N/total across" counter shown during a convoy test run.
// Hidden for single-vehicle levels (total <= 1) so they look exactly as before.
export function mountConvoyProgress(root) {
  const el = document.createElement('div');
  el.className = 'convoy-progress';
  el.style.display = 'none';
  root.appendChild(el);

  bus.on('convoy:progress', ({ crossed, total }) => {
    if (!total || total <= 1) { el.style.display = 'none'; return; }
    el.style.display = '';
    el.textContent = `${crossed}/${total} across`;
  });

  // Always hide when leaving test mode.
  bus.on('mode:changed', (mode) => {
    if (mode !== 'test') el.style.display = 'none';
  });
}
