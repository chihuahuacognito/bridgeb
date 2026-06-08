import { bus } from '../bus.js';

export function ToolTile({ tool, label, iconSvg, accent, disabled = false }) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'btn btn--white tool-tile';
  btn.dataset.tool = tool;
  if (disabled) btn.setAttribute('aria-disabled', 'true');

  const iconWrap = document.createElement('span');
  iconWrap.innerHTML = iconSvg;
  const svgEl = iconWrap.querySelector('svg');
  if (svgEl && accent) svgEl.classList.add(`icon--${accent}`);
  if (svgEl) btn.appendChild(svgEl);

  const lbl = document.createElement('span');
  lbl.className = 'label';
  lbl.textContent = label.toUpperCase();
  btn.appendChild(lbl);

  btn.addEventListener('click', () => {
    if (btn.getAttribute('aria-disabled') === 'true') return;
    bus.emit('tool:select', tool);
  });
  return btn;
}
