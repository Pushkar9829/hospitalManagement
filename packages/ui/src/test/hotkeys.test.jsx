import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { HotkeysProvider, useHotkeys, usePageAction, matchesCombo } from '../index.js';

function Page({ onPalette, onHelp, onSave }) {
  useHotkeys(
    [
      { keys: 'mod+k', handler: onPalette, allowInInputs: true, description: 'Palette' },
      { keys: '?', handler: onHelp, description: 'Help' },
    ],
    { group: 'global' },
  );
  usePageAction('save', onSave);
  return <input aria-label="Name" />;
}

describe('hotkeys', () => {
  it('matches combinations', () => {
    expect(matchesCombo({ key: 'k', ctrlKey: true }, 'mod+k')).toBe(true);
    expect(matchesCombo({ key: 'k', metaKey: true }, 'mod+k')).toBe(true);
    expect(matchesCombo({ key: 'k' }, 'mod+k')).toBe(false);
    expect(matchesCombo({ key: 'ß', code: 'KeyS', altKey: true }, 'alt+s')).toBe(true);
    expect(matchesCombo({ key: '?', shiftKey: true }, '?')).toBe(true);
    expect(matchesCombo({ key: 'Escape' }, 'escape')).toBe(true);
  });

  it('fires shortcuts, but only Ctrl+K and Alt+S while typing', () => {
    const onPalette = vi.fn();
    const onHelp = vi.fn();
    const onSave = vi.fn();
    render(
      <HotkeysProvider>
        <Page onPalette={onPalette} onHelp={onHelp} onSave={onSave} />
      </HotkeysProvider>,
    );
    fireEvent.keyDown(document.body, { key: '?', shiftKey: true });
    expect(onHelp).toHaveBeenCalledTimes(1);

    const input = screen.getByLabelText('Name');
    fireEvent.keyDown(input, { key: '?', shiftKey: true });
    expect(onHelp).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(input, { key: 'k', ctrlKey: true });
    expect(onPalette).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(input, { key: 's', code: 'KeyS', altKey: true });
    expect(onSave).toHaveBeenCalledTimes(1);
  });
});
