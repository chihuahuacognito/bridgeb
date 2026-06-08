export function IconButton({ icon, label, onClick, disabled = false, accent }) {
  const btn = document.createElement('button');
  btn.className = 'btn btn--white icon-btn';
  btn.type = 'button';
  if (disabled) btn.setAttribute('aria-disabled', 'true');
  btn.setAttribute('aria-label', label);

  const wrap = document.createElement('span');
  wrap.innerHTML = icon;
  const svgEl = wrap.querySelector('svg');
  if (svgEl && accent) svgEl.classList.add(`icon--${accent}`);
  if (svgEl) btn.appendChild(svgEl);

  const lbl = document.createElement('span');
  lbl.className = 'label';
  lbl.textContent = label.toUpperCase();
  btn.appendChild(lbl);

  if (onClick) {
    btn.addEventListener('click', (e) => {
      if (btn.getAttribute('aria-disabled') === 'true') return;
      onClick(e);
    });
  }
  return btn;
}
