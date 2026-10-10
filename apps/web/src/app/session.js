import { createSlice, isAnyOf } from '@reduxjs/toolkit';
import { authApi } from '../modules/auth/api.js';
import {
  passwordChangeRequired,
  sessionExpired,
  signedOut,
  twoFactorSetupRequired,
} from './sessionActions.js';

/**
 * status: 'loading' (checking /auth/me) | 'authenticated' | 'anonymous' | 'expired'.
 * When expired, `data` is kept so the page underneath (and its form draft) stays mounted.
 */
const initialState = { status: 'loading', data: null, expired: null };

const isSession = (payload) => Boolean(payload?.user && payload?.tenant);

const sessionResponses = isAnyOf(
  authApi.endpoints.me.matchFulfilled,
  authApi.endpoints.login.matchFulfilled,
  authApi.endpoints.verifyTwoFactor.matchFulfilled,
  authApi.endpoints.verifyOtp.matchFulfilled,
  authApi.endpoints.switchBranch.matchFulfilled,
);

const slice = createSlice({
  name: 'session',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(sessionExpired, (state, { payload }) => {
        if (state.status !== 'authenticated') return;
        state.status = 'expired';
        state.expired = payload;
      })
      .addCase(signedOut, () => ({ ...initialState, status: 'anonymous' }))
      .addCase(twoFactorSetupRequired, (state) => {
        if (state.data) state.data.user.twoFactorSetupRequired = true;
      })
      .addCase(passwordChangeRequired, (state) => {
        if (state.data) state.data.user.mustChangePassword = true;
      })
      .addMatcher(authApi.endpoints.me.matchRejected, (state, { meta }) => {
        if (meta.condition) return;
        if (state.status === 'loading') state.status = 'anonymous';
      })
      .addMatcher(sessionResponses, (state, { payload }) => {
        if (!isSession(payload)) return; // a 2FA challenge, not a session
        state.status = 'authenticated';
        state.data = payload;
        state.expired = null;
      });
  },
});

export const sessionReducer = slice.reducer;

export const selectSession = (state) => state.session;
