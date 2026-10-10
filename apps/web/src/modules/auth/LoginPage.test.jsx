import { describe, expect, it } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { errorBody, makeSession } from '../../test/fixtures.js';
import { mockApi, renderApp } from '../../test/renderApp.jsx';

const anonymous = {
  'GET /auth/me': () => [401, errorBody('UNAUTHENTICATED')],
  'POST /auth/refresh': () => [401, errorBody('UNAUTHENTICATED')],
};

async function openLogin(handlers, path = '/login') {
  const fetchMock = mockApi({ ...anonymous, ...handlers });
  const utils = renderApp(path);
  await screen.findByRole('heading', { name: 'Sign in' });
  return { ...utils, fetchMock, user: userEvent.setup() };
}

const loginCalls = (fetchMock) =>
  fetchMock.mock.calls.filter(([req]) => req.url.endsWith('/auth/login'));

describe('LoginPage', () => {
  it('validates with the shared Zod schema before calling the API', async () => {
    const { user, fetchMock } = await openLogin({});
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    const username = screen.getByLabelText(/Username or mobile/);
    expect(username).toHaveAttribute('aria-invalid', 'true');
    expect(username).toHaveAccessibleDescription('Enter your username or mobile');
    expect(screen.getByLabelText(/^Password/, { selector: 'input' })).toHaveAccessibleDescription(
      'Enter your password',
    );
    expect(loginCalls(fetchMock)).toHaveLength(0);
  });

  it('shows a generic message for 401 that does not reveal whether the user exists', async () => {
    const { user } = await openLogin({
      'POST /auth/login': () => [401, errorBody('INVALID_CREDENTIALS', 'No such user')],
    });
    await user.type(screen.getByLabelText(/Username or mobile/), 'someone');
    await user.type(screen.getByLabelText(/^Password/, { selector: 'input' }), 'wrong-password');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('The username or password is not correct.');
    expect(alert).not.toHaveTextContent('No such user');
  });

  it('shows the lockout message for 423', async () => {
    const { user } = await openLogin({
      'POST /auth/login': () => [
        423,
        errorBody('ACCOUNT_LOCKED', 'Try again in 15 minutes or ask your administrator.'),
      ],
    });
    await user.type(screen.getByLabelText(/Username or mobile/), 'anita.sharma');
    await user.type(screen.getByLabelText(/^Password/, { selector: 'input' }), 'secret');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('This account is locked');
    expect(alert).toHaveTextContent('Try again in 15 minutes');
  });

  it('puts 422 details under their fields', async () => {
    const { user } = await openLogin({
      'POST /auth/login': () => [
        422,
        errorBody('VALIDATION_FAILED', 'Invalid', {
          details: [{ path: 'username', message: 'This username is not allowed' }],
        }),
      ],
    });
    await user.type(screen.getByLabelText(/Username or mobile/), 'anita.sharma');
    await user.type(screen.getByLabelText(/^Password/, { selector: 'input' }), 'secret');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    await waitFor(() =>
      expect(screen.getByLabelText(/Username or mobile/)).toHaveAccessibleDescription(
        'This username is not allowed',
      ),
    );
  });

  it('sends the normalised body with an idempotency key, then continues to next', async () => {
    const session = makeSession({ panel: 'nurse', modules: ['IPD', 'NUR'], name: 'Anjali Menon' });
    let body;
    const { user, router, fetchMock } = await openLogin(
      { 'POST /auth/login': (_req, b) => ((body = b), [200, session]) },
      `/login?next=${encodeURIComponent('/ipd/beds')}`,
    );
    await user.type(screen.getByLabelText(/Username or mobile/), '  Anjali.Menon ');
    await user.type(screen.getByLabelText(/^Password/, { selector: 'input' }), 'Demo@12345');
    await user.click(screen.getByLabelText('Remember this device for 7 days'));
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/ipd/beds'));
    expect(body).toEqual({
      username: 'anjali.menon',
      password: 'Demo@12345',
      rememberDevice: true,
    });
    const [req] = loginCalls(fetchMock)[0];
    expect(req.headers.get('Idempotency-Key')).toMatch(/[0-9a-f-]{36}/);
  });

  it('asks for the 2FA code, accepts a pasted code and signs in', async () => {
    const session = makeSession({ panel: 'superadmin', name: 'Arjun Rao' });
    let verified;
    const { user, router } = await openLogin({
      'POST /auth/login': () => [200, { twoFactorRequired: true, challengeId: 'c'.repeat(24) }],
      'POST /auth/2fa/verify': (_req, b) => ((verified = b), [200, session]),
    });
    await user.type(screen.getByLabelText(/Username or mobile/), 'superadmin');
    await user.type(screen.getByLabelText(/^Password/, { selector: 'input' }), 'Demo@12345');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    await screen.findByRole('heading', { name: 'Two-step verification' });
    const first = screen.getAllByRole('textbox')[0];
    expect(first).toHaveFocus();
    await user.paste('123 456');
    await waitFor(() => expect(router.state.location.pathname).toBe('/'));
    expect(verified).toEqual({ challengeId: 'c'.repeat(24), code: '123456' });
  });

  it('signs in with a mobile OTP', async () => {
    const session = makeSession({ panel: 'nurse', modules: ['IPD', 'NUR'] });
    const { user, router } = await openLogin({
      'POST /auth/otp/request': () => [202, { expiresInSec: 300 }],
      'POST /auth/otp/verify': () => [200, session],
    });
    await user.click(screen.getByRole('tab', { name: 'Mobile OTP' }));
    await user.type(screen.getByLabelText(/Mobile number/), '12345');
    await user.click(screen.getByRole('button', { name: 'Send OTP' }));
    expect(screen.getByLabelText(/Mobile number/)).toHaveAccessibleDescription(
      /Enter a 10-digit mobile number/,
    );
    await user.clear(screen.getByLabelText(/Mobile number/));
    await user.type(screen.getByLabelText(/Mobile number/), '98765 43210');
    await user.click(screen.getByRole('button', { name: 'Send OTP' }));
    expect(await screen.findByText(/We sent a 6-digit code to 9876543210/)).toBeInTheDocument();
    await user.keyboard('654321');
    await waitFor(() => expect(router.state.location.pathname).toBe('/home'));
  });

  it('links to the forgot password page', async () => {
    const { user } = await openLogin({});
    await user.click(screen.getByRole('link', { name: 'Forgot password?' }));
    expect(
      await screen.findByRole('heading', { name: 'Forgot your password?' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Send code' })).toBeInTheDocument();
  });
});
