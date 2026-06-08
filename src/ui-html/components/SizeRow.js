import { bus } from '../bus.js';

export function mountSizeRow(root) {
  root.classList.add('size-row');

  function render({ sizes, current }) {
    root.innerHTML = '';
    for (const sz of sizes) {
      const tile = document.createElement('button');
      tile.type = 'button';
      tile.className = 'btn btn--white size-tile';
      tile.dataset.size = sz.key;
      if (sz.key === current) tile.dataset.active = 'true';

      const label = document.createElement('span');
      label.className = 'size-key';
      label.textContent = sz.key;

      const cost = document.createElement('span');
      cost.className = 'size-cost';
      cost.textContent = `$${sz.cost}`;

      tile.append(label, cost);
      tile.addEventListener('click', () => bus.emit('size:select', sz.key));
      root.appendChild(tile);
    }
    root.dataset.visible = 'true';
  }

  bus.on('sizes:show', render);
  bus.on('sizes:hide', () => {
    root.innerHTML = '';
    delete root.dataset.visible;
  });
}
