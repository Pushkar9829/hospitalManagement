/* global document, window -- used inside page.evaluate(), which runs in the browser */
/**
 * Phase 0 smoke test (Playwright, Chromium). Serves the production build with `vite preview` and
 * answers /api/v1/** from fixtures that conform to sessionSchema, so it needs no API.
 *
 *   pnpm --filter @hms/web e2e:smoke            build (with the dev gallery) + run
 *   node e2e/smoke.mjs --real                   also sign in against a real API on :4000
 *   node e2e/smoke.mjs --real-only              only the real-API journeys
 *
 * The preview proxies /api to HMS_API_URL (default http://localhost:4000). The signup journey
 * reads the SMS code from the API's log: set SMOKE_API_LOG to its file (console SMS provider).
 *
 * Env: CHROMIUM_PATH (default /opt/pw-browsers/chromium-1194/chrome-linux/chrome),
 *      PLAYWRIGHT_MODULE (default: `playwright` from node_modules, else the global install),
 *      SCREENSHOT_DIR (default ./e2e/screenshots).
 */
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PANELS } from '@hms/shared/catalog';
import { sessionSchema } from '@hms/shared/schemas';
import { phase1bFixtureSteps, phase1bRealSteps } from './phase1b.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const webRoot = resolve(here, '..');
const require = createRequire(import.meta.url);
const PORT = Number(process.env.SMOKE_PORT ?? 4173);
const ORIGIN = `http://demo.localhost:${PORT}`;
const SHOTS = resolve(process.env.SCREENSHOT_DIR ?? resolve(here, 'screenshots'));
const REAL = process.argv.includes('--real');
/** --real-only skips the fixture steps (for iterating on the real-API journeys). */
const REAL_ONLY = process.argv.includes('--real-only');
mkdirSync(SHOTS, { recursive: true });

function loadPlaywright() {
  for (const id of [
    process.env.PLAYWRIGHT_MODULE,
    'playwright',
    '/opt/node22/lib/node_modules/playwright',
  ]) {
    if (!id) continue;
    try {
      return require(id);
    } catch {
      /* try the next one */
    }
  }
  throw new Error('playwright not found: set PLAYWRIGHT_MODULE');
}
const { chromium } = loadPlaywright();

const log = (msg) => process.stdout.write(`${msg}\n`);
function assert(cond, msg) {
  if (!cond) throw new Error(`Assertion failed: ${msg}`);
}

// ---------------------------------------------------------------------------------------------
// Fixtures (validated against the shared schema so they cannot drift from the API contract)

const BRANCHES = [
  { id: '64b000000000000000000001', name: 'Main Branch' },
  { id: '64b000000000000000000002', name: 'City Branch' },
];

function session({
  panel,
  name,
  username,
  designation,
  modules,
  setup = false,
  permissions = PANELS[panel].permissions,
}) {
  return sessionSchema.parse({
    user: {
      id: `u-${panel}`,
      name,
      username,
      designation,
      roles: [{ code: panel.toUpperCase(), name: PANELS[panel].name, panel }],
      twoFactorEnabled: !setup,
      twoFactorSetupRequired: setup,
      mustChangePassword: false,
      preferredLanguage: 'en',
    },
    tenant: { id: 't-demo', name: 'Demo Hospital', subdomain: 'demo', status: 'ACTIVE', modules },
    branch: BRANCHES[0],
    branches: panel === 'superadmin' ? BRANCHES : [BRANCHES[0]],
    permissions,
    idleTimeoutMin: 15,
  });
}

const SUPERADMIN = session({
  panel: 'superadmin',
  name: 'Dr. Arjun Rao',
  username: 'superadmin',
  designation: 'Hospital Super Admin',
  modules: ['OPD', 'IPD', 'LAB'],
});
const NURSE = session({
  panel: 'nurse',
  name: 'Anjali Menon',
  username: 'nurse',
  designation: 'Staff Nurse · Ward 2',
  modules: ['OPD', 'IPD', 'NUR', 'LAB'],
});
const ENROL = session({
  panel: 'accounts',
  name: 'Ravi Iyer',
  username: 'accounts',
  designation: 'Accountant',
  modules: ['FIN'],
  setup: true,
});

const err = (code, message = code) => ({ error: { code, message, requestId: 'smoke-req-1' } });

