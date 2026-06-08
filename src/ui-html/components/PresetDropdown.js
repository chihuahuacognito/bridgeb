import { bus } from '../bus.js';

export function PresetDropdown({ label, options, initial }) {
  const root = document.createElement('div');
  root.className = 'preset-pill';

  const text = document.createElement('div');
  const small = document.createElement('small');
  small.textContent = label;
  const strong = document.createElement('strong');
  const initialOpt = options.find(o => o.key === initial) ?? options[0];
  strong.textContent = (initialOpt?.label ?? '').toUpperCase();
  text.append(small, strong);

  const chev = document.createElement('span');
  chev.className = 'chev';
  chev.textContent = '▼';

  root.append(text, chev);

  let menu = null;
  function closeMenu() { menu?.remove(); menu = null; }
  root.addEventListener('click', (e) => {
    if (menu) { closeMenu(); return; }
    menu = document.createElement('div');
    menu.className = 'menu';
    for (const opt of options) {
      const item = document.createElement('div');
      item.className = 'opt';
      item.textContent = opt.label.toUpperCase();
      item.addEventListener('click', (ev) => {
        ev.stopPropagation();
        strong.textContent = opt.label.toUpperCase();
        bus.emit('gravity:preset', opt.key);
        closeMenu();
      });
      menu.appendChild(item);
    }
    root.appendChild(menu);
    e.stopPropagation();
  });
  document.addEventListener('click', closeMenu);

  return root;
}
