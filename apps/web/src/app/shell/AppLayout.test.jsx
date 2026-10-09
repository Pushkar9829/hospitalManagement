import { describe, expect, it } from 'vitest';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { errorBody, makeSession } from '../../test/fixtures.js';
import { mockApi, renderApp } from '../../test/renderApp.jsx';
import { sessionExpired, twoFactorSetupRequired } from '../sessionActions.js';

const signedIn = (session, extra = {}) =>
  mockApi({ 'GET /auth/me': () => [200, session], ...extra });

describe('AppLayout', () => {
  it('opens the command palette with Ctrl+K and navigates to a screen', async () => {
    signedIn(makeSession({ panel: 'superadmin' }));
    const { router } = renderApp('/home');
    await screen.findByRole('navigation', { name: 'Main menu' });
    fireEvent.keyDown(document.body, { key: 'k', ctrlKey: true });
    const input = await screen.findByPlaceholderText('Go to a screen or run an action…');
    const user = userEvent.setup();
    await user.type(input, 'Bed Board');
    await user.keyboard('{Enter}');
    await waitFor(() => expect(router.state.location.pathname).toBe('/ipd/beds'));
  });

  it('opens the shortcuts list with ?', async () => {
    signedIn(makeSession());
    renderApp('/home');
    await screen.findByRole('navigation', { name: 'Main menu' });
    fireEvent.keyDown(document.body, { key: '?', shiftKey: true });
    const dialog = await screen.findByRole('dialog', { name: 'Keyboard shortcuts' });
    expect(within(dialog).getByText('Open the command palette')).toBeInTheDocument();
    expect(within(dialog).getByText('Save the current form')).toBeInTheDocument();
  });

  it('shows the session-expired dialog over the page and keeps the page mounted', async () => {
    signedIn(makeSession({ panel: 'nurse', modules: ['IPD', 'NUR'], name: 'Anjali Menon' }));
    const { store, router } = renderApp('/home');
    await screen.findByRole('heading', { name: /Anjali/ });
    act(() => store.dispatch(sessionExpired({ reason: 'idle', minutes: 15 })));
    const dialog = await screen.findByRole('alertdialog', {
      name: 'You were signed out after 15 minutes idle',
    });
    expect(screen.getByRole('heading', { name: /Anjali/, hidden: true })).toBeInTheDocument();
    await userEvent.setup().click(within(dialog).getByRole('button', { name: 'Sign in again' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/login'));
    expect(router.state.location.search).toBe('?next=%2Fhome');
  });

  it('redirects to /setup-2fa when any call answers TWO_FACTOR_SETUP_REQUIRED', async () => {
    signedIn(makeSession(), {
      'POST /auth/2fa/setup': () => [
        200,
        { secret: 'JBSWY3DPEHPK3PXP', otpauthUrl: 'otpauth://totp/x' },
      ],
    });
    const { store, router } = renderApp('/home');
    await screen.findByRole('navigation', { name: 'Main menu' });
    act(() => store.dispatch(twoFactorSetupRequired()));
    await waitFor(() => expect(router.state.location.pathname).toBe('/setup-2fa'));
  });

  it('enables two-factor sign-in, refetches the session and continues home', async () => {
    let enrolled = false;
    const session = (done) =>
      makeSession({ panel: 'nurse', modules: ['IPD', 'NUR'], twoFactorSetupRequired: !done });
    signedIn(session(false), {
      'GET /auth/me': () => [200, session(enrolled)],
      'POST /auth/2fa/setup': () => [
        200,
        { secret: 'JBSWY3DPEHPK3PXP', otpauthUrl: 'otpauth://totp/x' },
      ],
      'POST /auth/2fa/enable': (_req, body) => {
        if (body.code !== '246810') return [422, errorBody('VALIDATION_FAILED', 'Wrong code')];
        enrolled = true;
        return [200, { enabled: true }];
      },
    });
    const { router } = renderApp('/setup-2fa');
    await screen.findByText('JBSW Y3DP EHPK 3PXP');
    const user = userEvent.setup();
    await user.click(screen.getAllByRole('textbox')[0]);
    await user.keyboard('111111');
    expect(await screen.findByText(/That code is not correct/)).toBeInTheDocument();
    await user.click(screen.getAllByRole('textbox')[0]);
    await user.keyboard('246810');
    await waitFor(() => expect(router.state.location.pathname).toBe('/home'));
  });

  it('signs out and returns to the login page', async () => {
    let out = false;
    const session = makeSession({ name: 'Arjun Rao' });
    signedIn(session, {
      'GET /auth/me': () => (out ? [401, errorBody('UNAUTHENTICATED')] : [200, session]),
      'POST /auth/refresh': () => [401, errorBody('UNAUTHENTICATED')],
      'POST /auth/logout': () => ((out = true), [204, undefined]),
    });
    const { router } = renderApp('/home');
    await screen.findByRole('navigation', { name: 'Main menu' });
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Account menu for Arjun Rao' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Sign out' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/login'));
  });
});
