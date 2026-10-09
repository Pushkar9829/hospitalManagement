import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CriticalAlert } from '../index.js';

describe('CriticalAlert', () => {
  it('stays as an alert with no close button until acknowledged', () => {
    render(<CriticalAlert title="Platelets 38,000" patient="F. Ali" onAcknowledge={() => {}} />);
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Platelets 38,000');
    expect(screen.queryByRole('button', { name: /close|dismiss/i })).toBeNull();
    expect(screen.getByRole('button', { name: 'Acknowledge' })).toBeInTheDocument();
  });

  it('shows who acknowledged it and when', async () => {
    const at = '2026-10-09T05:12:00Z'; // 10:42 IST
    const onAcknowledge = vi.fn().mockResolvedValue({ by: 'Dr Meera Iyer', at });
    const user = userEvent.setup();
    render(<CriticalAlert title="Platelets 38,000" onAcknowledge={onAcknowledge} />);
    await user.click(screen.getByRole('button', { name: 'Acknowledge' }));
    expect(onAcknowledge).toHaveBeenCalledTimes(1);
    expect(await screen.findByText('Acknowledged by Dr Meera Iyer at 10:42')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Acknowledge' })).toBeNull();
  });

  it('stays unacknowledged when the call fails', async () => {
    const onAcknowledge = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<CriticalAlert title="K+ 6.8" onAcknowledge={onAcknowledge} />);
    await user.click(screen.getByRole('button', { name: 'Acknowledge' }));
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('can be controlled', () => {
    render(
      <CriticalAlert
        title="K+ 6.8"
        acknowledged={{ by: 'Sr. Anjali', at: '2026-10-09T04:30:00Z' }}
      />,
    );
    expect(screen.getByText('Acknowledged by Sr. Anjali at 10:00')).toBeInTheDocument();
  });
});
