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
    icon: I.redo(), label: 'REDO', disabled: true,
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

  root.appendChild(BudgetChip());

  root.appendChild(IconButton({ icon: I.save(),     label: 'SAVE',     disabled: true }));
  root.appendChild(IconButton({ icon: I.load(),     label: 'LOAD',     disabled: true }));
  root.appendChild(IconButton({ icon: I.settings(), label: 'SETTINGS', disabled: true }));
  root.appendChild(IconButton({ icon: I.help(),     label: 'HELP',     disabled: true }));

  bus.on('mode:changed', (mode) => {
    cta.setLabel(mode === 'test' ? 'RESET SIM' : 'TEST');
  });
}
