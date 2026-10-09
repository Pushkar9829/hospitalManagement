/**
 * Phase 0 smoke test (Playwright, Chromium). Serves the production build with `vite preview` and
 * answers /api/v1/** from fixtures that conform to sessionSchema, so it needs no API.
 *
 *   pnpm --filter @hms/web e2e:smoke            build (with the dev gallery) + run
 *   node e2e/smoke.mjs --real                   also sign in against a real API on :4000
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

const here = dirname(fileURLToPath(import.meta.url));
const webRoot = resolve(here, '..');
const require = createRequire(import.meta.url);
const PORT = Number(process.env.SMOKE_PORT ?? 4173);
const ORIGIN = `http://demo.localhost:${PORT}`;
const SHOTS = resolve(process.env.SCREENSHOT_DIR ?? resolve(here, 'screenshots'));
const REAL = process.argv.includes('--real');
mkdirSync(SHOTS, { recursive: true });

function loadPlaywright() {
  for (const id of [process.env.PLAYWRIGHT_MODULE, 'playwright', '/opt/node22/lib/node_modules/playwright']) {
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

function session({ panel, name, username, designation, modules, setup = false }) {
  return sessionSchema.parse({
    user: {
      id: `u-${panel}`,
      name,
      username,
      designation,
      roles: [{ code: panel.toUpperCase(), name: PANELS[panel].name, panel }],
      twoFactorEnabled: !setup,
      twoFactorSetupRequired: setup,
      preferredLanguage: 'en',
    },
    tenant: { id: 't-demo', name: 'Demo Hospital', subdomain: 'demo', status: 'ACTIVE', modules },
    branch: BRANCHES[0],
    branches: panel === 'superadmin' ? BRANCHES : [BRANCHES[0]],
    permissions: PANELS[panel].permissions,
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
async function mockApi(context, users) {
  const state = { current: null };
  await context.route('**/api/v1/**', async (route) => {
    const req = route.request();
    const path = new URL(req.url()).pathname.replace(/^\/api\/v1/, '');
    const body = req.postDataJSON?.() ?? null;
    const reply = (status, json) =>
      route.fulfill({
        status,
        contentType: 'application/json',
        body: json === undefined ? '' : JSON.stringify(json),
      });
    const key = `${req.method()} ${path}`;
    if (req.method() !== 'GET') {
      assert(req.headers()['idempotency-key'], `${key} sends Idempotency-Key`);
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
      const res = await fetch(`http://127.0.0.1:${PORT}/`, { headers: { Host: `demo.localhost:${PORT}` } });
      if (res.ok) return child;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  child.kill();
  throw new Error(`vite preview did not start:\n${output}`);
}

async function newPage(browser, viewport, users) {
  const context = await browser.newContext({ viewport, reducedMotion: 'reduce' });
  const state = users ? await mockApi(context, users) : null;
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && !/Failed to load resource/.test(m.text()) && errors.push(m.text()));
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

async function run() {
  const users = { superadmin: SUPERADMIN, nurse: NURSE, accounts: ENROL };
  const preview = await startPreview();
  const proxy = process.env.HTTPS_PROXY || process.env.https_proxy;
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    // Web fonts come from Google Fonts; use the environment's proxy when there is one.
    ...(proxy ? { proxy: { server: proxy, bypass: 'localhost,*.localhost,127.0.0.1' } } : {}),
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
      await page.getByRole('heading', { name: /Good (morning|afternoon|evening), Arjun/ }).waitFor();
      assert(new URL(page.url()).pathname === '/', 'superadmin lands on / (dashboard)');
      const nav = page.getByRole('navigation', { name: 'Main menu' });
      assert((await nav.getByRole('link', { name: 'Pharmacy' }).count()) === 0, 'unsubscribed Pharmacy hidden');
      const aside = await page.locator('aside').first().boundingBox();
      assert(Math.round(aside.width) === 232, `sidebar is 232 px (got ${aside.width})`);
      await noHorizontalScroll(page, 'home 1440');
      await shot(page, 'home-superadmin');

      // Sidebar search.
      await page.getByRole('searchbox', { name: 'Search menu' }).fill('bed');
      const labels = await nav.getByRole('link').allTextContents();
      assert(labels.length > 0 && labels.every((l) => /bed/i.test(l)), `search filters menu: ${labels}`);
      await shot(page, 'sidebar-search');
      await page.keyboard.press('Enter');
      await page.waitForURL(`${ORIGIN}/ipd/beds`);
      await page.getByText('This screen is built in Phase 3 of the implementation plan.').waitFor();
      await shot(page, 'planned-screen');

      // Favourite + collapse persistence.
      await nav.getByRole('button', { name: 'Add Bed Board to favourites' }).first().click({ force: true });
      await nav.getByRole('button', { name: 'Clinical' }).click();
      await page.reload();
      await page.getByRole('navigation', { name: 'Main menu' }).getByRole('button', { name: 'Favourites' }).waitFor();
      assert(
        (await page.getByRole('button', { name: 'Clinical' }).getAttribute('aria-expanded')) === 'false',
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
      await page.getByText('Now working in City Branch').waitFor();

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

    if (REAL) {
      await step('real API: superadmin sign-in through the preview proxy', async () => {
        const { page, errors, context } = await newPage(browser, { width: 1440, height: 900 }, null);
        await signIn(page, 'superadmin');
        await page.getByRole('heading', { name: /Good (morning|afternoon|evening)/ }).waitFor();
        await shot(page, 'real-api-home');
        await page.getByRole('button', { name: /Account menu for/ }).click();
        await page.getByRole('menuitem', { name: 'Sign out' }).click();
        await page.getByRole('heading', { name: 'Sign in' }).waitFor();
        assert(errors.length === 0, `no page errors: ${errors.join(' | ')}`);
        await context.close();
      });
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

run().catch((e) => {
  log(e.stack ?? String(e));
  process.exit(1);
});
