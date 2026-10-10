import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button, Sheet } from '../index.js';

describe('Sheet', () => {
  it('is a labelled dialog with a footer, closed by Esc and the close button', async () => {
    const onOpenChange = vi.fn();
    render(
      <Sheet
        open
        onOpenChange={onOpenChange}
        title="Register department"
        description="It becomes active after approval."
        footer={<Button>Submit for approval</Button>}
      >
        <input aria-label="Code" />
      </Sheet>,
    );
    const dialog = screen.getByRole('dialog', { name: 'Register department' });
    expect(dialog).toHaveAccessibleDescription('It becomes active after approval.');
    expect(screen.getByRole('button', { name: 'Submit for approval' })).toBeInTheDocument();
    const user = userEvent.setup();
    await user.keyboard('{Escape}');
    expect(onOpenChange).toHaveBeenCalledWith(false);
    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(onOpenChange).toHaveBeenCalledTimes(2);
  });
});
