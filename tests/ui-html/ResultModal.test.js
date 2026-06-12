// tests/ui-html/ResultModal.test.js
// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { bus } from '../../src/ui-html/bus.js';
import { mountResultModal } from '../../src/ui-html/components/ResultModal.js';

describe('ResultModal', () => {
  beforeEach(() => {
    bus._reset();
    document.body.innerHTML = '<div id="m"></div>';
    mountResultModal(document.getElementById('m'));
  });

  it('renders win card with text, budget, and three buttons when hasNext', () => {
    bus.emit('level:result', { won: true, text: 'You did it!', budgetLeft: 5, hasNext: true });
    const card = document.querySelector('.result-card');
    expect(card.textContent).toContain('You did it!');
    expect(card.textContent).toContain('5');
    const labels = [...document.querySelectorAll('.result-buttons button')].map(b => b.textContent);
    expect(labels).toEqual(['TRY AGAIN', 'NEXT LEVEL', 'MENU']);
  });

  it('omits NEXT LEVEL when hasNext is false', () => {
    bus.emit('level:result', { won: true, hasNext: false });
    const labels = [...document.querySelectorAll('.result-buttons button')].map(b => b.textContent);
    expect(labels).toEqual(['TRY AGAIN', 'MENU']);
  });

  it('buttons emit their event and close the modal', () => {
    const onNext = vi.fn();
    bus.on('level:next', onNext);
    bus.emit('level:result', { won: true, hasNext: true });
    [...document.querySelectorAll('.result-buttons button')]
      .find(b => b.textContent === 'NEXT LEVEL').click();
    expect(onNext).toHaveBeenCalled();
    expect(document.querySelector('.result-modal')).toBeNull();
  });

  it('level:result-hide closes the modal', () => {
    bus.emit('level:result', { won: true, hasNext: true });
    bus.emit('level:result-hide');
    expect(document.querySelector('.result-modal')).toBeNull();
  });
});