/** Routes /api/v1/** for one browser context. `users` maps username -> session. */
async function mockApi(context, users, extra = {}) {
  const state = { current: null };
  await context.route('**/api/public/**', async (route) => {
    const req = route.request();
    const path = new URL(req.url()).pathname;
    const handler = extra[`${req.method()} ${path}`];
    const [status, json] = handler
      ? await handler(req.postDataJSON?.() ?? null, state)
      : [404, err('NOT_FOUND', path)];
    return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(json) });
  });
  await context.route('**/api/v1/**', async (route) => {
    const req = route.request();
    const path = new URL(req.url()).pathname.replace(/^\/api\/v1/, '');
    const body = req.postDataJSON?.() ?? null;
    const reply = (status, json) =>
      Buffer.isBuffer(json)
        ? route.fulfill({ status, contentType: 'application/pdf', body: json })
        : route.fulfill({
            status,
            contentType: 'application/json',
            body: json === undefined ? '' : JSON.stringify(json),
          });
    const key = `${req.method()} ${path}`;
    if (req.method() !== 'GET') {
      assert(req.headers()['idempotency-key'], `${key} sends Idempotency-Key`);
    }
    const handler = extra[key] ?? extra[`${req.method()} ${path.replace(/[a-f\d]{24}/g, ':id')}`];
    if (handler) {
      const [status, json] = await handler(body, state);
      return reply(status, json);
    }
    switch (key) {
      case 'GET /auth/me':
        return state.current ? reply(200, state.current) : reply(401, err('UNAUTHENTICATED'));
      case 'POST /auth/refresh':
        return reply(401, err('UNAUTHENTICATED'));
      case 'POST /auth/login': {
        const s = users[body?.username];
        if (!s || body.password !== 'Demo@12345') return reply(401, err('INVALID_CREDENTIALS'));
        state.current = s;
        return reply(200, s);
      }
      case 'POST /auth/logout':
        state.current = null;
        return reply(204);
      case 'POST /auth/branch': {
        const branch = BRANCHES.find((b) => b.id === body?.branchId);
        state.current = { ...state.current, branch };
        return reply(200, state.current);
      }
      case 'POST /auth/2fa/setup':
        return reply(200, {
          secret: 'JBSWY3DPEHPK3PXP',
          otpauthUrl: 'otpauth://totp/Demo%20Hospital:accounts?secret=JBSWY3DPEHPK3PXP&issuer=HMS',
        });
      case 'POST /auth/2fa/enable':
        if (body?.code !== '246810') return reply(422, err('VALIDATION_FAILED', 'Wrong code'));
        state.current = {
          ...state.current,
          user: { ...state.current.user, twoFactorEnabled: true, twoFactorSetupRequired: false },
        };
        return reply(200, { enabled: true });
      default:
        return reply(404, err('NOT_FOUND', key));
    }
  });
  return state;
}

// ---------------------------------------------------------------------------------------------

/**
 * Web fonts come from Google Fonts. When the environment has an HTTPS proxy, send only those
 * hosts through it (a PAC script), so the app on *.localhost is still reached directly.
 */
function fontProxyArgs() {
  const proxy = process.env.HTTPS_PROXY || process.env.https_proxy;
  if (!proxy) return [];
  const pac = `function FindProxyForURL(url, host) {
    if (dnsDomainIs(host, '.googleapis.com') || dnsDomainIs(host, '.gstatic.com')) return 'PROXY ${new URL(proxy).host}';
    return 'DIRECT';
  }`;
  return [
    `--proxy-pac-url=data:application/x-ns-proxy-autoconfig;base64,${Buffer.from(pac).toString('base64')}`,
  ];
}

