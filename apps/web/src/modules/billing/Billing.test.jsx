import { describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PANELS } from '@hms/shared/catalog';
import { ROLE_GRANTS, systemRolePermissions } from '@hms/shared';
import { errorBody, makeSession } from '../../test/fixtures.js';
import { mockApi, renderApp } from '../../test/renderApp.jsx';
import { canOpen, menuFor } from '../../app/access.js';
import { countedCash, estimate, priceListFor, rateFor, shiftVariances } from './billing.js';

vi.setConfig({ testTimeout: 30_000 });

const PID = 'a'.repeat(24);
const BILL = 'b'.repeat(24);
const SHIFT = 'c'.repeat(24);
const LISTS = [
  { id: 'l1', code: 'GENERAL', name: 'General', kind: 'GENERAL', isDefault: true, isActive: true },
  {
    id: 'l2',
    code: 'SENIOR',
    name: 'Senior citizen',
    kind: 'SENIOR',
    isDefault: false,
    isActive: true,
  },
];
const TAXES = [
  { id: 't0', code: 'EXEMPT', rate: 0, isActive: true },
  { id: 't5', code: 'GST5', rate: 5, isActive: true },
];
const SERVICES = [
  {
    id: 'e1e1e1e1e1e1e1e1e1e1e1e1',
    code: 'CONS-GEN',
    name: 'General consultation',
    taxCodeId: 't0',
    status: 'ACTIVE',
    isActive: true,
    rates: [
      { priceListId: 'l1', amount: 50000 },
      { priceListId: 'l2', amount: 40000 },
    ],
  },
  {
    id: 'e2e2e2e2e2e2e2e2e2e2e2e2',
    code: 'MEAL-ATT',
    name: 'Attendant meal',
    taxCodeId: 't5',
    status: 'ACTIVE',
    isActive: true,
    rates: [{ priceListId: 'l1', amount: 15050 }],
  },
];
const PATIENT = {
  id: PID,
  uhid: 'CC0000123',
  name: { first: 'Ravi', last: 'Kumar', full: 'Ravi Kumar' },
  gender: 'M',
  dob: '1979-04-10T00:00:00.000Z',
  age: '47Y',
  mobile: '9876543210',
  allergies: [],
  noKnownAllergies: true,
  flags: {},
  category: 'GENERAL',
  status: 'ACTIVE',
  version: 1,
};
const CARD = {
  id: PID,
  uhid: 'CC0000123',
  name: 'Ravi Kumar',
  gender: 'M',
  age: '47Y',
  mobile: '9876543210',
};
const line = (o) => ({
  discount: 0,
  cgst: 0,
  sgst: 0,
  taxRate: 0,
  ...o,
  taxable: o.gross,
  net: o.gross,
});
const finalBill = (over = {}) => ({
  id: BILL,
  billNo: 'OP/26-27/000154',
  type: 'OP',
  status: 'FINAL',
  patient: { id: PID, uhid: 'CC0000123', name: 'Ravi Kumar', age: '47Y', gender: 'M' },
  payer: { kind: 'CASH', priceListCode: 'GENERAL' },
  lines: [
    line({
      id: 'x1',
      serviceId: 'e1e1e1e1e1e1e1e1e1e1e1e1',
      code: 'CONS-GEN',
      name: 'General consultation',
      qty: 1,
      unitPrice: 50000,
      gross: 50000,
    }),
  ],
  totals: {
    gross: 50000,
    discount: 0,
    taxable: 50000,
    cgst: 0,
    sgst: 0,
    tax: 0,
    net: 50000,
    roundOff: 0,
    total: 50000,
    paid: 0,
    refunded: 0,
    balance: 50000,
  },
  printCount: 0,
  finalizedAt: '2026-10-10T05:00:00.000Z',
  version: 2,
  ...over,
});
const SHIFT_OPEN = {
  id: SHIFT,
  counter: 'C1',
  openedAt: '2026-10-10T02:30:00.000Z',
  openingCash: 500000,
  status: 'OPEN',
  expected: { CASH: 600000, UPI: 120000 },
  version: 0,
};
const MODES = [
  { code: 'CASH', name: 'Cash', kind: 'CASH', isActive: true, requiresReference: false },
  { code: 'UPI', name: 'UPI', kind: 'UPI', isActive: true, requiresReference: true },
];

function cashierSession() {
  return makeSession({ panel: 'cashier', permissions: systemRolePermissions('cashier') });
}

