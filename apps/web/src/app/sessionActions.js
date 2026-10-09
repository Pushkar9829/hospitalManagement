import { createAction } from '@reduxjs/toolkit';

/** Session ended without the user signing out (idle timeout, refresh failed). Drafts are kept. */
export const sessionExpired = createAction('session/expired', (payload = {}) => ({
  payload: { reason: payload.reason ?? 'token', minutes: payload.minutes ?? null },
}));

/** The user signed out. */
export const signedOut = createAction('session/signedOut');

/** The API answered 403 TWO_FACTOR_SETUP_REQUIRED: send the user to /setup-2fa. */
export const twoFactorSetupRequired = createAction('session/twoFactorSetupRequired');
