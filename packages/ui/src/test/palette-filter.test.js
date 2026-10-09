import { describe, expect, it } from 'vitest';
import { paletteFilter } from '../shell/palette-filter.js';

const item = (label, group) => [`screen:${label.replace(/\s/g, '')}`, [label, group]];

describe('command palette matching', () => {
  it('matches word starts, not letters scattered across words', () => {
    expect(
      paletteFilter(
        item('Laboratory', 'Diagnostics')[0],
        'lab',
        item('Laboratory', 'Diagnostics')[1],
      ),
    ).toBe(1);
    expect(
      paletteFilter(
        item('Billing Analytics', 'Overview')[0],
        'lab',
        item('Billing Analytics', 'Overview')[1],
      ),
    ).toBe(0);
    expect(
      paletteFilter(
        item('Shifts and Day-end', 'Business')[0],
        'lab',
        item('Shifts and Day-end', 'Business')[1],
      ),
    ).toBe(0);
  });

  it('needs every word, ranks label starts first and ignores the id', () => {
    const [v, k] = item('Lab Analytics', 'Overview');
    expect(paletteFilter(v, 'lab an', k)).toBe(1);
    expect(paletteFilter(v, 'analytics', k)).toBe(0.5);
    expect(paletteFilter(v, 'over lab', k)).toBe(0.5);
    expect(paletteFilter(v, 'lab billing', k)).toBe(0);
    expect(paletteFilter(v, 'screen', k)).toBe(0);
    expect(paletteFilter(v, '', k)).toBe(1);
  });
});
