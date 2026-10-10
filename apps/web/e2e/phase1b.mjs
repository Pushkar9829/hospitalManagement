/* global document */
/**
 * Smoke steps for the Phase 1 patient, billing, subscription and public signup screens, run by
 * smoke.mjs. `kit` carries the runner's helpers (newPage, realPage, shot, signIn, signInAs,
 * approveInInbox, noHorizontalScroll, assert, log, ORIGIN, PORT, RUN, session).
 */
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { request } from 'node:http';
import { MODULE_CODES, PRICE_BOOK, systemRolePermissions } from '@hms/shared';

const PID = '6a0000000000000000000001';
const BID = '6a0000000000000000000002';
const SVC = '6a0000000000000000000003';

/** A one-page PDF, enough for the preview frame. */
function tinyPdf(text) {
  const stream = `BT /F1 18 Tf 40 760 Td (${text}) Tj ET`;
  const objs = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  let out = '%PDF-1.4\n';
  const offsets = [];
  objs.forEach((o, i) => {
    offsets.push(out.length);
    out += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = out.length;
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offsets
    .map((o) => `${String(o).padStart(10, '0')} 00000 n \n`)
    .join('')}trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(out);
}

// ---------------------------------------------------------------------------------------------
// Fixtures

const PATIENT = {
  id: PID,
  uhid: 'CC0000123',
  name: { first: 'Ravi', last: 'Kumar', full: 'Ravi Kumar' },
  gender: 'M',
  dob: '1961-04-10T00:00:00.000Z',
  dobEstimated: true,
  age: '65Y',
  bloodGroup: 'B+',
  mobile: '9876543210',
  ids: [{ type: 'AADHAAR', number: 'XXXX XXXX 4321' }],
  allergies: [{ substance: 'Penicillin', severity: 'SEVERE' }],
  noKnownAllergies: false,
  chronicConditions: ['Hypertension'],
  flags: { vip: false, mlc: false },
  category: 'SENIOR',
  preferredLanguage: 'hi',
  registrationType: 'FULL',
  toComplete: [],
  status: 'ACTIVE',
  registeredAt: '2026-09-24T05:00:00.000Z',
  version: 2,
};
const CARD = {
  id: PID,
  uhid: 'CC0000123',
  name: 'Ravi Kumar',
  gender: 'M',
  age: '65Y',
  mobile: '9876543210',
  allergies: ['Penicillin'],
  flags: {},
  status: 'ACTIVE',
};
const LISTS = [
  { id: 'l1', code: 'GENERAL', name: 'General', kind: 'GENERAL', isDefault: true, isActive: true },
  { id: 'l2', code: 'SENIOR', name: 'Senior citizen', kind: 'SENIOR', isActive: true },
];
const SERVICES = [
  {
    id: SVC,
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
];
const line = {
  id: 'x1',
  serviceId: SVC,
  code: 'CONS-GEN',
  name: 'General consultation',
  qty: 1,
  unitPrice: 40000,
  gross: 40000,
  discount: 0,
  taxable: 40000,
  taxRate: 0,
  cgst: 0,
  sgst: 0,
  net: 40000,
};
const totals = (paid = 0) => ({
  gross: 40000,
  discount: 0,
  taxable: 40000,
  cgst: 0,
  sgst: 0,
  tax: 0,
  net: 40000,
  roundOff: 0,
  total: 40000,
  paid,
  refunded: 0,
  balance: 40000 - paid,
});
const billOf = (status, paid = 0, version = 0) => ({
  id: BID,
  billNo: status === 'DRAFT' ? null : 'OP/26-27/000154',
  type: 'OP',
  status,
  patient: { id: PID, uhid: 'CC0000123', name: 'Ravi Kumar', age: '65Y', gender: 'M' },
  payer: { kind: 'CASH', priceListCode: 'SENIOR' },
  lines: [line],
  totals: totals(paid),
  printCount: 0,
  createdAt: '2026-10-10T05:00:00.000Z',
  finalizedAt: status === 'DRAFT' ? undefined : '2026-10-10T05:01:00.000Z',
  version,
});
const SUB = {
  status: 'TRIAL',
  trialEndsAt: new Date(Date.now() + 9 * 86_400_000).toISOString(),
  plan: 'HOSPITAL',
  planName: 'Hospital',
  cycle: 'MONTHLY',
  converted: false,
  addOns: [],
  modules: MODULE_CODES.filter((c) => !['CORE', 'CRM', 'QLT'].includes(c)).map((code) => ({
    code,
    status: 'ACTIVE',
  })),
  limits: { users: 100, branches: 3, beds: 150 },
  usage: { users: 87, branches: 1, beds: 40 },
  currentPeriod: {},
  pending: [],
  invoices: [],
  version: 0,
};

/** Stateful fixture handlers for the new screens. */
function fixtureHandlers() {
  const st = { bill: null, receipts: [], registerCalls: 0 };
  return {
    'GET /patients': () => [200, { items: [CARD], page: 1, limit: 20, total: 1 }],
    'POST /patients': (b) => {
      st.registerCalls += 1;
      if (!b.confirmNotDuplicate)
        return [
          409,
          {
            error: {
              code: 'POSSIBLE_DUPLICATE',
              message: 'Similar patients are already registered.',
              details: [{ path: 'patient', message: 'CC0000123', ...CARD, score: 0.93 }],
              requestId: 'smoke-dup',
            },
          },
        ];
      return [201, { ...PATIENT, id: '6a0000000000000000000009', uhid: 'CC0000124' }];
    },
    'GET /patients/:id': () => [200, PATIENT],
    'GET /patients/:id/timeline': () => [
      200,
      [{ at: '2026-09-24T05:00:00.000Z', type: 'REGISTERED', title: 'Registered as CC0000123' }],
    ],
    'GET /billing/shifts/current': () => [
      200,
      {
        id: '6a0000000000000000000005',
        counter: 'C1',
        openedAt: '2026-10-10T02:30:00.000Z',
        openingCash: 500000,
        status: 'OPEN',
        expected: { CASH: 500000 + st.receipts.reduce((s, r) => s + r.amount, 0) },
        version: 0,
      },
    ],
    'GET /masters/price-lists': () => [200, { items: LISTS, total: 2 }],
    'GET /masters/tax-codes': () => [200, { items: [{ id: 't0', code: 'EXEMPT', rate: 0 }] }],
    'GET /masters/payment-modes': () => [
      200,
      {
        items: [
          { code: 'CASH', name: 'Cash', kind: 'CASH', isActive: true },
          { code: 'UPI', name: 'UPI', kind: 'UPI', isActive: true, requiresReference: true },
        ],
      },
    ],
    'GET /masters/services': () => [200, { items: SERVICES, total: 1 }],
    'POST /billing/bills': () => ((st.bill = billOf('DRAFT')), [201, st.bill]),
    'GET /billing/bills': () => [200, { items: st.bill ? [st.bill] : [], total: st.bill ? 1 : 0 }],
    'GET /billing/bills/:id': () => [200, st.bill ?? billOf('FINAL', 0, 1)],
    'POST /billing/bills/:id/finalize': () => ((st.bill = billOf('FINAL', 0, 1)), [200, st.bill]),
    'POST /billing/payments': (b) => {
      const amount = Math.round(b.amount * 100);
      const r = {
        id: `6a00000000000000000001${st.receipts.length}0`,
        receiptNo: `RC/26-27/00045${st.receipts.length}`,
        mode: b.mode,
        amount,
        allocations: [{ billId: BID, amount }],
        status: 'CAPTURED',
        createdAt: new Date().toISOString(),
        printCount: 0,
      };
      st.receipts.push(r);
      st.bill = billOf(amount >= 40000 ? 'PAID' : 'PARTLY_PAID', amount, 2);
      return [201, r];
    },
    'GET /billing/payments': () => [200, { items: st.receipts, total: st.receipts.length }],
    'GET /billing/payments/:id/pdf': () => [200, tinyPdf('Receipt RC/26-27/000450 (80 mm)')],
    'GET /billing/bills/:id/pdf': () => [200, tinyPdf('Bill OP/26-27/000154')],
    'GET /billing/deposits': () => [200, { items: [], total: 0 }],
    'GET /billing/refunds': () => [200, { items: [], total: 0 }],
    'GET /subscription': () => [200, SUB],
    'POST /subscription/preview': (b) => [
      200,
      {
        effective: { add: 'IMMEDIATE (trial)', remove: 'IMMEDIATE (trial)' },
        chargeNow: { lines: [], subtotal: 0, gst: 0, total: 0 },
        nextInvoiceEstimate: null,
        blockedBy: b.remove?.includes('IPD')
          ? [{ module: 'NUR', message: 'Nursing needs IPD and beds' }]
          : [],
      },
    ],
    'GET /api/public/plans': () => [
      200,
      {
        version: 1,
        currency: 'INR',
        gstRate: 18,
        annualMonthsCharged: 10,
        trialDays: 14,
        plans: PRICE_BOOK.plans,
        modules: PRICE_BOOK.modules,
      },
    ],
    'GET /api/public/subdomains/sunrise-care-hospital': () => [200, { available: true }],
    'POST /api/public/signup/otp': () => [202, { expiresInSec: 300 }],
  };
}

export async function phase1bFixtureSteps(browser, step, kit) {
  const { newPage, shot, assert, noHorizontalScroll, signIn, ORIGIN, PORT, session } = kit;
  const users = {
    cashier: session({
      panel: 'cashier',
      name: 'Neha Kulkarni',
      username: 'cashier',
      designation: 'Cashier · Counter 1',
      modules: ['OPD', 'IPD'],
      permissions: systemRolePermissions('cashier'),
    }),
    frontoffice: session({
      panel: 'frontoffice',
      name: 'Anita Sharma',
      username: 'frontoffice',
      designation: 'Front Office Executive',
      modules: ['OPD', 'IPD'],
      permissions: systemRolePermissions('frontoffice'),
    }),
    superadmin: session({
      panel: 'superadmin',
      name: 'Dr. Arjun Rao',
      username: 'superadmin',
      designation: 'Hospital Super Admin',
      modules: SUB.modules.map((m) => m.code),
    }),
  };

  await step('front office: search, registration with a duplicate warning, profile', async () => {
    const { page, errors, context } = await newPage(
      browser,
      { width: 1440, height: 900 },
      users,
      fixtureHandlers(),
    );
    await signIn(page, 'frontoffice');
    await page.getByRole('heading', { name: /Anita/ }).waitFor();
    await page.goto(`${ORIGIN}/patients?q=9876`);
    await page.getByRole('row', { name: /Ravi Kumar/ }).waitFor();
    await shot(page, 'p1b-patient-search');
    await page.goto(`${ORIGIN}/patients/new?type=quick`);
    await page.getByLabel(/^First name/).fill('Ravi');
    await page.getByLabel(/^Last name/).fill('Kumaar');
    await page.getByLabel('Male', { exact: true }).check();
    await page.getByLabel('Years').fill('65');
    await page.getByLabel(/^Mobile/).fill('9876543210');
    await page.getByText('Senior citizen (60+)').waitFor();
    await page.getByRole('button', { name: 'Register', exact: true }).click();
    await page.getByText('Possible duplicate: similar patients found (1).').waitFor();
    await page.getByText('Match 93%').waitFor();
    await page.evaluate(() => document.fonts.ready);
    await shot(page, 'p1b-patient-duplicate');
    await page.getByRole('button', { name: /register anyway/ }).click();
    await page.getByRole('heading', { name: 'Ravi Kumar', level: 1 }).waitFor();
    await page.getByText('Registered with UHID CC0000124', { exact: true }).waitFor();
    await shot(page, 'p1b-patient-profile');
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto(`${ORIGIN}/patients/new`);
    await page.getByLabel(/^First name/).waitFor();
    await noHorizontalScroll(page, 'registration 768');
    await shot(page, 'p1b-patient-register-768', { fullPage: true });
    assert(errors.length === 0, `no page errors: ${errors.join(' | ')}`);
    await context.close();
  });

  await step('cashier: OPD bill, cash payment, 80 mm receipt preview', async () => {
    const { page, errors, context } = await newPage(
      browser,
      { width: 1440, height: 900 },
      users,
      fixtureHandlers(),
    );
    await signIn(page, 'cashier');
    await page.getByRole('heading', { name: /Neha/ }).waitFor();
    const nav = page.getByRole('navigation', { name: 'Main menu' });
    await nav
      .getByRole('link', { name: /Billing/ })
      .first()
      .waitFor();
    await page.goto(`${ORIGIN}/billing?tab=new&patient=${PID}`);
    await page.getByText(/Price list: Senior citizen/).waitFor();
    await page.getByPlaceholder(/Consultation/).fill('con');
    await page.getByRole('button', { name: /General consultation/ }).click();
    await page.getByText('Estimated total').waitFor();
    await shot(page, 'p1b-bill-new');
    await page.getByRole('button', { name: 'Save draft bill' }).click();
    await page.getByRole('heading', { name: 'Draft bill' }).waitFor();
    await page.getByRole('button', { name: 'Finalise bill' }).click();
    await page.getByRole('heading', { name: 'Bill OP/26-27/000154' }).waitFor();
    await page.getByRole('button', { name: 'Take ₹400' }).click();
    await page
      .getByText(/Received ₹400/)
      .first()
      .waitFor();
    await page.getByRole('button', { name: /Receipt \(80 mm\)/ }).click();
    await page
      .getByRole('dialog', { name: /Receipt RC/ })
      .locator('iframe')
      .waitFor();
    await shot(page, 'p1b-receipt-preview');
    await page.keyboard.press('Escape');
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto(`${ORIGIN}/billing/shift`);
    await page.getByRole('heading', { name: 'Cash count by note' }).waitFor();
    await noHorizontalScroll(page, 'shift 768');
    await shot(page, 'p1b-shift-768', { fullPage: true });
    assert(errors.length === 0, `no page errors: ${errors.join(' | ')}`);
    await context.close();
  });

  await step('super admin: subscription page with a live module preview', async () => {
    const { page, errors, context } = await newPage(
      browser,
      { width: 1440, height: 900 },
      users,
      fixtureHandlers(),
    );
    await signIn(page, 'superadmin');
    await page.getByRole('heading', { name: /Arjun/ }).waitFor();
    await page.goto(`${ORIGIN}/settings/subscription`);
    await page.getByText('Trial: days left 9.').waitFor();
    await page.getByLabel(/^IPD and beds/).uncheck();
    await page.getByText('Nursing needs IPD and beds').waitFor();
    await page.evaluate(() => document.fonts.ready);
    await shot(page, 'p1b-subscription', { fullPage: true });
    assert(errors.length === 0, `no page errors: ${errors.join(' | ')}`);
    await context.close();
  });

  await step('public: pricing and signup on the marketing host', async () => {
    const { page, errors, context } = await newPage(
      browser,
      { width: 1440, height: 900 },
      {},
      fixtureHandlers(),
    );
    await page.goto(`http://localhost:${PORT}/`);
    await page.waitForURL(`http://localhost:${PORT}/pricing`);
    await page
      .getByRole('heading', { name: 'Run your clinic or hospital on one system' })
      .waitFor();
    await page.evaluate(() => document.fonts.ready);
    await shot(page, 'p1b-pricing', { fullPage: true });
    await page.getByRole('link', { name: 'Start 14-day trial' }).nth(1).click();
    await page.getByLabel(/^Hospital or clinic name/).fill('Sunrise Care Hospital');
    await page.getByLabel(/^City/).fill('Pune');
    await page.getByText('Available').waitFor();
    await page.getByRole('button', { name: 'Continue' }).click();
    await page.getByLabel(/^Mobile number/).fill('9876500123');
    await page.getByRole('button', { name: 'Send code' }).click();
    await page.getByText(/We sent a 6-digit code/).waitFor();
    await shot(page, 'p1b-signup-otp');
    await page.setViewportSize({ width: 768, height: 1024 });
    await noHorizontalScroll(page, 'signup 768');
    assert(errors.length === 0, `no page errors: ${errors.join(' | ')}`);
    await context.close();
  });
}

// ---------------------------------------------------------------------------------------------
// Real API

/**
 * Direct API calls through the preview proxy as the demo hospital, with cookies. node:http, not
 * fetch: fetch drops a Host header, and the API finds the hospital from the Host.
 */
function apiClient(PORT) {
  return (method, path, { body, cookie } = {}) =>
    new Promise((resolveCall, reject) => {
      const data = body ? JSON.stringify(body) : null;
      const req = request(
        {
          host: '127.0.0.1',
          port: PORT,
          path: `/api/v1${path}`,
          method,
          headers: {
            Host: `demo.localhost:${PORT}`,
            'Content-Type': 'application/json',
            'Idempotency-Key': randomUUID(),
            ...(cookie ? { Cookie: cookie } : {}),
            ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
          },
        },
        (res) => {
          let text = '';
          res.on('data', (c) => (text += c));
          res.on('end', () => {
            let json = null;
            try {
              json = JSON.parse(text);
            } catch {
              /* not JSON */
            }
            const set = res.headers['set-cookie'] ?? [];
            resolveCall({
              status: res.statusCode,
              json,
              cookie: set.map((c) => c.split(';')[0]).join('; '),
            });
          });
        },
      );
      req.on('error', reject);
      if (data) req.write(data);
      req.end();
    });
}

/** A billable service for the journeys: created by admin, approved by the super admin, once. */
async function ensureService(PORT, code, name) {
  const call = apiClient(PORT);
  const login = async (username) =>
    (await call('POST', '/auth/login', { body: { username, password: 'Demo@12345' } })).cookie;
  const admin = await login('admin');
  const found = await call('GET', `/masters/services?q=${code}`, { cookie: admin });
  if (found.json?.items?.some((s) => s.code === code && s.status === 'ACTIVE')) return;
  const created = await call('POST', '/masters/services', {
    cookie: admin,
    body: {
      code,
      name,
      category: 'CONSULTATION',
      taxCode: 'EXEMPT',
      rates: { GENERAL: 500 },
      reason: 'Smoke test tariff',
    },
  });
  const approvalId = created.json?.approvalId;
  if (!approvalId) return;
  const sa = await login('superadmin');
  const req = await call('GET', `/approvals/${approvalId}`, { cookie: sa });
  await call('POST', `/approvals/${approvalId}/decision`, {
    cookie: sa,
    body: { decision: 'APPROVE', version: req.json.version },
  });
}

/** The newest 6-digit SMS code the console SMS provider logged for a mobile. */
function smsCodeFor(mobile) {
  const file = process.env.SMOKE_API_LOG;
  if (!file) return null;
  const lines = readFileSync(file, 'utf8')
    .split('\n')
    .filter((l) => l.includes('SMS (console provider)'));
  for (const l of lines.reverse()) {
    if (l.includes(`******${mobile.slice(-4)}`)) return l.match(/"text":"(\d{6})/)?.[1] ?? null;
  }
  return null;
}

export async function phase1bRealSteps(browser, step, kit) {
  const {
    realPage,
    shot,
    assert,
    noHorizontalScroll,
    signInAs,
    approveInInbox,
    ORIGIN,
    PORT,
    RUN,
    log,
  } = kit;
  const mobile = `9${String(Date.now()).slice(-9)}`;
  // Unique first name per run: earlier smoke patients must not look like duplicates.
  const first = `Smk${RUN}`;
  const last = 'Patient';
  const full = `${first} ${last}`;
  const service = { code: `SMK${RUN}`.slice(0, 16), name: `Smoke consultation ${RUN}` };
  const ctx = { uhid: null, counter: null, discountBill: null };

  await step('real API: front office registers a patient; a second similar one warns', async () => {
    const { page, errors, context } = await realPage(browser);
    await signInAs(page, 'frontoffice');
    const register = async (lastName) => {
      await page.goto(`${ORIGIN}/patients/new?type=quick`);
      await page.getByLabel(/^First name/).fill(first);
      await page.getByLabel(/^Last name/).fill(lastName);
      await page.getByLabel('Male', { exact: true }).check();
      await page.getByLabel('Years').fill('35');
      await page.getByLabel(/^Mobile/).fill(mobile);
      await page.getByRole('button', { name: 'Register', exact: true }).click();
    };
    await register(last);
    await page.waitForURL(/\/patients\/[a-f\d]{24}$/);
    const toast = await page
      .getByText(/Registered with UHID/)
      .first()
      .textContent();
    ctx.uhid = toast.match(/UHID (\S+)/)[1];
    await page.getByRole('heading', { name: full, level: 1 }).waitFor();
    await shot(page, 'p1b-real-patient-profile');
    await register('Patiant');
    await page.getByText(/Possible duplicate/).waitFor();
    await page.getByText(new RegExp(`Open ${ctx.uhid}`)).waitFor();
    await page.evaluate(() => document.fonts.ready);
    await shot(page, 'p1b-real-patient-duplicate');
    assert(errors.length === 0, `no page errors: ${errors.join(' | ')}`);
    await context.close();
  });

  await step('real API: cashier opens shift, bills, takes cash, prints the receipt', async () => {
    await ensureService(PORT, service.code, service.name);
    const { page, errors, context } = await realPage(browser);
    await signInAs(page, 'cashier');
    await page.goto(`${ORIGIN}/billing/shift`);
    await page.getByRole('heading', { name: 'Cashier shift and day-end' }).waitFor();
    const opening = page.getByRole('heading', { name: 'Open your shift' });
    const counted = page.getByRole('heading', { name: 'Cash count by note' });
    await opening.or(counted).first().waitFor();
    if (await opening.isVisible()) {
      await page.getByLabel(/^Counter/).fill(`S${RUN}`.slice(0, 8));
      await page.getByLabel(/^Opening float/).fill('2000');
      await page.getByRole('button', { name: 'Open shift' }).click();
      await counted.waitFor();
    }
    ctx.counter = (
      await page
        .locator('main')
        .getByText('Counter', { exact: true })
        .first()
        .locator('xpath=following-sibling::p[1]')
        .textContent()
    ).trim();
    await shot(page, 'p1b-real-shift-open');

    const newBill = async () => {
      await page.goto(`${ORIGIN}/billing?tab=new`);
      await page.getByPlaceholder('UHID, mobile or name').fill(mobile);
      await page
        .getByRole('button', { name: new RegExp(full) })
        .first()
        .click();
      await page.getByPlaceholder(/Consultation/).fill(service.code);
      await page.getByRole('button', { name: new RegExp(service.name) }).click();
      await page.getByRole('button', { name: 'Save draft bill' }).click();
      await page.getByRole('heading', { name: 'Draft bill' }).waitFor();
      await page.getByRole('button', { name: 'Finalise bill' }).click();
      await page.getByRole('heading', { name: /^Bill OP\// }).waitFor();
    };
    await newBill();
    await shot(page, 'p1b-real-bill-final');
    await page.getByRole('button', { name: 'Take ₹500' }).click();
    await page
      .getByText(/Received ₹500/)
      .first()
      .waitFor();
    await page.getByText('Paid in full.').waitFor();
    await page
      .getByRole('button', { name: /Receipt \(80 mm\)/ })
      .first()
      .click();
    await page
      .getByRole('dialog', { name: /Receipt RC/ })
      .locator('iframe')
      .waitFor();
    await shot(page, 'p1b-real-receipt');
    await page.keyboard.press('Escape');

    // Discount over 10%: 202, the bill waits for the Billing Manager and the Super Admin.
    await newBill();
    ctx.discountBill = page.url();
    await page.getByRole('button', { name: 'Ask for discount' }).click();
    await page.getByLabel(/^Discount \(%\)/).fill('20');
    await page.getByLabel(/^Reason/).fill(`Smoke concession ${RUN}`);
    await page.getByRole('button', { name: 'Send for approval' }).click();
    await page.getByText(/was sent for approval/).waitFor();
    await shot(page, 'p1b-real-discount-202');
    await page.setViewportSize({ width: 768, height: 1024 });
    await noHorizontalScroll(page, 'bill 768');
    await shot(page, 'p1b-real-bill-768', { fullPage: true });
    assert(errors.length === 0, `no page errors: ${errors.join(' | ')}`);
    await context.close();
  });

  await step('real API: cashier closes the shift with a variance reason', async () => {
    const { page, errors, context } = await realPage(browser);
    await signInAs(page, 'cashier');
    await page.goto(`${ORIGIN}/billing/shift`);
    await page.getByRole('heading', { name: 'Cash count by note' }).waitFor();
    await page.getByLabel('Number of ₹500 notes or coins').fill('1');
    await page.getByLabel(/^Reason for the variance/).fill(`Smoke test close ${RUN}`);
    await shot(page, 'p1b-real-shift-close', { fullPage: true });
    await page.getByRole('button', { name: 'Close shift' }).click();
    await page.getByText(/^Shift closed/).waitFor();
    assert(errors.length === 0, `no page errors: ${errors.join(' | ')}`);
    await context.close();
  });

  await step('real API: billing manager verifies the shift and approves the discount', async () => {
    const { page, errors, context } = await realPage(browser);
    await signInAs(page, 'billingmgr');
    await page.goto(`${ORIGIN}/billing/shift?tab=verify`);
    const row = page.getByRole('row', { name: new RegExp(ctx.counter ?? 'Demo Cashier') }).first();
    await row.waitFor();
    await row.getByRole('button', { name: 'Verify' }).click();
    await page.getByRole('button', { name: 'Mark verified' }).click();
    await page
      .getByText(/verified$/)
      .first()
      .waitFor();
    await approveInInbox(page, `discount on OP.*${full}`);
    await shot(page, 'p1b-real-discount-l1');
    assert(errors.length === 0, `no page errors: ${errors.join(' | ')}`);
    await context.close();
  });

  await step('real API: super admin approves the discount and sees it on the bill', async () => {
    const { page, errors, context } = await realPage(browser);
    await signInAs(page, 'superadmin');
    await approveInInbox(page, `discount on OP.*${full}`);
    await page.goto(ctx.discountBill);
    await page.getByText('Discount', { exact: true }).waitFor();
    await page.getByText('₹400.00').first().waitFor();
    await shot(page, 'p1b-real-discount-applied');
    assert(errors.length === 0, `no page errors: ${errors.join(' | ')}`);
    await context.close();
  });

  await step('real API: super admin views the subscription page', async () => {
    const { page, errors, context } = await realPage(browser);
    await signInAs(page, 'superadmin');
    await page.goto(`${ORIGIN}/settings/subscription`);
    await page.getByRole('heading', { name: 'Usage against limits' }).waitFor();
    await page.getByLabel(/^Patient CRM/).uncheck();
    await page.getByRole('button', { name: /^Confirm/ }).waitFor();
    await page.evaluate(() => document.fonts.ready);
    await shot(page, 'p1b-real-subscription', { fullPage: true });
    await page.setViewportSize({ width: 768, height: 1024 });
    await noHorizontalScroll(page, 'subscription 768');
    assert(errors.length === 0, `no page errors: ${errors.join(' | ')}`);
    await context.close();
  });

  await step('real API: signup wizard up to the mobile OTP', async () => {
    const { page, errors, context } = await realPage(browser);
    const site = `http://localhost:${PORT}`;
    await page.goto(`${site}/signup`);
    await page.getByLabel(/^Hospital or clinic name/).fill(`Smoke Hospital ${RUN}`);
    await page.getByLabel(/^City/).fill('Pune');
    await page.getByText('Available').waitFor();
    await page.getByRole('button', { name: 'Continue' }).click();
    const signupMobile = `8${String(Date.now()).slice(-9)}`;
    await page.getByLabel(/^Mobile number/).fill(signupMobile);
    await page.getByRole('button', { name: 'Send code' }).click();
    await page.getByText(/We sent a 6-digit code/).waitFor();
    await shot(page, 'p1b-real-signup-otp');
    let code = null;
    for (let i = 0; i < 20 && !code; i++) {
      code = smsCodeFor(signupMobile);
      if (!code) await page.waitForTimeout(250);
    }
    if (code) {
      await page.getByRole('textbox', { name: 'Digit 1 of 6' }).click();
      await page.keyboard.type(code);
      await page.getByLabel(/^Your full name/).waitFor();
      await shot(page, 'p1b-real-signup-details');
    } else log('  (SMOKE_API_LOG not set or no code logged: stopped at the code step)');
    assert(errors.length === 0, `no page errors: ${errors.join(' | ')}`);
    await context.close();
  });
}
