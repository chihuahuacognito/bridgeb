// src/systems/tutorial.js
// Data-driven tutorial cards rendered into #ui-modals.
// Follows the system lifecycle contract: attach(scene), detach(scene), reset().
import { bus } from '../ui-html/bus.js';

const PHASE_HINT_AFTER = { tutorial: 1, topic: 2, challenge: 2 };

export function shouldShowHint(level, failCount) {
  const hint = level.tutorial?.hint;
  if (!hint) return false;
  const after = hint.afterFails ?? PHASE_HINT_AFTER[level.phase] ?? 2;
  return failCount >= after;
}

const tutorial = {
  _root: null,
  _card: null,
  _failCount: 0,

  attach() {
    this.hideCard(); // drop any stale card reference from a previous scene
    this._root = typeof document !== 'undefined'
      ? document.getElementById('ui-modals')
      : null;
    this._failCount = 0;
  },

  detach() {
    this.hideCard();
    this._root = null;
  },

  reset() {
    this._failCount = 0;
    this.hideCard();
  },

  showIntro(level) {
    const card = level.tutorial?.intro;
    if (card) this._show(card);
  },

  onFail(level) {
    this._failCount += 1;
    if (shouldShowHint(level, this._failCount)) this._show(level.tutorial.hint);
  },

  hideCard() {
    this._card?.remove();
    this._card = null;
  },

  _show({ icon, text }) {
    if (!this._root) return;
    this.hideCard();
    const el = document.createElement('div');
    el.className = 'tutorial-card';
    const ic = document.createElement('div');
    ic.className = 'tut-icon';
    ic.textContent = icon ?? '';
    const tx = document.createElement('div');
    tx.className = 'tut-text';
    tx.textContent = text ?? '';
    el.append(ic, tx);
    el.addEventListener('click', () => { this.hideCard(); bus.emit('mode:toggle'); });
    this._root.appendChild(el);
    this._card = el;
  },
};

export default tutorial;
