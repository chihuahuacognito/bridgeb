import { bus } from '../bus.js';

// Top-bar chip showing the player's place in the campaign, e.g. "LEVEL 5 / 12".
// Fed by the scene's `level:info` event; hides itself for off-campaign levels
// (DEV_STRESS and friends) where index is null.
export function LevelCounter() {
  const root = document.createElement('div');
  root.className = 'level-counter';

  const label = document.createElement('small');
  label.textContent = 'LEVEL';

  const num = document.createElement('div');
  num.className = 'level-counter-num';
  num.textContent = '—';

  root.append(label, num);

  bus.on('level:info', ({ index, total } = {}) => {
    if (index == null || total == null) {
      root.style.display = 'none';
      return;
    }
    root.style.display = '';
    num.textContent = `${index} / ${total}`;
  });

  return root;
}
