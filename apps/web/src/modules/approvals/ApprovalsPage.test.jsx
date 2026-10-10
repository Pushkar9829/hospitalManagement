import { describe, expect, it } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { errorBody, makeSession } from '../../test/fixtures.js';
import { mockApi, renderApp } from '../../test/renderApp.jsx';

const ID = 'a'.repeat(24);
const inHours = (h) => new Date(Date.now() + h * 3_600_000).toISOString();

/** A two-level discount request: L1 approved, L2 (Super Admin) pending. */
const REQUEST = {
  id: ID,
  action: 'billing.discount',
  module: 'CORE',
  entity: 'Bill',
  entityId: 'b1',
  title: 'Bill discount 15%',
  before: { discountPercent: 0, net: '₹2,400' },
  after: { discountPercent: 15, net: '₹2,040' },
  reason: 'Patient is 74, pensioner.',
  status: 'PENDING',
  levelIndex: 1,
  levels: [
    {
      label: 'Billing Manager',
      permission: 'approvals:billing-discount:l1',
      decision: 'APPROVE',
      decidedBy: 'Neha Kulkarni',
      comment: 'Within policy',
      at: new Date().toISOString(),
    },
    { label: 'Super Admin', permission: 'approvals:billing-discount:l2' },
  ],
  makerId: 'maker-1',
  makerName: 'Sana Sheikh',
  expiresAt: inHours(41.5),
  createdAt: new Date().toISOString(),
  version: 4,
};

const page = (items) => ({ items, page: 1, limit: 20, total: items.length });

function setup(handlers = {}, { path = '/approvals', panel = 'superadmin', permissions } = {}) {
  const session = makeSession({ panel, ...(permissions ? { permissions } : {}) });
  const fetchMock = mockApi({
    'GET /auth/me': () => [200, session],
    'GET /approvals/count': () => [200, { inbox: 1 }],
    'GET /approvals': () => [200, page([REQUEST])],
    [`GET /approvals/${ID}`]: () => [200, REQUEST],
    ...handlers,
  });
  return { ...renderApp(path), fetchMock, user: userEvent.setup() };
}

/** Opens a request from the list (tablet layout: list first, then the detail). */
async function open(user) {
  await user.click(await screen.findByRole('button', { name: /Bill discount 15%/ }));
  return screen.findByRole('heading', { name: 'Bill discount 15%', level: 2 });
}

describe('Approvals inbox', () => {
  it('shows the approval path, what changes, the reason and the expiry', async () => {
    const { fetchMock, user } = setup();
    const detail = await open(user);
    const card = detail.closest('section');
    expect(within(card).getByText('Expires in 41 h')).toBeInTheDocument();
    const path = within(card).getByRole('list', { name: 'Approval path' });
    expect(path).toHaveTextContent('Maker · Sana Sheikh');
    expect(path).toHaveTextContent('L1 · Billing Manager approved');
    expect(within(path).getAllByRole('listitem')[2]).toHaveAttribute('aria-current', 'step');
    expect(path).toHaveTextContent('L2 · Super Admin pending');
    expect(card).toHaveTextContent('L1 approved by Neha Kulkarni');
    const table = within(card).getByRole('table', { name: 'What changes' });
    expect(within(table).getByRole('row', { name: /discountPercent/ })).toHaveTextContent(
      '015 (changed)',
    );
    expect(card).toHaveTextContent('Patient is 74, pensioner.');
    // The menu badge polls the count as background traffic.
    const nav = screen.getByRole('navigation', { name: 'Main menu' });
    expect(within(nav).getByRole('link', { name: /Approvals/ })).toHaveAccessibleName(
      'Approvals 1 waiting for your approval',
    );
    const [countReq] = fetchMock.mock.calls.find(([r]) => r.url.endsWith('/approvals/count'));
    expect(countReq.headers.get('x-background')).toBe('1');
  });

  it('needs a comment to reject, then sends the decision with the version', async () => {
    let body;
    const { user, fetchMock } = setup({
      [`POST /approvals/${ID}/decision`]: (_req, b) => (
        (body = b),
        [200, { ...REQUEST, status: 'REJECTED' }]
      ),
    });
    await open(user);
    await user.click(screen.getByRole('button', { name: 'Reject' }));
    const comment = screen.getByLabelText('Your comment (required to reject)');
    expect(comment).toHaveAccessibleDescription(/Give a reason for rejecting/);
    expect(comment).toHaveFocus();
    expect(body).toBeUndefined();
    await user.type(comment, 'Not eligible');
    await user.click(screen.getByRole('button', { name: 'Reject' }));
    await screen.findByText('Rejected: Bill discount 15%');
    expect(body).toEqual({ decision: 'REJECT', comment: 'Not eligible', version: 4 });
    const [req] = fetchMock.mock.calls.find(([r]) => r.url.endsWith('/decision'));
    expect(req.headers.get('Idempotency-Key')).toBeTruthy();
    // Decisions refetch the badge count.
    await waitFor(() =>
      expect(
        fetchMock.mock.calls.filter(([r]) => r.url.endsWith('/approvals/count')).length,
      ).toBeGreaterThan(1),
    );
  });

  it('explains MAKER_CANNOT_CHECK and APPROVAL_CLOSED', async () => {
    let answer = [403, errorBody('MAKER_CANNOT_CHECK', 'You cannot approve a request you raised')];
    const { user } = setup({ [`POST /approvals/${ID}/decision`]: () => answer });
    await open(user);
    await user.click(screen.getByRole('button', { name: 'Approve' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Not allowed. You cannot approve a request you raised',
    );
    answer = [409, errorBody('APPROVAL_CLOSED', 'This request has expired. Raise it again.')];
    await user.click(screen.getByRole('button', { name: 'Approve' }));
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(
        'This request has expired. Raise it again.',
      ),
    );
  });

  it('lets the maker withdraw from "Raised by me"', async () => {
    const mine = {
      ...REQUEST,
      makerId: 'u1',
      levels: [{ label: 'Super Admin', permission: 'x' }],
      levelIndex: 0,
    };
    let body;
    const { user, router } = setup(
      {
        'GET /approvals': (req) => [
          200,
          page(new URL(req.url).searchParams.get('box') === 'mine' ? [mine] : []),
        ],
        [`GET /approvals/${ID}`]: () => [200, mine],
        [`POST /approvals/${ID}/withdraw`]: (_req, b) => (
          (body = b),
          [200, { ...mine, status: 'WITHDRAWN' }]
        ),
      },
      { path: `/approvals?box=mine&id=${ID}` },
    );
    await screen.findByRole('heading', { name: 'Bill discount 15%', level: 2 });
    expect(screen.queryByRole('button', { name: 'Approve' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Withdraw request' }));
    const dialog = await screen.findByRole('alertdialog', {
      name: 'Withdraw “Bill discount 15%”?',
    });
    await user.click(within(dialog).getByRole('button', { name: 'Withdraw request' }));
    await screen.findByText('Request withdrawn: Bill discount 15%');
    expect(body).toEqual({ version: 4 });
    expect(router.state.location.search).toContain('box=mine');
  });

  it('shows "All requests" only with read-all, and an empty inbox', async () => {
    setup(
      {
        'GET /approvals': () => [200, page([])],
        'GET /approvals/count': () => [200, { inbox: 0 }],
      },
      { panel: 'admin', permissions: ['approvals:inbox:read'] },
    );
    expect(await screen.findByText('Nothing is waiting for you')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Raised by me' })).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'All requests' })).not.toBeInTheDocument();
  });
});
