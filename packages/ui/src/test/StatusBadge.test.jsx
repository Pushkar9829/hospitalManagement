import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BED_STATUS, BILL_STATUS } from '@hms/shared';
import { StatusBadge } from '../index.js';

describe('StatusBadge', () => {
  it('takes label and tone from a shared catalogue', () => {
    render(<StatusBadge catalogue={BILL_STATUS} code="PAID" />);
    const badge = screen.getByText('Paid').closest('[data-tone]');
    expect(badge).toHaveAttribute('data-tone', 'success');
    expect(badge).toHaveClass('bg-success-bg', 'text-success', 'text-sm', 'font-semibold');
  });

  it('never shows an occupied bed in the critical tone', () => {
    render(<StatusBadge catalogue={BED_STATUS} code="OCCUPIED" />);
    const badge = screen.getByText('Occupied').closest('[data-tone]');
    expect(badge).toHaveAttribute('data-tone', 'neutral');
    expect(badge.querySelector('svg')).toBeNull();
  });

  it('adds an icon to critical and warning so colour is not the only signal', () => {
    render(
      <>
        <StatusBadge tone="critical" label="Critical" />
        <StatusBadge tone="warning" label="Due" />
        <StatusBadge tone="info" label="Reserved" />
      </>,
    );
    expect(screen.getByText('Critical').closest('[data-tone]').querySelector('svg')).not.toBeNull();
    expect(screen.getByText('Due').closest('[data-tone]').querySelector('svg')).not.toBeNull();
    expect(screen.getByText('Reserved').closest('[data-tone]').querySelector('svg')).toBeNull();
    // The icon is decorative: the text carries the meaning for screen readers.
    expect(
      screen.getByText('Critical').closest('[data-tone]').querySelector('svg'),
    ).toHaveAttribute('aria-hidden', 'true');
  });

  it('falls back to the code in a neutral tone for an unknown status', () => {
    render(<StatusBadge catalogue={BILL_STATUS} code="MYSTERY" />);
    expect(screen.getByText('MYSTERY').closest('[data-tone]')).toHaveAttribute(
      'data-tone',
      'neutral',
    );
  });

  it('lets an explicit tone override the catalogue', () => {
    render(<StatusBadge catalogue={BILL_STATUS} code="DUE" tone="info" />);
    expect(screen.getByText('Due').closest('[data-tone]')).toHaveAttribute('data-tone', 'info');
  });
});
