// tests/tutorial.test.js
// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import tutorial, { shouldShowHint } from '../src/systems/tutorial.js';

describe('shouldShowHint', () => {
  const mk = (phase, hint) => ({ phase, tutorial: hint ? { hint } : undefined });

  it('returns false when the level has no hint', () => {
    expect(shouldShowHint(mk('topic'), 99)).toBe(false);
  });

  it('tutorial phase: hint on first failure', () => {
    const l = mk('tutorial', { text: 'x' });
    expect(shouldShowHint(l, 0)).toBe(false);
    expect(shouldShowHint(l, 1)).toBe(true);
  });

  it('topic and challenge phases: hint after 2 failures', () => {
    for (const phase of ['topic', 'challenge']) {
      const l = mk(phase, { text: 'x' });
      expect(shouldShowHint(l, 1)).toBe(false);
      expect(shouldShowHint(l, 2)).toBe(true);
    }
  });

  it('per-level afterFails override wins', () => {
    const l = mk('topic', { text: 'x', afterFails: 3 });
    expect(shouldShowHint(l, 2)).toBe(false);
    expect(shouldShowHint(l, 3)).toBe(true);
  });
});

describe('tutorial card DOM', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="ui-modals"></div>';
    tutorial.attach();
  });

  it('showIntro renders a card with icon and text', () => {
    tutorial.showIntro({ phase: 'tutorial', tutorial: { intro: { icon: '👆', text: 'Tap!' } } });
    const card = document.querySelector('.tutorial-card');
    expect(card).not.toBeNull();
    expect(card.textContent).toContain('👆');
    expect(card.textContent).toContain('Tap!');
  });

  it('clicking the card dismisses it', () => {
    tutorial.showIntro({ phase: 'tutorial', tutorial: { intro: { text: 'Tap!' } } });
    document.querySelector('.tutorial-card').click();
    expect(document.querySelector('.tutorial-card')).toBeNull();
  });

  it('onFail shows the hint only after the gated count', () => {
    const lvl = { phase: 'topic', tutorial: { hint: { text: 'Try a triangle' } } };
    tutorial.onFail(lvl);                                  // 1 fail — no card
    expect(document.querySelector('.tutorial-card')).toBeNull();
    tutorial.onFail(lvl);                                  // 2 fails — card
    expect(document.querySelector('.tutorial-card').textContent).toContain('Try a triangle');
  });

  it('reset clears the fail count and any card', () => {
    const lvl = { phase: 'tutorial', tutorial: { hint: { text: 'h' } } };
    tutorial.onFail(lvl);
    expect(document.querySelector('.tutorial-card')).not.toBeNull();
    tutorial.reset();
    expect(document.querySelector('.tutorial-card')).toBeNull();
    tutorial.onFail(lvl); // count restarted: 1 fail in 'tutorial' phase → shows again
    expect(document.querySelector('.tutorial-card')).not.toBeNull();
  });
});
