import { describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MODULE_CODES } from '@hms/shared';
import { errorBody, makeSession } from '../../test/fixtures.js';
import { mockApi, renderApp } from '../../test/renderApp.jsx';

vi.setConfig({ testTimeout: 30_000 });

const DAY = 86_400_000;
const sub = (over = {}) => ({
  status: 'TRIAL',
  trialEndsAt: new Date(Date.now() + 5 * DAY - 60_000).toISOString(),
  plan: 'HOSPITAL',
  planName: 'Hospital',
  cycle: 'MONTHLY',
  converted: false,
  addOns: [],
  modules: MODULE_CODES.filter((c) => c !== 'CORE' && c !== 'CRM').map((code) => ({
    code,
    status: 'ACTIVE',
  })),
  limits: { users: 100, branches: 3, beds: 150 },
  usage: { users: 85, branches: 1, beds: 0 },
  currentPeriod: {},
  pending: [],
  invoices: [
    {
      id: 'f'.repeat(24),
      number: 'SAAS/26-27/000012',
      kind: 'PERIOD',
      period: { start: '2026-09-01T00:00:00.000Z', end: '2026-09-30T18:29:59.999Z' },
      subtotal: 3500000,
      gst: 630000,
      total: 4130000,
      status: 'PAID',
      issuedAt: '2026-09-01T00:00:00.000Z',
    },
  ],
  version: 0,
  ...over,
});

function setup(handlers = {}, { path = '/settings/subscription', session } = {}) {
  const fetchMock = mockApi({
    'GET /auth/me': () => [200, session ?? makeSession({ panel: 'superadmin' })],
    'GET /subscription': () => [200, sub()],
    ...handlers,
  });
  return { ...renderApp(path), fetchMock, user: userEvent.setup() };
}

