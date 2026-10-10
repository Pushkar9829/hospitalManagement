import { describe, expect, it } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import { errorBody, makeSession } from '../test/fixtures.js';
import { mockApi, renderApp } from '../test/renderApp.jsx';

const signedIn = (session) => ({ 'GET /auth/me': () => [200, session] });
const anonymous = {
  'GET /auth/me': () => [401, errorBody('UNAUTHENTICATED')],
  'POST /auth/refresh': () => [401, errorBody('UNAUTHENTICATED')],
};

describe('route guards', () => {
  it('says so when the address is no hospital (404 TENANT_NOT_FOUND)', async () => {
    mockApi({
      'GET /auth/me': () => [404, errorBody('TENANT_NOT_FOUND', 'Unknown hospital address')],
    });
    renderApp('/login');
    expect(
      await screen.findByRole('heading', { name: 'No hospital at this address' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Go to the main site' })).toHaveAttribute(
      'href',
      expect.stringMatching(/^http:\/\/localhost(:\d+)?\/pricing$/),
    );
  });

  it('sends anonymous users to /login with next', async () => {
    mockApi(anonymous);
    const { router } = renderApp('/ipd/beds?ward=2');
    await screen.findByRole('heading', { name: 'Sign in' });
    expect(router.state.location.pathname).toBe('/login');
    expect(router.state.location.search).toBe(`?next=${encodeURIComponent('/ipd/beds?ward=2')}`);
  });

  it('shows 402 for a module the hospital has not subscribed to', async () => {
    mockApi(signedIn(makeSession({ panel: 'superadmin', modules: ['OPD', 'IPD', 'LAB'] })));
    renderApp('/pharmacy');
    expect(
      await screen.findByRole('heading', { name: 'Pharmacy is not in your plan' }),
    ).toBeInTheDocument();
    // Super Admin may add it.
    expect(screen.getByRole('button', { name: 'Add module' })).toBeInTheDocument();
  });

  it('tells other roles to ask their administrator on 402', async () => {
    mockApi(signedIn(makeSession({ panel: 'nurse', modules: ['IPD', 'NUR'] })));
    renderApp('/lab/samples');
    expect(
      await screen.findByRole('heading', { name: /Laboratory is not in your plan/ }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add module' })).toBeNull();
    expect(screen.getByText(/Ask your administrator/)).toBeInTheDocument();
  });

  it('shows 403 naming the missing permission', async () => {
    mockApi(signedIn(makeSession({ panel: 'nurse', modules: ['OPD', 'IPD', 'NUR', 'LAB'] })));
    renderApp('/audit');
    expect(
      await screen.findByRole('heading', { name: "You don't have access to Audit log" }),
    ).toBeInTheDocument();
    expect(screen.getByText('audit:log:read')).toBeInTheDocument();
  });

  it('redirects / to /home for roles without the admin dashboard', async () => {
    mockApi(
      signedIn(makeSession({ panel: 'nurse', modules: ['IPD', 'NUR'], name: 'Anjali Menon' })),
    );
    const { router } = renderApp('/');
    await screen.findByRole('heading', { name: /Anjali/ });
    expect(router.state.location.pathname).toBe('/home');
  });

  it('serves / as the dashboard for Super Admin', async () => {
    mockApi(signedIn(makeSession({ panel: 'superadmin', name: 'Dr. Arjun Rao' })));
    const { router } = renderApp('/');
    await screen.findByRole('heading', { name: /Arjun/ });
    expect(router.state.location.pathname).toBe('/');
    const nav = screen.getByRole('navigation', { name: 'Main menu' });
    expect(within(nav).getByRole('link', { name: 'Dashboard' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  it('shows the planned screen for a route whose module is built later', async () => {
    mockApi(signedIn(makeSession({ panel: 'superadmin' })));
    renderApp('/ipd/beds');
    expect(await screen.findByRole('heading', { name: 'Bed board' })).toBeInTheDocument();
    expect(
      screen.getByText('This screen is built in Phase 3 of the implementation plan.'),
    ).toBeInTheDocument();
    expect(screen.getByText('docs/ui-design/boards/Beds.dc.html')).toBeInTheDocument();
  });

  it('shows 404 for an unknown route', async () => {
    mockApi(signedIn(makeSession()));
    renderApp('/no/such/page');
    expect(await screen.findByRole('heading', { name: 'Page not found' })).toBeInTheDocument();
  });

  it('sends users who must enrol in two-factor sign-in to /setup-2fa', async () => {
    mockApi({
      ...signedIn(makeSession({ twoFactorSetupRequired: true })),
      'POST /auth/2fa/setup': () => [
        200,
        {
          secret: 'JBSWY3DPEHPK3PXP',
          otpauthUrl: 'otpauth://totp/HMS:test?secret=JBSWY3DPEHPK3PXP',
        },
      ],
    });
    const { router } = renderApp('/home');
    expect(
      await screen.findByRole('heading', { name: 'Set up two-factor sign-in' }),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/setup-2fa');
    expect(await screen.findByText('JBSW Y3DP EHPK 3PXP')).toBeInTheDocument();
    expect(
      screen.getByRole('img', { name: 'QR code for your authenticator app' }),
    ).toBeInTheDocument();
  });

  it('builds the menu from subscription and permission', async () => {
    mockApi(signedIn(makeSession({ panel: 'superadmin', modules: ['OPD'] })));
    renderApp('/home');
    await screen.findByRole('navigation', { name: 'Main menu' });
    await waitFor(() =>
      expect(screen.getAllByRole('link', { name: 'OPD Check-in' }).length).toBeGreaterThan(0),
    );
    expect(screen.queryByRole('link', { name: 'Bed Board' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Laboratory' })).toBeNull();
  });
});