function setup(handlers = {}, path = '/billing', session = cashierSession()) {
  const fetchMock = mockApi({
    'GET /auth/me': () => [200, session],
    'GET /billing/shifts/current': () => [200, SHIFT_OPEN],
    'GET /masters/price-lists': () => [200, { items: LISTS, total: 2 }],
    'GET /masters/tax-codes': () => [200, { items: TAXES, total: 2 }],
    'GET /masters/payment-modes': () => [200, { items: MODES, total: 2 }],
    'GET /masters/services': () => [200, { items: SERVICES, total: 2 }],
    'GET /patients': () => [200, { items: [CARD], total: 1 }],
    [`GET /patients/${PID}`]: () => [200, PATIENT],
    'GET /billing/bills': () => [200, { items: [finalBill()], page: 1, limit: 25, total: 1 }],
    [`GET /billing/bills/${BILL}`]: () => [200, finalBill()],
    'GET /billing/payments': () => [200, { items: [], total: 0 }],
    'GET /billing/deposits': () => [200, { items: [], total: 0 }],
    'GET /billing/refunds': () => [200, { items: [], total: 0 }],
    'GET /billing/shifts': () => [200, { items: [], total: 0 }],
    ...handlers,
  });
  return { ...renderApp(path), fetchMock, user: userEvent.setup() };
}

describe('billing helpers', () => {
  it('prices from the patient’s list, falling back to the default list', () => {
    const senior = priceListFor('SENIOR', LISTS);
    expect(senior.code).toBe('SENIOR');
    expect(rateFor(SERVICES[0], senior, LISTS).amount).toBe(40000);
    expect(rateFor(SERVICES[1], senior, LISTS)).toMatchObject({
      amount: 15050,
      list: { code: 'GENERAL' },
    });
    expect(priceListFor('CORPORATE', LISTS).code).toBe('GENERAL');
  });

  it('estimates GST on taxable lines and rounds the total to the rupee', () => {
    const e = estimate([
      { unitPrice: 50000, qty: 1, taxRate: 0 },
      { unitPrice: 15050, qty: 1, taxRate: 5 },
    ]);
    expect(e).toMatchObject({ gross: 65050, tax: 753, net: 65803, roundOff: -3, total: 65800 });
  });

  it('counts the drawer and flags a variance over ₹100', () => {
    const cash = countedCash({ 500: 12, 100: 9 });
    expect(cash).toBe(690000);
    const v = shiftVariances({ CASH: 700000, UPI: 120000 }, cash, { UPI: 120000 });
    expect(v.byMode).toEqual({ CASH: -10000, UPI: 0 });
    expect(v.needsReason).toBe(false);
    expect(shiftVariances({ CASH: 700000 }, 689000, {}).needsReason).toBe(true);
  });
});

describe('Billing access', () => {
  it('gives the cashier the counter and shift screens, but not shift verification', () => {
    const s = cashierSession();
    expect(canOpen('Billing', s)).toBe(true);
    expect(canOpen('BillShift', s)).toBe(true);
    const items = menuFor(s).flatMap((g) => g.items);
    expect(items.find((i) => i.screen === 'PatientProfile').route).toBe('/patients');
    expect(s.permissions).not.toContain('billing:shift:verify');
    expect(PANELS.cashier).toBeTruthy();
  });
});

describe('New bill', () => {
  it('adds services at the patient’s rate, estimates GST and saves a draft', async () => {
    let body;
    const { user, router } = setup(
      {
        'POST /billing/bills': (_r, b) => (
          (body = b),
          [201, { ...finalBill(), status: 'DRAFT', billNo: null }]
        ),
      },
      `/billing?tab=new&patient=${PID}`,
    );
    const banner = await screen.findByRole('region', { name: 'Patient: Ravi Kumar' });
    expect(banner).toHaveTextContent('No known allergies');
    await screen.findByText(/Price list: General/);
    await user.type(screen.getByPlaceholderText(/Consultation/), 'co');
    await user.click(await screen.findByRole('button', { name: /General consultation/ }));
    await user.type(screen.getByPlaceholderText(/Consultation/), 'me');
    await user.click(await screen.findByRole('button', { name: /Attendant meal/ }));
    await user.click(screen.getByLabelText('Quantity of Attendant meal'));
    await user.keyboard('2');
    const summary = screen.getByRole('heading', { name: 'Summary' }).closest('section');
    // ₹500 exempt + 2 × ₹150.50 at 5% (₹15.05): ₹816.05 rounds to ₹816.
    expect(summary).toHaveTextContent('₹801.00');
    expect(summary).toHaveTextContent('₹15.05');
    expect(summary).toHaveTextContent('-₹0.05');
    expect(summary).toHaveTextContent('₹816.00');
    await user.click(screen.getByRole('button', { name: 'Save draft bill' }));
    await waitFor(() => expect(router.state.location.pathname).toBe(`/billing/bills/${BILL}`));
    expect(body).toEqual({
      patientId: PID,
      type: 'OP',
      lines: [
        { serviceId: 'e1e1e1e1e1e1e1e1e1e1e1e1', qty: 1 },
        { serviceId: 'e2e2e2e2e2e2e2e2e2e2e2e2', qty: 2 },
      ],
    });
  });
});

