import { createAction } from '@reduxjs/toolkit';

/**
 * Session ended without the user signing out (idle timeout here or on the server, refresh
 * failed). Drafts are kept. `message` is the server's explanation when it gave one.
 */
export const sessionExpired = createAction('session/expired', (payload = {}) => ({
  payload: {
    reason: payload.reason ?? 'token',
    minutes: payload.minutes ?? null,
    message: payload.message ?? null,
  },
}));

/** The user signed out. */
export const signedOut = createAction('session/signedOut');

/** The API answered 403 TWO_FACTOR_SETUP_REQUIRED: send the user to /setup-2fa. */
export const twoFactorSetupRequired = createAction('session/twoFactorSetupRequired');

/** The API answered 403 PASSWORD_CHANGE_REQUIRED: send the user to /change-password. */
export const passwordChangeRequired = createAction('session/passwordChangeRequired');
