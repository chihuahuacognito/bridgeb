import { play } from '../icons/index.js';

export function CtaButton({ label, size = 'large', onClick }) {
  const btn = document.createElement('button');
  btn.className = 'btn btn--cta' + (size === 'small' ? ' play-small' : '');
  btn.type = 'button';
  if (size === 'small') btn.style.padding = '0 22px';

  const iconSpan = document.createElement('span');
  iconSpan.innerHTML = play();
  const svgEl = iconSpan.querySelector('svg');
  if (svgEl) {
    svgEl.classList.add('icon--white');
    svgEl.style.width = '18px';
    svgEl.style.height = '18px';
    btn.appendChild(svgEl);
  }

  const lbl = document.createElement('span');
  lbl.textContent = label.toUpperCase();
  btn.appendChild(lbl);

  btn.setLabel = (text) => { lbl.textContent = text.toUpperCase(); };
  if (onClick) btn.addEventListener('click', onClick);
  return btn;
}