describe('Bill', () => {
  it('takes a split payment in rupees with one Idempotency-Key per receipt', async () => {
    const calls = [];
    const { user } = setup(
      {
        'POST /billing/payments': (req, b) => {
          calls.push({ key: req.headers.get('Idempotency-Key'), body: b });
          return [
            201,
            {
              id: `p${calls.length}`,
              receiptNo: `RC/${calls.length}`,
              amount: Math.round(b.amount * 100),
              allocations: b.allocations,
            },
          ];
        },
      },
      `/billing/bills/${BILL}`,
    );
    const panel = (await screen.findByRole('heading', { name: 'Take payment' })).closest('section');
    const amount = within(panel).getByLabelText(/^Amount/);
    await user.clear(amount);
    await user.type(amount, '300');
    await user.click(within(panel).getByRole('button', { name: /Split payment/ }));
    const amounts = within(panel).getAllByLabelText(/^Amount/);
    expect(amounts[1]).toHaveValue('200');
    await user.click(within(panel).getByRole('button', { name: 'Take ₹500' }));
    expect(await within(panel).findByText('Enter the UPI reference.')).toBeVisible();
    await user.type(within(panel).getByLabelText(/^UTR/), 'UTR123456');
    await user.click(within(panel).getByRole('button', { name: 'Take ₹500' }));
    await screen.findByText('Received ₹500 (receipts: 2)');
    expect(calls.map((c) => c.body)).toEqual([
      { patientId: PID, mode: 'CASH', amount: 300, allocations: [{ billId: BILL, amount: 300 }] },
      {
        patientId: PID,
        mode: 'UPI',
        amount: 200,
        reference: 'UTR123456',
        allocations: [{ billId: BILL, amount: 200 }],
      },
    ]);
    expect(calls[0].key).toBeTruthy();
    expect(calls[0].key).not.toBe(calls[1].key);
  });

  it('reuses the Idempotency-Key on a retry and shows the section 269ST cash limit', async () => {
    const keys = [];
    const { user } = setup(
      {
        'POST /billing/payments': (req) => {
          keys.push(req.headers.get('Idempotency-Key'));
          return keys.length === 1
            ? [503, errorBody('UNAVAILABLE', 'Try again')]
            : [
                422,
                errorBody(
                  'CASH_LIMIT',
                  'Cash of ₹2,00,000 or more from one person in a day is not allowed (section 269ST).',
                ),
              ];
        },
      },
      `/billing/bills/${BILL}`,
    );
    const panel = (await screen.findByRole('heading', { name: 'Take payment' })).closest('section');
    await user.click(within(panel).getByRole('button', { name: 'Take ₹500' }));
    expect(await within(panel).findByRole('alert')).toHaveTextContent('Try again');
    await user.click(within(panel).getByRole('button', { name: 'Take ₹500' }));
    await within(panel).findByText('Cash limit (section 269ST).');
    const alert = within(panel).getByRole('alert');
    expect(alert).toHaveTextContent('Cash limit (section 269ST).');
    expect(alert).toHaveTextContent('section 269ST');
    expect(keys[0]).toBe(keys[1]);
  });

  it('sends a discount over 10% for approval (202) and holds the bill', async () => {
    let body;
    const { user } = setup(
      {
        [`POST /billing/bills/${BILL}/discount`]: (_r, b) => {
          body = b;
          return [
            202,
            {
              approvalId: 'd'.repeat(24),
              bill: finalBill({
                hold: 'DISCOUNT',
                discount: { kind: 'PERCENT', value: 20, amount: 10000, status: 'PENDING' },
              }),
            },
          ];
        },
      },
      `/billing/bills/${BILL}`,
    );
    await user.click(await screen.findByRole('button', { name: 'Ask for discount' }));
    const dialog = await screen.findByRole('dialog', { name: /Discount on OP/ });
    await user.type(within(dialog).getByLabelText(/^Discount \(%\)/), '20');
    expect(within(dialog).getByText(/₹100 off \(20% of ₹500/)).toBeVisible();
    expect(within(dialog).getByText(/then the Super Admin decide/)).toBeVisible();
    await user.type(within(dialog).getByLabelText(/^Reason/), 'Staff relative');
    await user.click(within(dialog).getByRole('button', { name: 'Send for approval' }));
    expect(
      await screen.findByText(/A discount of ₹100 on OP\/26-27\/000154 was sent for approval/),
    ).toBeVisible();
    expect(screen.getByText(/the Billing Manager and the Super Admin/)).toBeVisible();
    expect(body).toEqual({ version: 2, kind: 'PERCENT', value: 20, reason: 'Staff relative' });
  });

  it('asks for a reason before a reprint (DUPLICATE)', async () => {
    const { user } = setup(
      { [`GET /billing/bills/${BILL}`]: () => [200, finalBill({ printCount: 1 })] },
      `/billing/bills/${BILL}`,
    );
    await user.click(await screen.findByRole('button', { name: 'Print bill (A4)' }));
    const dialog = await screen.findByRole('dialog', { name: 'Bill OP/26-27/000154' });
    expect(within(dialog).getByText(/marked DUPLICATE/)).toBeVisible();
    await user.click(within(dialog).getByRole('button', { name: 'Reprint' }));
    expect(within(dialog).getByText('Give a reason (3 characters or more).')).toBeVisible();
  });
});

describe('Cashier shift', () => {
  it('opens a shift with the opening float in rupees', async () => {
    let body;
    const { user } = setup(
      {
        'GET /billing/shifts/current': () => [200, null],
        'POST /billing/shifts': (_r, b) => (
          (body = b),
          [201, { ...SHIFT_OPEN, counter: b.counter }]
        ),
      },
      '/billing/shift',
    );
    await user.type(await screen.findByLabelText(/^Counter/), 'c1');
    await user.type(screen.getByLabelText(/^Opening float/), '5000.50');
    await user.click(screen.getByRole('button', { name: 'Open shift' }));
    await screen.findByText('Shift opened at counter C1');
    expect(body).toEqual({ counter: 'C1', openingCash: 5000.5 });
  });

  it('closes with the note count; a variance over ₹100 needs a reason', async () => {
    let body;
    const { user } = setup(
      {
        [`POST /billing/shifts/${SHIFT}/close`]: (_r, b) => (
          (body = b),
          [
            200,
            { ...SHIFT_OPEN, status: 'COUNTED', counted: { cash: 580000 }, cashVariance: -20000 },
          ]
        ),
      },
      '/billing/shift',
    );
    await user.type(await screen.findByLabelText('Number of ₹500 notes or coins'), '11');
    await user.type(screen.getByLabelText('Number of ₹100 notes or coins'), '3');
    expect(screen.getByText('Counted cash').closest('tr')).toHaveTextContent('₹5,800.00');
    expect(screen.getByText('Cash variance').closest('tr')).toHaveTextContent('-₹200.00 (short)');
    await user.click(screen.getByRole('button', { name: 'Close shift' }));
    expect(await screen.findByText('Explain the difference before closing.')).toBeVisible();
    await user.type(screen.getByLabelText(/^Reason for the variance/), 'Change given short');
    await user.click(screen.getByRole('button', { name: 'Close shift' }));
    await screen.findByText('Shift closed. Sent to the Billing Manager for verification.');
    expect(body).toEqual({
      version: 0,
      notes: { 500: 11, 100: 3 },
      nonCash: { UPI: 1200 },
      varianceReason: 'Change given short',
    });
  });

  it('lets the Billing Manager verify a counted shift', async () => {
    let body;
    const session = makeSession({
      panel: 'billingmgr',
      permissions: [...PANELS.billingmgr.permissions, ...ROLE_GRANTS.billingmgr],
    });
    const counted = {
      ...SHIFT_OPEN,
      userName: 'Neha Kulkarni',
      status: 'COUNTED',
      closedAt: '2026-10-10T10:30:00.000Z',
      counted: { cash: 580000 },
      cashVariance: -20000,
      varianceReason: 'Change short',
      version: 1,
    };
    const { user } = setup(
      {
        'GET /billing/shifts': () => [200, { items: [counted], total: 1 }],
        [`POST /billing/shifts/${SHIFT}/verify`]: (_r, b) => (
          (body = b),
          [200, { ...counted, status: 'VERIFIED' }]
        ),
      },
      '/billing/shift?tab=verify',
      session,
    );
    const row = await screen.findByRole('row', { name: /Neha Kulkarni/ });
    expect(row).toHaveTextContent('Waiting for verification');
    await user.click(within(row).getByRole('button', { name: 'Verify' }));
    const dialog = await screen.findByRole('dialog', { name: /Verify the shift of Neha Kulkarni/ });
    await user.type(within(dialog).getByLabelText(/^Comment/), 'Checked register');
    await user.click(within(dialog).getByRole('button', { name: 'Mark verified' }));
    await screen.findByText('Shift of Neha Kulkarni verified');
    expect(body).toEqual({ version: 1, comment: 'Checked register' });
  });
});
