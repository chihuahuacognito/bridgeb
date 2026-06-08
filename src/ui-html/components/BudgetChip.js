import { bus } from '../bus.js';
import { coin } from '../icons/index.js';

export function BudgetChip() {
  const root = document.createElement('div');
  root.className = 'budget-chip';

  const text = document.createElement('div');
  text.className = 'budget-text';
  const small = document.createElement('small');
  small.textContent = 'BUDGET LEFT';
  const num = document.createElement('div');
  num.className = 'budget-num';
  num.textContent = '0';
  text.append(small, num);

  const coinWrap = document.createElement('div');
  coinWrap.innerHTML = coin();
  const coinSvg = coinWrap.querySelector('svg');
  if (coinSvg) coinSvg.classList.add('coin');

  root.append(text, coinSvg ?? coinWrap);

  bus.on('budget:update', (n) => { num.textContent = String(n); });
  return root;
}
