// src/ui-html/components/ResultModal.js
import { bus } from '../bus.js';

// Win-result modal. Fail keeps the existing in-canvas overlay + auto-return;
// this modal replaces the win auto-return (spec: success card with Next/Menu).
export function mountResultModal(root) {
  let el = null;

  function hide() {
    el?.remove();
    el = null;
  }

  function button(label, event) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'btn result-btn';
    b.textContent = label;
    b.addEventListener('click', () => { hide(); bus.emit(event); });
    return b;
  }

  bus.on('level:result', ({ won, text, budgetLeft, hasNext }) => {
    hide();
    el = document.createElement('div');
    el.className = 'result-modal';

    const card = document.createElement('div');
    card.className = `result-card ${won ? 'result-win' : 'result-fail'}`;

    const h = document.createElement('h2');
    h.textContent = won ? 'BRIDGE HOLDS!' : 'BRIDGE FAILED';
    card.appendChild(h);

    if (text) {
      const p = document.createElement('p');
      p.textContent = text;
      card.appendChild(p);
    }
    if (won && budgetLeft != null) {
      const b = document.createElement('p');
      b.className = 'result-budget';
      b.textContent = `Coins left: ${budgetLeft}`;
      card.appendChild(b);
    }

    const btns = document.createElement('div');
    btns.className = 'result-buttons';
    btns.appendChild(button('TRY AGAIN', 'level:retry'));
    if (won && hasNext) btns.appendChild(button('NEXT LEVEL', 'level:next'));
    btns.appendChild(button('MENU', 'level:menu'));
    card.appendChild(btns);

    el.appendChild(card);
    root.appendChild(el);
  });

  bus.on('level:result-hide', hide);
}
