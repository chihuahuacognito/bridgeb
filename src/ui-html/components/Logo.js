import { bridgeLogo } from '../icons/index.js';

export function Logo() {
  const root = document.createElement('div');
  root.className = 'logo';

  const iconWrap = document.createElement('div');
  iconWrap.className = 'logo-icon';
  iconWrap.innerHTML = bridgeLogo();

  const text = document.createElement('div');
  text.className = 'logo-text';
  text.innerHTML = '<strong>BRIDGE BUILDER</strong><small>EDITOR</small>';

  root.append(iconWrap, text);
  return root;
}
