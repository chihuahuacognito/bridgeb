import { bus } from './bus.js';
import { mountTopBar } from './components/TopBar.js';
import { mountSidebar } from './components/Sidebar.js';
import { mountHud }     from './components/Hud.js';
import { mountToolbar } from './components/Toolbar.js';
import { mountSizeRow } from './components/SizeRow.js';
import { mountResultModal } from './components/ResultModal.js';

export function mountUi(opts) {
  const root = document.getElementById('ui-root');
  root.classList.add('mode-build');

  mountTopBar(document.getElementById('ui-topbar'));
  mountSidebar(document.getElementById('ui-sidebar'), {
    presetOptions: opts.presetOptions,
    initialPreset: opts.initialPreset,
  });
  mountHud(document.getElementById('ui-hud'));
  mountToolbar(document.getElementById('ui-toolbar'));
  mountSizeRow(document.getElementById('ui-size-row'));
  mountResultModal(document.getElementById('ui-modals'));

  bus.on('mode:changed', (mode) => {
    root.classList.remove('mode-build', 'mode-test');
    root.classList.add(`mode-${mode}`);
  });

  bus.on('ui:config', (cfg) => {
    const sidebar = document.getElementById('ui-sidebar');
    if (sidebar) sidebar.style.display = cfg?.vehicleSelect === false ? 'none' : '';
  });

  bus.on('ui:screen', (screen) => {
    root.classList.toggle('screen-menu', screen === 'menu');
  });

  if (opts.initialVehicle) bus.emit('vehicle:active', opts.initialVehicle);
}