describe('Subscription', () => {
  it('shows the trial days left, the plan, usage bars and invoices', async () => {
    setup();
    expect(await screen.findByText('Trial: days left 5.')).toBeVisible();
    const users = screen.getByRole('progressbar', { name: 'Users' });
    expect(users).toHaveAttribute('aria-valuenow', '85');
    expect(users).toHaveAttribute('aria-valuetext', '85 of 100');
    expect(screen.getByText(/85 of 100 · nearly full/)).toBeVisible();
    const row = screen.getByRole('row', { name: /SAAS\/26-27\/000012/ });
    expect(row).toHaveTextContent('₹41,300.00');
    expect(
      within(row).getByRole('button', { name: 'PDF of invoice SAAS/26-27/000012' }),
    ).toBeVisible();
  });

  it.each([
    ['PAST_DUE', 'Payment due.'],
    ['READ_ONLY', 'Read-only mode.'],
    ['SUSPENDED', 'Subscription suspended.'],
  ])('shows the %s banner', async (status, title) => {
    setup({ 'GET /subscription': () => [200, sub({ status, converted: true })] });
    expect(await screen.findByText(title)).toBeVisible();
  });

  it('prices a module change live, shows what blocks it, and applies it', async () => {
    const previews = [];
    let change;
    const { user } = setup({
      'POST /subscription/preview': (_r, b) => {
        previews.push(b);
        if (b.remove.includes('IPD'))
          return [
            200,
            {
              effective: {},
              chargeNow: { lines: [], subtotal: 0, gst: 0, total: 0 },
              nextInvoiceEstimate: null,
              blockedBy: [{ module: 'NUR', message: 'Nursing needs IPD and beds' }],
            },
          ];
        return [
          200,
          {
            effective: { add: 'ON_PAYMENT' },
            chargeNow: {
              lines: [
                {
                  item: 'MODULE:CRM',
                  description: 'Patient CRM (branch x 1), prorated',
                  amount: 133333,
                },
              ],
              subtotal: 133333,
              gst: 24000,
              total: 157333,
            },
            nextInvoiceEstimate: { total: 4366000 },
            blockedBy: [],
          },
        ];
      },
      'POST /subscription/changes': (_r, b) => {
        change = b;
        return [
          200,
          {
            invoice: { id: 'i1', number: 'SAAS/26-27/000013', total: 157333 },
            subscription: sub(),
          },
        ];
      },
    });
    await user.click(await screen.findByLabelText(/^IPD and beds/));
    expect(await screen.findByText('Nursing needs IPD and beds')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Confirm change' })).toBeDisabled();
    await user.click(screen.getByLabelText(/^IPD and beds/));
    await user.click(screen.getByLabelText(/^Patient CRM/));
    const confirm = await screen.findByRole('button', { name: 'Confirm and pay ₹1,573.33' });
    expect(screen.getByText('Patient CRM (branch x 1), prorated')).toBeVisible();
    expect(screen.getByText('₹43,660.00')).toBeVisible();
    await user.click(confirm);
    expect(await screen.findByText('Invoice SAAS/26-27/000013 issued.')).toBeVisible();
    expect(change).toEqual({ add: ['CRM'], remove: [] });
    expect(previews.at(-1)).toEqual({ add: ['CRM'], remove: [] });
  });

  it('converts the trial: plan, cycle and quantities priced from the price book', async () => {
    let body;
    const { user } = setup({
      'POST /subscription/convert': (_r, b) => (
        (body = b),
        [
          201,
          {
            id: 'i2',
            number: 'SAAS/26-27/000014',
            total: 41300000,
            dueAt: '2026-10-17T00:00:00.000Z',
          },
        ]
      ),
    });
    await user.click((await screen.findAllByRole('button', { name: 'Choose a plan' }))[0]);
    const sheet = await screen.findByRole('dialog', { name: 'Choose your plan' });
    await user.click(within(sheet).getByLabelText(/Annual billing/));
    // Hospital ₹35,000 x 10 months + 18% GST.
    expect(within(sheet).getByText('₹4,13,000.00')).toBeVisible();
    await user.click(within(sheet).getByRole('button', { name: 'Issue invoice for ₹4,13,000' }));
    expect(await screen.findByText('Invoice SAAS/26-27/000014 issued.')).toBeVisible();
    expect(body).toEqual({
      plan: 'HOSPITAL',
      cycle: 'ANNUAL',
      quantities: { branches: 1, beds: 0, entities: 1, users: 85 },
    });
  });

  it('is read-only without settings:subscription:update', async () => {
    setup(
      {},
      {
        session: makeSession({ panel: 'superadmin', permissions: ['settings:subscription:read'] }),
      },
    );
    expect(await screen.findByLabelText(/^Patient CRM/)).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Choose a plan' })).toBeNull();
  });
});

describe('Suspended hospital', () => {
  const suspended = (panel) => {
    const s = makeSession({ panel });
    return { ...s, tenant: { ...s.tenant, status: 'SUSPENDED' } };
  };

  it('sends the Super Admin to Subscription and lists only it in the menu', async () => {
    const { router } = setup({}, { path: '/billing', session: suspended('superadmin') });
    await waitFor(() => expect(router.state.location.pathname).toBe('/settings/subscription'));
    const nav = await screen.findByRole('navigation', { name: 'Main menu' });
    expect(
      within(nav)
        .getAllByRole('link')
        .map((a) => a.textContent),
    ).toEqual(['Subscription']);
  });

  it('shows staff a suspended notice', async () => {
    const { router } = setup({}, { path: '/home', session: suspended('nurse') });
    expect(
      await screen.findByRole('heading', {
        name: 'The subscription of Test Hospital is suspended',
      }),
    ).toBeVisible();
    expect(router.state.location.pathname).toBe('/suspended');
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeVisible();
  });

  it('links a 402 read-only error to Subscription', async () => {
    const s = makeSession({ panel: 'superadmin' });
    const { user } = setup(
      {
        'GET /subscription': () => [200, sub({ status: 'READ_ONLY', converted: true })],
        'POST /subscription/preview': () => [
          402,
          errorBody('TENANT_READ_ONLY', 'Read-only mode: new records are paused'),
        ],
      },
      { session: { ...s, tenant: { ...s.tenant, status: 'READ_ONLY' } } },
    );
    expect(
      await screen.findByText('Read-only mode.', { selector: 'strong' }, { timeout: 5000 }),
    ).toBeInTheDocument();
    await user.click(await screen.findByLabelText(/^Patient CRM/));
    expect(await screen.findByText('Read-only mode: nothing new can be saved.')).toBeVisible();
  });
});
