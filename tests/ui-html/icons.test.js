import { describe, it, expect } from 'vitest';
import * as icons from '../../src/ui-html/icons/index.js';

const REQUIRED = [
  'nodes', 'road', 'beam', 'cable', 'hydraulic', 'spring', 'remove',
  'grid', 'snap', 'zoomIn', 'zoomOut', 'play',
  'undo', 'redo', 'clear', 'save', 'load', 'settings', 'help',
  'coin', 'bridgeLogo',
];

describe('icons module', () => {
  it.each(REQUIRED)('exports %s as a function returning SVG markup', (name) => {
    const fn = icons[name];
    expect(typeof fn).toBe('function');
    const svg = fn();
    expect(svg).toMatch(/^<svg /);
    expect(svg).toContain('</svg>');
  });
});
