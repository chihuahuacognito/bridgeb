import { describe, it, expect, vi, beforeEach } from 'vitest';
import { IconButton } from '../../src/ui-html/components/IconButton.js';

describe('IconButton', () => {
  let host;
  beforeEach(() => { host = document.createElement('div'); document.body.appendChild(host); });

  it('renders a button with label and svg icon', () => {
    const btn = IconButton({ icon: '<svg class="icon"></svg>', label: 'undo' });
    host.appendChild(btn);
    expect(btn.tagName).toBe('BUTTON');
    expect(btn.querySelector('svg.icon')).not.toBeNull();
    expect(btn.textContent.toUpperCase()).toContain('UNDO');
  });

  it('fires onClick when clicked', () => {
    const spy = vi.fn();
    const btn = IconButton({ icon: '<svg></svg>', label: 'x', onClick: spy });
    host.appendChild(btn);
    btn.click();
    expect(spy).toHaveBeenCalledOnce();
  });

  it('does not fire onClick when disabled', () => {
    const spy = vi.fn();
    const btn = IconButton({ icon: '<svg></svg>', label: 'x', onClick: spy, disabled: true });
    host.appendChild(btn);
    btn.click();
    expect(spy).not.toHaveBeenCalled();
    expect(btn.getAttribute('aria-disabled')).toBe('true');
  });

  it('applies icon accent class when accent is provided', () => {
    const btn = IconButton({ icon: '<svg class="icon"></svg>', label: 'clear', accent: 'red' });
    expect(btn.querySelector('.icon').classList.contains('icon--red')).toBe(true);
  });
});
