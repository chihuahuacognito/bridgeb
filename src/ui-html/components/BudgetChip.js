import { bus } from '../bus.js';
import { road as roadIcon, beam as beamIcon } from '../icons/index.js';

export function BudgetChip({ type }) {
  const isRoad = type === 'road';

  const root = document.createElement('div');
  root.className = `budget-chip budget-chip--${type}`;

  const text = document.createElement('div');
  text.className = 'budget-text';

  const label = document.createElement('small');
  label.textContent = isRoad ? 'ROAD' : 'WOOD';

  const num = document.createElement('div');
  num.className = 'budget-num';
  num.textContent = '0';

  text.append(label, num);

  const iconWrap = document.createElement('div');
  iconWrap.innerHTML = isRoad ? roadIcon() : beamIcon();
  const iconSvg = iconWrap.querySelector('svg');
  if (iconSvg) iconSvg.classList.add('budget-icon');

  root.append(text, iconSvg ?? iconWrap);

  bus.on('budget:update', (payload) => {
    const val = isRoad ? payload.road : payload.wood;
    if (!isRoad) root.style.display = val == null ? 'none' : '';
    num.textContent = val != null ? String(val) : '0';
  });

  bus.on('budget:flash', (materialType) => {
    const matches = isRoad ? materialType === 'road' : materialType === 'beam';
    if (!matches) return;
    root.classList.add('budget-chip--flash');
    root.addEventListener('animationend', () => root.classList.remove('budget-chip--flash'), { once: true });
  });

  return root;
}
