import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CodeInput } from '../index.js';

function Harness({ onComplete }) {
  const [v, setV] = useState('');
  return <CodeInput value={v} onChange={setV} onComplete={onComplete} autoFocus label="Code" />;
}

describe('CodeInput', () => {
  it('autofocuses, moves forward while typing and completes', async () => {
    const onComplete = vi.fn();
    const user = userEvent.setup();
    render(<Harness onComplete={onComplete} />);
    const boxes = screen.getAllByRole('textbox');
    expect(boxes[0]).toHaveFocus();
    await user.keyboard('123456');
    expect(boxes.map((b) => b.value).join('')).toBe('123456');
    expect(onComplete).toHaveBeenCalledWith('123456');
  });

  it('fills every box from a paste, ignoring spaces and dashes', async () => {
    const onComplete = vi.fn();
    const user = userEvent.setup();
    render(<Harness onComplete={onComplete} />);
    await user.paste('482 913');
    expect(onComplete).toHaveBeenCalledWith('482913');
  });

  it('moves back on Backspace', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const boxes = screen.getAllByRole('textbox');
    await user.keyboard('12');
    expect(boxes[2]).toHaveFocus();
    await user.keyboard('{Backspace}');
    expect(boxes[1]).toHaveFocus();
    expect(boxes[1]).toHaveValue('');
  });
});
