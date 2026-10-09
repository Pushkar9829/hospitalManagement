import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConfirmDialog } from '../index.js';

function setup(props = {}) {
  const onConfirm = vi.fn();
  const onOpenChange = vi.fn();
  render(
    <ConfirmDialog
      open
      onOpenChange={onOpenChange}
      title="Cancel bill OP/26-27/000155?"
      description="This sends a cancellation request to the Billing Manager."
      confirmLabel="Request cancellation"
      cancelLabel="Keep bill"
      onConfirm={onConfirm}
      {...props}
    />,
  );
  return { onConfirm, onOpenChange, user: userEvent.setup() };
}

describe('ConfirmDialog', () => {
  it('names the object in the title and states the action on the button', () => {
    setup();
    expect(
      screen.getByRole('alertdialog', { name: 'Cancel bill OP/26-27/000155?' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Request cancellation' })).toBeInTheDocument();
  });

  it('requires a reason before confirming', async () => {
    const { onConfirm, user } = setup();
    await user.click(screen.getByRole('button', { name: 'Request cancellation' }));
    expect(onConfirm).not.toHaveBeenCalled();
    const reason = screen.getByRole('textbox', { name: /Reason/ });
    expect(reason).toHaveAttribute('aria-invalid', 'true');
    expect(reason).toHaveAccessibleDescription(/Enter a reason/);
    expect(reason).toHaveFocus();

    await user.type(reason, '   ');
    await user.click(screen.getByRole('button', { name: 'Request cancellation' }));
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('confirms with the trimmed reason and closes', async () => {
    const { onConfirm, onOpenChange, user } = setup();
    await user.type(screen.getByRole('textbox', { name: /Reason/ }), '  Duplicate bill ');
    await user.click(screen.getByRole('button', { name: 'Request cancellation' }));
    expect(onConfirm).toHaveBeenCalledWith('Duplicate bill');
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('stays open when the action fails', async () => {
    const { onOpenChange, user } = setup({
      onConfirm: vi.fn().mockRejectedValue(new Error('500')),
    });
    await user.type(screen.getByRole('textbox', { name: /Reason/ }), 'Wrong patient');
    await user.click(screen.getByRole('button', { name: 'Request cancellation' }));
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
    expect(screen.getByRole('textbox', { name: /Reason/ })).toHaveValue('Wrong patient');
  });

  it('uses a danger button for destructive actions', () => {
    setup();
    expect(screen.getByRole('button', { name: 'Request cancellation' })).toHaveClass('bg-danger');
  });
});
