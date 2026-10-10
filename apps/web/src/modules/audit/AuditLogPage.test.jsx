import { describe, expect, it } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { makeSession } from '../../test/fixtures.js';
import { mockApi, renderApp } from '../../test/renderApp.jsx';

const USER = '6ac9b2c1efc7dad5b1e7c8fc';
const ENTRY = {
  id: 'e1',
  action: 'APPROVE',
  entity: 'Department',
  entityId: 'd1',
  summary: 'Create department Nephrology (NEPH) (level 1 of 1: Super Admin)',
  userId: USER,
  userName: 'Dr. Arjun Rao',
  requestId: 'req-42',
  ip: '10.0.2.11',
  before: { status: 'PENDING_APPROVAL' },
  after: { status: 'ACTIVE', comment: 'ok' },
  at: '2026-10-10T05:16:21.000Z',
};

function setup(path = '/audit') {
  const fetchMock = mockApi({
    'GET /auth/me': () => [200, makeSession({ panel: 'auditor' })],
    'GET /audit': () => [200, { items: [ENTRY], page: 1, limit: 25, total: 1 }],
  });
  return { ...renderApp(path), fetchMock, user: userEvent.setup() };
}

const auditUrls = (fetchMock) =>
  fetchMock.mock.calls.map(([r]) => new URL(r.url)).filter((u) => u.pathname.endsWith('/audit'));

describe('Audit log', () => {
  it('filters by record, action, user id and IST date range, kept in the URL', async () => {
    const { user, fetchMock, router } = setup();
    await screen.findByRole('cell', { name: /Create department Nephrology/ });
    await user.type(screen.getByLabelText('Record type'), 'Department');
    await user.selectOptions(screen.getByLabelText('Action'), 'APPROVE');
    await user.type(screen.getByLabelText('User'), 'not-an-id');
    await user.click(screen.getByRole('button', { name: 'Search' }));
    expect(screen.getByLabelText('User')).toHaveAccessibleDescription(
      /A user ID has 24 characters/,
    );
    await user.clear(screen.getByLabelText('User'));
    await user.type(screen.getByLabelText('From'), '2026-10-10');
    await user.click(screen.getByRole('button', { name: 'Search' }));
    await waitFor(() => expect(router.state.location.search).toContain('entity=Department'));
    const last = auditUrls(fetchMock).at(-1).searchParams;
    expect(last.get('entity')).toBe('Department');
    expect(last.get('action')).toBe('APPROVE');
    expect(last.get('from')).toBe('2026-10-09T18:30:00.000Z');
  });

  it('filters by a user when their name is clicked, and shows the entry diff', async () => {
    const { user, fetchMock } = setup();
    await user.click(
      await screen.findByRole('button', { name: 'Show only entries by Dr. Arjun Rao' }),
    );
    await waitFor(() => expect(auditUrls(fetchMock).at(-1).searchParams.get('userId')).toBe(USER));
    await user.click(await screen.findByRole('cell', { name: /Create department Nephrology/ }));
    const detail = screen.getByRole('heading', { name: 'Entry detail' }).closest('section');
    const table = within(detail).getByRole('table', { name: 'Values before and after' });
    expect(within(table).getByRole('row', { name: /status/ })).toHaveTextContent(
      'PENDING_APPROVALACTIVE (changed)',
    );
    expect(detail).toHaveTextContent('req-42');
    expect(within(detail).getByText('Approve')).toBeInTheDocument();
  });
});
