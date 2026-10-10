import { describe, expect, it } from 'vitest';
import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { errorBody, makeSession } from '../../test/fixtures.js';
import { mockApi, renderApp } from '../../test/renderApp.jsx';

const anonymous = {
  'GET /auth/me': () => [401, errorBody('UNAUTHENTICATED')],
  'POST /auth/refresh': () => [401, errorBody('UNAUTHENTICATED')],
};

describe('Forced password change', () => {
  it('sends a user who must change their password to /change-password, then home', async () => {
    let changed = false;
    let body;
    const session = () =>
      makeSession({ panel: 'nurse', modules: ['IPD', 'NUR'], mustChangePassword: !changed });
    mockApi({
      'GET /auth/me': () => [200, session()],
      'POST /auth/password': (_req, b) => {
        body = b;
        if (b.currentPassword !== 'Temp#Pass2026')
          return [
            422,
            errorBody('VALIDATION_FAILED', 'Current password is incorrect', {
              details: [{ path: 'currentPassword', message: 'Current password is incorrect' }],
            }),
          ];
        changed = true;
        return [204, undefined];
      },
    });
    const { router } = renderApp('/ipd/beds');
    await screen.findByRole('heading', { name: 'Choose a new password' });
    expect(router.state.location.pathname).toBe('/change-password');
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/^Current password/), 'wrong');
    await user.type(screen.getByLabelText(/^New password/), 'short');
    await user.type(screen.getByLabelText(/^Type the new password again/), 'short');
    await user.click(screen.getByRole('button', { name: 'Save and continue' }));
    expect(screen.getByLabelText(/^New password/)).toHaveAccessibleDescription(
      /Use at least 10 characters/,
    );
    expect(screen.getByText('At least 10 characters').closest('li')).toHaveTextContent('not yet');
    await user.clear(screen.getByLabelText(/^New password/));
    await user.type(screen.getByLabelText(/^New password/), 'Mine#Pass2026');
    await user.clear(screen.getByLabelText(/^Type the new password again/));
    await user.type(screen.getByLabelText(/^Type the new password again/), 'Mine#Pass2026');
    await user.click(screen.getByRole('button', { name: 'Save and continue' }));
    await waitFor(() =>
      expect(screen.getByLabelText(/^Current password/)).toHaveAccessibleDescription(
        'Current password is incorrect',
      ),
    );
    await user.clear(screen.getByLabelText(/^Current password/));
    await user.type(screen.getByLabelText(/^Current password/), 'Temp#Pass2026');
    await user.click(screen.getByRole('button', { name: 'Save and continue' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/home'));
    expect(body).toEqual({ currentPassword: 'Temp#Pass2026', newPassword: 'Mine#Pass2026' });
  });

  it('redirects when any call answers 403 PASSWORD_CHANGE_REQUIRED', async () => {
    mockApi({
      'GET /auth/me': () => [200, makeSession({ panel: 'superadmin' })],
      'GET /approvals/count': () => [403, errorBody('PASSWORD_CHANGE_REQUIRED')],
      'GET /approvals': () => [403, errorBody('PASSWORD_CHANGE_REQUIRED')],
    });
    const { router } = renderApp('/approvals');
    await waitFor(() => expect(router.state.location.pathname).toBe('/change-password'));
  });
});

describe('Change password from the account menu', () => {
  it('opens a dialog and keeps the user signed in', async () => {
    mockApi({
      'GET /auth/me': () => [200, makeSession({ name: 'Arjun Rao' })],
      'GET /approvals/count': () => [200, { inbox: 0 }],
      'POST /auth/password': () => [204, undefined],
    });
    renderApp('/home');
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Account menu for Arjun Rao' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Change password' }));
    const dialog = await screen.findByRole('dialog', { name: 'Change password' });
    await user.type(within(dialog).getByLabelText(/^Current password/), 'Old#Pass2026');
    await user.type(within(dialog).getByLabelText(/^New password/), 'New#Pass2026');
    await user.type(within(dialog).getByLabelText(/^Type the new password again/), 'New#Pass2026x');
    await user.click(within(dialog).getByRole('button', { name: 'Change password' }));
    expect(within(dialog).getByText('The two passwords do not match')).toBeInTheDocument();
    await user.type(within(dialog).getByLabelText(/^Type the new password again/), '{Backspace}');
    await user.click(within(dialog).getByRole('button', { name: 'Change password' }));
    expect(
      await screen.findByText('Password changed. Your other devices were signed out.'),
    ).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });
});

