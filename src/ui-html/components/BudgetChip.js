import { bus } from '../bus.js';

// Single total-budget chip. Every material spends from one pool; this shows the
// remaining total and flashes when a placement is (or can't be) afforded.
export function BudgetChip() {
  const root = document.createElement('div');
  root.className = 'budget-chip budget-chip--total';

  const text = document.createElement('div');
  text.className = 'budget-text';

  const label = document.createElement('small');
  label.textContent = 'BUDGET';

  const num = document.createElement('div');
  num.className = 'budget-num';
  num.textContent = '0';

  text.append(label, num);

  const icon = document.createElement('div');
  icon.className = 'budget-icon';
  icon.innerHTML =
    '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">' +
    '<circle cx="12" cy="12" r="9" fill="currentColor" opacity="0.9"/>' +
    '<path d="M12 7.2v9.6M9.6 9.4c0-1.1 1.05-1.6 2.4-1.6s2.4.6 2.4 1.6-1.05 1.5-2.4 1.8-2.4.8-2.4 1.9 1.05 1.6 2.4 1.6 2.4-.6 2.4-1.5" ' +
    'stroke="#fff" stroke-width="1.5" stroke-linecap="round"/></svg>';

  root.append(text, icon);

  bus.on('budget:update', (payload) => {
    num.textContent = payload?.total != null ? String(payload.total) : '0';
  });

  bus.on('budget:flash', () => {
    root.classList.add('budget-chip--flash');
    root.addEventListener('animationend', () => root.classList.remove('budget-chip--flash'), { once: true });
  });

  return root;
}
