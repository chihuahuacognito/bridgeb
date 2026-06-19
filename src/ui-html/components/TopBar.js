import { bus } from '../bus.js';
import { Logo } from './Logo.js';
import { IconButton } from './IconButton.js';
import { CtaButton } from './CtaButton.js';
import { BudgetChip } from './BudgetChip.js';
import * as I from '../icons/index.js';

export function mountTopBar(root) {
  root.appendChild(Logo());

  root.appendChild(IconButton({
    icon: I.undo(), label: 'UNDO',
    onClick: () => bus.emit('undo'),
  }));
  root.appendChild(IconButton({
    icon: I.home(), label: 'HOME',
    onClick: () => bus.emit('level:menu'),
  }));
  root.appendChild(IconButton({
    icon: I.clear(), label: 'CLEAR', accent: 'red',
    onClick: () => bus.emit('clear'),
  }));

  const cta = CtaButton({
    label: 'TEST',
    size: 'large',
    onClick: () => bus.emit('mode:toggle'),
  });
  root.appendChild(cta);

  const roadChip = BudgetChip({ type: 'road' });
  const woodChip = BudgetChip({ type: 'wood' });
  root.appendChild(roadChip);
  root.appendChild(woodChip);

  const saveBtn = IconButton({
    icon: I.save(), label: 'SAVE',
    onClick: () => bus.emit('layout:save'),
  });
  root.appendChild(saveBtn);

  const loadBtn = IconButton({
    icon: I.load(), label: 'LOAD', disabled: true,
    onClick: () => bus.emit('layout:load'),
  });
  root.appendChild(loadBtn);

  root.appendChild(IconButton({ icon: I.settings(), label: 'SETTINGS', disabled: true }));
  root.appendChild(IconButton({ icon: I.help(),     label: 'HELP',     disabled: true }));

  bus.on('mode:changed', (mode) => {
    cta.setLabel(mode === 'test' ? 'RESET SIM' : 'TEST');
  });

  bus.on('ui:config', (cfg) => {
    const showBudget = cfg?.budgetMeter !== false;
    roadChip.style.display = showBudget ? '' : 'none';
    // When budget is hidden, also hide wood. When budget is visible,
    // the budget:update event controls wood chip visibility per-level.
    if (!showBudget) woodChip.style.display = 'none';
    else woodChip.style.display = '';
  });

  bus.on('layout:saved', () => {
    saveBtn.classList.add('btn--saved');
    setTimeout(() => saveBtn.classList.remove('btn--saved'), 800);
    loadBtn.removeAttribute('aria-disabled');
  });

  bus.on('layout:load-available', (available) => {
    if (available) {
      loadBtn.removeAttribute('aria-disabled');
    } else {
      loadBtn.setAttribute('aria-disabled', 'true');
    }
  });
}