describe('Forgot password', () => {
  it('sends a code, rejects a wrong one, resets and returns to sign-in with the username', async () => {
    let resetBody;
    const { router } = (() => {
      mockApi({
        ...anonymous,
        'POST /auth/password/forgot': () => [202, { expiresInSec: 600 }],
        'POST /auth/password/reset': (_req, b) => {
          resetBody = b;
          return b.code === '123456' ? [204, undefined] : [401, errorBody('INVALID_CREDENTIALS')];
        },
      });
      return renderApp('/forgot-password');
    })();
    const user = userEvent.setup();
    await screen.findByRole('heading', { name: 'Forgot your password?' });
    await user.type(screen.getByLabelText(/^Username or mobile/), 'Anjali.Menon');
    await user.click(screen.getByRole('button', { name: 'Send code' }));
    expect(
      await screen.findByText(/If anjali.menon has a registered mobile, we sent a 6-digit code/),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Resend in \d+ s/ })).toBeDisabled();
    await user.keyboard('654321');
    await user.type(screen.getByLabelText(/^New password/), 'Fresh#Pass2026');
    await user.type(screen.getByLabelText(/^Type the new password again/), 'Fresh#Pass2026');
    await user.click(screen.getByRole('button', { name: 'Set new password' }));
    expect(await screen.findByText(/The code is not correct or has expired/)).toBeInTheDocument();
    await user.click(screen.getAllByRole('textbox', { name: /Digit 1 of 6/ })[0]);
    await user.keyboard('123456');
    await user.click(screen.getByRole('button', { name: 'Set new password' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/login'));
    expect(resetBody).toEqual({
      username: 'anjali.menon',
      code: '123456',
      newPassword: 'Fresh#Pass2026',
    });
    expect(await screen.findByText(/Your password was changed/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Username or mobile/)).toHaveValue('anjali.menon');
  });
});

describe('Invitation', () => {
  it('shows who it is for, sets the password and continues to sign in', async () => {
    const token = 't'.repeat(32);
    let body;
    mockApi({
      ...anonymous,
      [`GET /auth/invite/${token}`]: () => [
        200,
        { name: 'Ravi Iyer', username: 'ravi.iyer', hospital: 'Demo Hospital' },
      ],
      'POST /auth/invite/accept': (_req, b) => ((body = b), [200, { username: 'ravi.iyer' }]),
    });
    const { router } = renderApp(`/welcome?token=${token}`);
    await screen.findByRole('heading', { name: 'Welcome to Demo Hospital' });
    expect(screen.getByText('ravi.iyer')).toBeInTheDocument();
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/^New password/), 'Ravi#Pass2026');
    await user.type(screen.getByLabelText(/^Type the new password again/), 'Ravi#Pass2026');
    await user.click(screen.getByRole('button', { name: 'Set password' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/login'));
    expect(body).toEqual({ token, newPassword: 'Ravi#Pass2026' });
    expect(await screen.findByLabelText(/Username or mobile/)).toHaveValue('ravi.iyer');
    expect(screen.getByText('Your password is set. Sign in to continue.')).toBeInTheDocument();
  });

  it('says when an invitation has expired (410)', async () => {
    const token = 'e'.repeat(32);
    mockApi({
      ...anonymous,
      [`GET /auth/invite/${token}`]: () => [
        410,
        errorBody('INVITE_EXPIRED', 'This invitation has expired or was already used.'),
      ],
    });
    renderApp(`/welcome?token=${token}`);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'This invitation cannot be used. This invitation has expired or was already used.',
    );
  });
});

describe('Server idle sign-out', () => {
  it('shows the server message when the refresh answers SESSION_IDLE', async () => {
    let expired = false;
    mockApi({
      'GET /auth/me': () => [
        200,
        makeSession({ panel: 'nurse', modules: ['IPD', 'NUR'], name: 'Anjali Menon' }),
      ],
      'GET /approvals/count': () => [200, { inbox: 0 }],
      'GET /approvals': () =>
        expired
          ? [401, errorBody('TOKEN_INVALID')]
          : [200, { items: [], page: 1, limit: 20, total: 0 }],
      'POST /auth/refresh': () => [
        401,
        errorBody(
          'SESSION_IDLE',
          'You were signed out after 15 minutes without activity. Please sign in again.',
        ),
      ],
    });
    const { store } = renderApp('/home');
    await screen.findByRole('heading', { name: /Anjali/ });
    expired = true;
    const { approvalsApi } = await import('../approvals/api.js');
    await act(() => store.dispatch(approvalsApi.endpoints.approvals.initiate({ box: 'inbox' })));
    const dialog = await screen.findByRole('alertdialog', {
      name: 'You were signed out after 15 minutes idle',
    });
    expect(dialog).toHaveTextContent('You were signed out after 15 minutes without activity.');
    expect(dialog).toHaveTextContent('Your unsaved work has been kept on this device.');
  });
});