async function startPreview() {
  const vite = resolve(webRoot, 'node_modules/.bin/vite');
  const child = spawn(vite, ['preview', '--port', String(PORT), '--strictPort'], {
    cwd: webRoot,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  child.stdout.on('data', (d) => (output += d));
  child.stderr.on('data', (d) => (output += d));
  for (let i = 0; i < 100; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/`, {
        headers: { Host: `demo.localhost:${PORT}` },
      });
      if (res.ok) return child;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  child.kill();
  throw new Error(`vite preview did not start:\n${output}`);
}

async function newPage(browser, viewport, users, extra) {
  const context = await browser.newContext({ viewport, reducedMotion: 'reduce' });
  const state = users ? await mockApi(context, users, extra) : null;
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on(
    'console',
    (m) =>
      m.type() === 'error' && !/Failed to load resource/.test(m.text()) && errors.push(m.text()),
  );
  return { context, page, state, errors };
}

async function shot(page, name, opts = {}) {
  const file = resolve(SHOTS, `${name}.png`);
  await page.screenshot({ path: file, ...opts });
  log(`  screenshot ${file}`);
}

async function noHorizontalScroll(page, label) {
  const { sw, iw } = await page.evaluate(() => ({
    sw: document.documentElement.scrollWidth,
    iw: window.innerWidth,
  }));
  assert(sw <= iw, `${label}: no horizontal scroll (scrollWidth ${sw} > ${iw})`);
}

async function signIn(page, username) {
  await page.goto(`${ORIGIN}/login`);
  await page.getByRole('heading', { name: 'Sign in' }).waitFor();
  await page.getByLabel('Username or mobile').fill(username);
  await page.locator('input[autocomplete="current-password"]').fill('Demo@12345');
  await page.getByRole('button', { name: 'Sign in' }).click();
}

// ---------------------------------------------------------------------------------------------
// Real API (--real): the Phase 1 admin journeys against the live API on :4000 through the
// preview proxy. Every run uses fresh codes, so it can run again on the same database.

const RUN =
  `${Date.now().toString(36).slice(-4)}${Math.random().toString(36).slice(2, 4)}`.toUpperCase();
const DEPT_CODE = `SM${RUN}`.slice(0, 8);
const DEPT_NAME = `Smoke Nephrology ${RUN}`;
const NURSE_USER = `smoke.nurse.${RUN.toLowerCase()}`;
const BILLING_USER = `smoke.billing.${RUN.toLowerCase()}`;
const TEMP_PASSWORD = 'Smoke#Temp2026';
const NEW_PASSWORD = 'Smoke#Mine2026';

async function realPage(browser, viewport = { width: 1440, height: 900 }) {
  return newPage(browser, viewport, null);
}

async function signInAs(page, username, password = 'Demo@12345') {
  await page.goto(`${ORIGIN}/login`);
  await page.getByRole('heading', { name: 'Sign in' }).waitFor();
  await page.getByLabel('Username or mobile').fill(username);
  await page.locator('input[autocomplete="current-password"]').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL((u) => !u.pathname.startsWith('/login'));
}

async function approveInInbox(page, titleText) {
  await page.goto(`${ORIGIN}/approvals`);
  await page.getByRole('heading', { name: 'Approvals', level: 1 }).waitFor();
  const item = page.getByRole('button', { name: new RegExp(titleText) });
  await item.waitFor();
  await item.click();
  await page.getByRole('heading', { name: new RegExp(titleText), level: 2 }).waitFor();
  await page.getByRole('button', { name: 'Approve' }).click();
  await page
    .getByText(/^Approved: /)
    .first()
    .waitFor();
}

async function realApiSteps(browser, step) {
  await step('real API: admin registers a department (202, waits for approval)', async () => {
    const { page, errors, context } = await realPage(browser);
    await signInAs(page, 'admin');
    await page.goto(`${ORIGIN}/settings/masters`);
    await page.getByRole('heading', { name: 'Departments and masters' }).waitFor();
    await page.evaluate(() => document.fonts.ready);
    await shot(page, 'p1-masters-departments');
    await page.getByRole('button', { name: 'Register department' }).first().click();
    const sheet = page.getByRole('dialog', { name: 'Register department' });
    await sheet.waitFor();
    await sheet.getByLabel(/^Code/).fill(DEPT_CODE);
    await sheet.getByLabel(/^Name/).fill(DEPT_NAME);
    await sheet.getByLabel('OPD', { exact: true }).check();
    await sheet.getByRole('button', { name: 'Add session Monday' }).click();
    await shot(page, 'p1-department-sheet');
    await sheet.getByRole('button', { name: 'Submit for approval' }).click();
    await page.getByText('Sent for approval.').waitFor();
    await page.getByText(`${DEPT_NAME} (${DEPT_CODE}) was sent for approval.`).waitFor();
    await page
      .getByRole('row', { name: new RegExp(DEPT_CODE) })
      .getByText('Pending approval')
      .waitFor();
    await shot(page, 'p1-department-202');
    assert(errors.length === 0, `no page errors: ${errors.join(' | ')}`);
    await context.close();
  });

  await step('real API: super admin approves it from the inbox (badge, path, diff)', async () => {
    const { page, errors, context } = await realPage(browser);
    await signInAs(page, 'superadmin');
    const nav = page.getByRole('navigation', { name: 'Main menu' });
    await nav.getByRole('link', { name: /Approvals.*waiting for your approval/ }).waitFor();
    await page.goto(`${ORIGIN}/approvals`);
    const item = page.getByRole('button', { name: new RegExp(DEPT_CODE) });
    await item.click();
    await page.getByRole('heading', { name: new RegExp(DEPT_CODE), level: 2 }).waitFor();
    await page.getByText('Approval path').waitFor();
    await page.evaluate(() => document.fonts.ready);
    await shot(page, 'p1-approvals-inbox');
    await page.getByRole('button', { name: 'Approve' }).click();
    await page
      .getByText(/^Approved: /)
      .first()
      .waitFor();
    assert(errors.length === 0, `no page errors: ${errors.join(' | ')}`);
    await context.close();
  });

  await step('real API: admin sees the department ACTIVE', async () => {
    const { page, errors, context } = await realPage(browser);
    await signInAs(page, 'admin');
    await page.goto(`${ORIGIN}/settings/masters`);
    await page.getByPlaceholder('Code or name').fill(DEPT_CODE);
    await page
      .getByRole('row', { name: new RegExp(DEPT_CODE) })
      .getByText('Active')
      .waitFor();
    await page.getByRole('row', { name: new RegExp(DEPT_CODE) }).click();
    await page.getByRole('dialog', { name: `Edit ${DEPT_NAME}` }).waitFor();
    await shot(page, 'p1-department-active');
    await page.keyboard.press('Escape');
    assert(errors.length === 0, `no page errors: ${errors.join(' | ')}`);
    await context.close();
  });

  await step('real API: admin imports 2 referral sources from CSV through the wizard', async () => {
    const { page, errors, context } = await realPage(browser);
    await signInAs(page, 'admin');
    await page.goto(`${ORIGIN}/settings/masters?tab=referral-sources`);
    await page.getByRole('button', { name: 'Import from Excel' }).click();
    const dialog = page.getByRole('dialog', { name: /Import Referral sources/ });
    await dialog.waitFor();
    await dialog.getByRole('button', { name: 'I have the file' }).click();
    const csv = `Code,Name,Kind,Phone\nRS${RUN}1,Smoke referral ${RUN} 1,DOCTOR,9876543210\nRS${RUN}2,Smoke referral ${RUN} 2,CAMP,\n`;
    await dialog.locator('input[type=file]').setInputFiles({
      name: 'referrals.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(csv),
    });
    await dialog.getByText('Checked referrals.csv.').waitFor();
    assert((await dialog.getByRole('row').filter({ hasText: 'New' }).count()) === 2, '2 new rows');
    await shot(page, 'p1-import-preview');
    await dialog.getByRole('button', { name: 'Continue' }).click();
    await dialog.getByLabel(/^Reason/).fill('Smoke test referral sources');
    await dialog.getByRole('button', { name: 'Save 2 rows' }).click();
    await dialog.getByText('2 rows saved to Referral sources').waitFor();
    await shot(page, 'p1-import-done');
    await dialog.getByRole('button', { name: 'Close' }).first().click();
    await page.getByRole('row', { name: new RegExp(`RS${RUN}1`) }).waitFor();
    assert(errors.length === 0, `no page errors: ${errors.join(' | ')}`);
    await context.close();
  });

  await step('real API: super admin finds the department approval in the audit log', async () => {
    const { page, errors, context } = await realPage(browser);
    await signInAs(page, 'superadmin');
    await page.goto(`${ORIGIN}/audit?entity=Department&action=APPROVE`);
    const row = page.getByRole('row', { name: new RegExp(DEPT_CODE) });
    await row.waitFor();
    await row.click();
    await page.getByRole('heading', { name: 'Entry detail' }).waitFor();
    await page.evaluate(() => document.fonts.ready);
    await shot(page, 'p1-audit-log');
    assert(errors.length === 0, `no page errors: ${errors.join(' | ')}`);
    await context.close();
  });

  await step('real API: admin creates a nurse with a temporary password (201)', async () => {
    const { page, errors, context } = await realPage(browser);
    await signInAs(page, 'admin');
    await page.goto(`${ORIGIN}/settings/users`);
    await page.getByRole('heading', { name: 'Users and logins' }).waitFor();
    await shot(page, 'p1-users');
    await page.getByRole('button', { name: 'Add user', exact: true }).click();
    const sheet = page.getByRole('dialog', { name: 'Add user' });
    await sheet.getByLabel(/^Full name/).fill(`Smoke Nurse ${RUN}`);
    await sheet.getByLabel(/^Username/).fill(NURSE_USER);
    await sheet.getByLabel('Staff Nurse').check();
    await sheet.getByLabel('Main Branch').check();
    await sheet.getByRole('textbox', { name: 'Temporary password' }).fill(TEMP_PASSWORD);
    await shot(page, 'p1-user-sheet');
    await sheet.getByRole('button', { name: 'Create login' }).click();
    await page.getByText(`Login created for Smoke Nurse ${RUN}`, { exact: true }).waitFor();
    assert(errors.length === 0, `no page errors: ${errors.join(' | ')}`);
    await context.close();
  });

  await step('real API: admin creates a billing manager (202)', async () => {
    const { page, errors, context } = await realPage(browser);
    await signInAs(page, 'admin');
    await page.goto(`${ORIGIN}/settings/users?user=new`);
    const sheet = page.getByRole('dialog', { name: 'Add user' });
    await sheet.getByLabel(/^Full name/).fill(`Smoke Billing ${RUN}`);
    await sheet.getByLabel(/^Username/).fill(BILLING_USER);
    await sheet.getByLabel(/Billing Manager/).check();
    await sheet.getByLabel('Main Branch').check();
    await sheet.getByRole('textbox', { name: 'Temporary password' }).fill(TEMP_PASSWORD);
    await sheet.getByRole('button', { name: 'Submit for approval' }).click();
    await page.getByText('Sent for approval.').waitFor();
    await page.getByText(`The login for Smoke Billing ${RUN} was sent for approval.`).waitFor();
    assert(errors.length === 0, `no page errors: ${errors.join(' | ')}`);
    await context.close();
  });

  await step('real API: super admin approves the billing manager', async () => {
    const { page, errors, context } = await realPage(browser);
    await signInAs(page, 'superadmin');
    await approveInInbox(page, BILLING_USER.replace(/\./g, '\\.'));
    assert(errors.length === 0, `no page errors: ${errors.join(' | ')}`);
    await context.close();
  });

  await step('real API: the new nurse must choose a new password', async () => {
    const { page, errors, context } = await realPage(browser);
    await signInAs(page, NURSE_USER, TEMP_PASSWORD);
    await page.waitForURL(`${ORIGIN}/change-password`);
    await page.getByRole('heading', { name: 'Choose a new password' }).waitFor();
    await page.evaluate(() => document.fonts.ready);
    await shot(page, 'p1-forced-password');
    await page.getByLabel(/^Current password/).fill(TEMP_PASSWORD);
    await page.getByLabel(/^New password/).fill(NEW_PASSWORD);
    await page.getByLabel(/^Type the new password again/).fill(NEW_PASSWORD);
    await page.getByRole('button', { name: 'Save and continue' }).click();
    await page.waitForURL((u) => u.pathname === '/home');
    assert(errors.length === 0, `no page errors: ${errors.join(' | ')}`);
    await context.close();
  });

  await step(
    'real API: screens for the record (settings tabs, roles, password, 768 px)',
    async () => {
      const { page, errors, context } = await realPage(browser);
      await signInAs(page, 'superadmin');
      for (const [tab, name] of [
        ['hospital', 'p1-settings-hospital'],
        ['entities', 'p1-settings-entities'],
        ['branches', 'p1-settings-branches'],
        ['numbering', 'p1-settings-numbering'],
        ['approval-rules', 'p1-settings-rules'],
      ]) {
        await page.goto(`${ORIGIN}/settings?tab=${tab}`);
        await page.getByRole('heading', { name: 'Hospital settings' }).waitFor();
        await page.waitForLoadState('networkidle');
        await noHorizontalScroll(page, `settings ${tab} 1440`);
        await shot(page, name, { fullPage: true });
      }
      await page.goto(`${ORIGIN}/settings/masters?tab=services`);
      await page.waitForLoadState('networkidle');
      await shot(page, 'p1-masters-services');
      await page.goto(`${ORIGIN}/settings/roles`);
      await page.getByRole('heading', { name: 'Roles and access' }).waitFor();
      await page.waitForLoadState('networkidle');
      await shot(page, 'p1-roles');
      await page.goto(`${ORIGIN}/approvals?box=all`);
      await page.waitForLoadState('networkidle');
      await shot(page, 'p1-approvals-all');
      await page.getByRole('button', { name: 'Account menu for Dr. Arjun Rao' }).click();
      await page.getByRole('menuitem', { name: 'Change password' }).click();
      await page.getByRole('dialog', { name: 'Change password' }).waitFor();
      await shot(page, 'p1-change-password');
      await page.keyboard.press('Escape');
      await page.setViewportSize({ width: 768, height: 1024 });
      for (const tab of ['hospital', 'branches', 'numbering']) {
        await page.goto(`${ORIGIN}/settings?tab=${tab}`);
        await page.getByRole('heading', { name: 'Hospital settings' }).waitFor();
        await page.waitForLoadState('networkidle');
        await noHorizontalScroll(page, `settings ${tab} 768`);
        await shot(page, `p1-settings-${tab}-768`, { fullPage: true });
      }
      await page.goto(`${ORIGIN}/settings/masters`);
      await page.waitForLoadState('networkidle');
      await noHorizontalScroll(page, 'masters 768');
      await shot(page, 'p1-masters-768');
      await page.goto(`${ORIGIN}/approvals?box=all`);
      await page.waitForLoadState('networkidle');
      await shot(page, 'p1-approvals-768', { fullPage: true });
      assert(errors.length === 0, `no page errors: ${errors.join(' | ')}`);
      await context.close();
    },
  );

  await step('real API: forgot password and invitation pages', async () => {
    const { page, errors, context } = await realPage(browser);
    await page.goto(`${ORIGIN}/login`);
    await page.getByRole('link', { name: 'Forgot password?' }).click();
    await page.getByRole('heading', { name: 'Forgot your password?' }).waitFor();
    await page.getByLabel(/^Username or mobile/).fill('nurse');
    await page.getByRole('button', { name: 'Send code' }).click();
    await page.getByRole('heading', { name: 'Set a new password' }).waitFor();
    await page.evaluate(() => document.fonts.ready);
    await shot(page, 'p1-forgot-reset');
    await page.goto(`${ORIGIN}/welcome?token=${'x'.repeat(40)}`);
    await page.getByText('This invitation cannot be used.').waitFor();
    await shot(page, 'p1-welcome-expired');
    assert(errors.length === 0, `no page errors: ${errors.join(' | ')}`);
    await context.close();
  });
}

/** Helpers the Phase 1 patient, billing, subscription and signup steps use (phase1b.mjs). */
function kit() {
  return {
    newPage,
    realPage,
    shot,
    assert,
    noHorizontalScroll,
    signIn,
    signInAs,
    approveInInbox,
    session,
    log,
    ORIGIN,
    PORT,
    RUN,
  };
}

async function run() {
  const users = { superadmin: SUPERADMIN, nurse: NURSE, accounts: ENROL };
  const preview = await startPreview();
  const browser = await chromium.launch({
    executablePath:
      process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: fontProxyArgs(),
  });
  const failures = [];
  const step = async (name, fn) => {
    log(`- ${name}`);
    try {
      await fn();
    } catch (e) {
      failures.push(`${name}: ${e.message}`);
      log(`  FAILED ${e.message}`);
    }
  };

  try {
    if (!REAL_ONLY) {
      await fixtureSteps(browser, step, users);
      await phase1bFixtureSteps(browser, step, kit());
    }
    if (REAL || REAL_ONLY) {
      await realApiSteps(browser, step);
      await phase1bRealSteps(browser, step, kit());
    }
  } finally {
    await browser.close();
    preview.kill();
  }

  if (failures.length) {
    log(`\n${failures.length} step(s) failed:\n${failures.join('\n')}`);
    process.exit(1);
  }
  log('\nSmoke test passed.');
}

async function fixtureSteps(browser, step, users) {
  {
    await step('superadmin: login, home, sidebar search, palette, 402', async () => {
      const { page, errors, context } = await newPage(browser, { width: 1440, height: 900 }, users);
      await page.goto(`${ORIGIN}/ipd/beds`);
      await page.getByRole('heading', { name: 'Sign in' }).waitFor();
      assert(page.url().includes('/login?next=%2Fipd%2Fbeds'), 'redirects to /login?next=');
      await page.goto(`${ORIGIN}/login`);
      await page.getByRole('heading', { name: 'Sign in' }).waitFor();
      await page.evaluate(() => document.fonts.ready);
      await shot(page, 'login');

      // Inline Zod errors before any API call.
      await page.getByRole('button', { name: 'Sign in' }).click();
      await page.getByText('Enter your username or mobile').waitFor();
      await shot(page, 'login-errors');

      await signIn(page, 'superadmin');
      await page
        .getByRole('heading', { name: /Good (morning|afternoon|evening), Arjun/ })
        .waitFor();
      assert(new URL(page.url()).pathname === '/', 'superadmin lands on / (dashboard)');
      const nav = page.getByRole('navigation', { name: 'Main menu' });
      assert(
        (await nav.getByRole('link', { name: 'Pharmacy' }).count()) === 0,
        'unsubscribed Pharmacy hidden',
      );
      const aside = await page.locator('aside').first().boundingBox();
      assert(Math.round(aside.width) === 232, `sidebar is 232 px (got ${aside.width})`);
      await noHorizontalScroll(page, 'home 1440');
      await shot(page, 'home-superadmin');

      // Sidebar search.
      await page.getByRole('searchbox', { name: 'Search menu' }).fill('bed');
      const labels = await nav.getByRole('link').allTextContents();
      assert(
        labels.length > 0 && labels.every((l) => /bed/i.test(l)),
        `search filters menu: ${labels}`,
      );
      await shot(page, 'sidebar-search');
      await page.keyboard.press('Enter');
      await page.waitForURL(`${ORIGIN}/ipd/beds`);
      await page.getByText('This screen is built in Phase 3 of the implementation plan.').waitFor();
      await shot(page, 'planned-screen');

      // Favourite + collapse persistence.
      await nav
        .getByRole('button', { name: 'Add Bed Board to favourites' })
        .first()
        .click({ force: true });
      await nav.getByRole('button', { name: 'Clinical', exact: true }).click();
      await page.reload();
      await page
        .getByRole('navigation', { name: 'Main menu' })
        .getByRole('button', { name: 'Favourites', exact: true })
        .waitFor();
      assert(
        (await page
          .getByRole('button', { name: 'Clinical', exact: true })
          .getAttribute('aria-expanded')) === 'false',
        'collapsed group remembered',
      );

      // Command palette.
      await page.locator('body').click({ position: { x: 900, y: 600 } });
      await page.keyboard.press('Control+k');
      const input = page.getByPlaceholder('Go to a screen or run an action…');
      await input.waitFor();
      await input.fill('lab');
      await shot(page, 'palette');
      await page.keyboard.press('Enter');
      await page.waitForURL((u) => u.pathname.startsWith('/lab') || u.pathname === '/settings/lab');

      // Shortcuts dialog.
      await page.locator('body').click({ position: { x: 900, y: 600 } });
      await page.keyboard.press('?');
      await page.getByRole('dialog', { name: 'Keyboard shortcuts' }).waitFor();
      await shot(page, 'shortcuts');
      await page.keyboard.press('Escape');

      // Branch switch (2 branches).
      await page.getByRole('button', { name: /Switch branch/ }).click();
      await page.getByRole('menuitemradio', { name: 'City Branch' }).click();
      await page.getByText('Now working in City Branch', { exact: true }).first().waitFor();

      // Unsubscribed module by direct link.
      await page.goto(`${ORIGIN}/pharmacy`);
      await page.getByRole('heading', { name: 'Pharmacy is not in your plan' }).waitFor();
      await page.getByRole('button', { name: 'Add module' }).waitFor();
      await shot(page, '402-pharmacy');

      // 1366 x 768.
      await page.setViewportSize({ width: 1366, height: 768 });
      await page.goto(`${ORIGIN}/`);
      await page.getByRole('heading', { name: /Arjun/ }).waitFor();
      await noHorizontalScroll(page, 'home 1366');
      await shot(page, 'home-superadmin-1366');

      // Dark and high-contrast themes from the user menu.
      await page.getByRole('button', { name: 'Account menu for Dr. Arjun Rao' }).click();
      await page.getByRole('menuitemradio', { name: 'Dark' }).click();
      await shot(page, 'home-superadmin-dark');
      await page.getByRole('button', { name: 'Account menu for Dr. Arjun Rao' }).click();
      await page.getByRole('menuitemradio', { name: 'High contrast' }).click();
      await shot(page, 'home-superadmin-contrast');
      await page.getByRole('button', { name: 'Account menu for Dr. Arjun Rao' }).click();
      await page.getByRole('menuitemradio', { name: 'Light' }).click();

      // Hindi.
      await page.getByRole('button', { name: 'Account menu for Dr. Arjun Rao' }).click();
      await page.getByRole('menuitemradio', { name: 'हिन्दी' }).click();
      await page.getByRole('heading', { name: /अर्जुन|Arjun/ }).waitFor();
      await shot(page, 'home-superadmin-hi');
      await page.getByRole('button', { name: /अकाउंट मेन्यू/ }).click();
      await page.getByRole('menuitemradio', { name: 'English' }).click();

      // Sign out.
      await page.getByRole('button', { name: 'Account menu for Dr. Arjun Rao' }).click();
      await page.getByRole('menuitem', { name: 'Sign out' }).click();
      await page.getByRole('heading', { name: 'Sign in' }).waitFor();
      assert(errors.length === 0, `no page errors: ${errors.join(' | ')}`);
      await context.close();
    });

    await step('nurse: home and 403', async () => {
      const { page, errors, context } = await newPage(browser, { width: 1440, height: 900 }, users);
      await signIn(page, 'nurse');
      await page.getByRole('heading', { name: /Anjali/ }).waitFor();
      assert(new URL(page.url()).pathname === '/home', 'nurse lands on /home');
      await shot(page, 'home-nurse');
      await page.goto(`${ORIGIN}/audit`);
      await page.getByRole('heading', { name: "You don't have access to Audit log" }).waitFor();
      await shot(page, '403-audit');
      await page.goto(`${ORIGIN}/no-such-page`);
      await page.getByRole('heading', { name: 'Page not found' }).waitFor();
      assert(errors.length === 0, `no page errors: ${errors.join(' | ')}`);
      await context.close();
    });

    await step('tablet 768: drawer menu', async () => {
      const { page, errors, context } = await newPage(browser, { width: 768, height: 1024 }, users);
      await signIn(page, 'nurse');
      await page.getByRole('heading', { name: /Anjali/ }).waitFor();
      assert(!(await page.locator('aside').first().isVisible()), 'sidebar hidden at 768');
      await noHorizontalScroll(page, 'home 768');
      await shot(page, 'tablet-768');
      await page.getByRole('button', { name: 'Open menu' }).click();
      await page.getByRole('dialog', { name: 'Main menu' }).waitFor();
      await shot(page, 'tablet-768-menu');
      await page.getByRole('dialog').getByRole('link', { name: 'Bed Board' }).click();
      await page.waitForURL(`${ORIGIN}/ipd/beds`);
      assert((await page.getByRole('dialog').count()) === 0, 'drawer closes on navigate');
      await noHorizontalScroll(page, 'planned 768');
      assert(errors.length === 0, `no page errors: ${errors.join(' | ')}`);
      await context.close();
    });

    await step('two-factor enrolment', async () => {
      const { page, errors, context } = await newPage(browser, { width: 1440, height: 900 }, users);
      await signIn(page, 'accounts');
      await page.waitForURL(`${ORIGIN}/setup-2fa`);
      await page.getByText('JBSW Y3DP EHPK 3PXP').waitFor();
      await shot(page, 'setup-2fa');
      await page.getByRole('textbox', { name: 'Digit 1 of 6' }).click();
      await page.keyboard.type('246810');
      await page.waitForURL(`${ORIGIN}/home`);
      assert(errors.length === 0, `no page errors: ${errors.join(' | ')}`);
      await context.close();
    });

    await step('dev gallery', async () => {
      const { page, errors, context } = await newPage(browser, { width: 1440, height: 900 }, users);
      await page.goto(`${ORIGIN}/dev/ui`);
      await page.getByRole('heading', { name: 'UI component gallery' }).waitFor();
      await page.evaluate(() => document.fonts.ready);
      await noHorizontalScroll(page, 'gallery');
      await shot(page, 'dev-ui', { fullPage: true });
      await page.getByRole('combobox', { name: 'Theme' }).selectOption('dark');
      await shot(page, 'dev-ui-dark', { fullPage: true });
      await page.getByRole('combobox', { name: 'Theme' }).selectOption('light');
      await page.getByRole('button', { name: 'Confirm dialog' }).click();
      await page.getByRole('button', { name: 'Request cancellation' }).click();
      await page.getByText('Enter a reason. It is saved in the audit log.').waitFor();
      await shot(page, 'confirm-dialog');
      assert(errors.length === 0, `no page errors: ${errors.join(' | ')}`);
      await context.close();
    });
  }
}

run().catch((e) => {
  log(e.stack ?? String(e));
  process.exit(1);
});
