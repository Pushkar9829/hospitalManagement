import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import { previewResponse } from './previewData.js';
import {
  passwordChangeRequired,
  sessionExpired,
  twoFactorSetupRequired,
} from './sessionActions.js';

/** Same origin as the app. Built as an absolute URL so it also works under jsdom in tests. */
export const API_BASE = `${globalThis.location?.origin ?? 'http://localhost'}/api/v1`;

/** Public signup API (no hospital): endpoints use absolute URLs under it, which skip API_BASE. */
export const PUBLIC_BASE = `${globalThis.location?.origin ?? 'http://localhost'}/api/public`;

const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/** Calls that never trigger a token refresh: they are the sign-in flow itself. */
const NO_REFRESH = [
  '/auth/login',
  '/auth/refresh',
  '/auth/logout',
  '/auth/2fa/verify',
  '/auth/otp/request',
  '/auth/otp/verify',
  '/auth/password/forgot',
  '/auth/password/reset',
  '/auth/invite/accept',
];

const REFRESHABLE_CODES = new Set(['TOKEN_INVALID', 'UNAUTHENTICATED']);

const rawBaseQuery = fetchBaseQuery({
  baseUrl: API_BASE,
  credentials: 'same-origin',
  prepareHeaders: (headers, { getState }) => {
    const branchId = getState().session?.data?.branch?.id;
    if (branchId && !headers.has('x-branch-id')) headers.set('x-branch-id', branchId);
    headers.set('Accept', 'application/json');
    return headers;
  },
});

function newIdempotencyKey() {
  return (
    globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`
  );
}

/**
 * Adds an Idempotency-Key to every write. Pass `idempotencyKey` in the request args to reuse the
 * key of the same user action (a retry after a network error must send the same key).
 */
export function withIdempotency(args) {
  const req = typeof args === 'string' ? { url: args } : { ...args };
  const method = (req.method ?? 'GET').toUpperCase();
  if (WRITE_METHODS.has(method)) {
    const headers = new Headers(req.headers ?? {});
    if (!headers.has('Idempotency-Key')) {
      headers.set('Idempotency-Key', req.idempotencyKey ?? newIdempotencyKey());
    }
    req.headers = headers;
  }
  delete req.idempotencyKey;
  return req;
}

let refreshing = null;

/** One refresh at a time: parallel 401s wait for the same refresh call. */
function refreshOnce(api, extraOptions) {
  refreshing ??= Promise.resolve(
    rawBaseQuery(withIdempotency({ url: '/auth/refresh', method: 'POST' }), api, extraOptions),
  ).finally(() => {
    refreshing = null;
  });
  return refreshing;
}

/**
 * Base query: x-branch-id and Idempotency-Key headers; on 401 TOKEN_INVALID / UNAUTHENTICATED
 * it refreshes once and retries the call (same idempotency key). If the refresh fails while the
 * user was signed in, the session is marked expired (SESSION_IDLE: signed out for inactivity);
 * the page stays mounted so drafts are kept. 403 TWO_FACTOR_SETUP_REQUIRED and
 * PASSWORD_CHANGE_REQUIRED send the user to the matching set-up screen.
 */
export async function baseQueryWithReauth(args, api, extraOptions) {
  const req = withIdempotency(args);
  const preview = await previewResponse(typeof args === 'string' ? { url: args } : args);
  if (preview) return preview;
  let result = await rawBaseQuery(req, api, extraOptions);
  const err = result.error;
  const code = err?.data?.error?.code;

  // Absolute URLs (the public signup API) have no session to refresh.
  const isSessionCall = !/^https?:/i.test(req.url ?? '') && !NO_REFRESH.includes(req.url);
  if (err?.status === 401 && REFRESHABLE_CODES.has(code) && isSessionCall) {
    const refreshed = await refreshOnce(api, extraOptions);
    if (!refreshed.error) {
      result = await rawBaseQuery(req, api, extraOptions);
    } else if (api.getState().session?.status === 'authenticated') {
      const refreshError = refreshed.error.data?.error;
      // SESSION_IDLE: the server signed the user out for inactivity (e.g. in another tab).
      const idle = refreshError?.code === 'SESSION_IDLE';
      api.dispatch(
        sessionExpired({
          reason: idle ? 'idle' : 'token',
          minutes: idle ? (api.getState().session.data?.idleTimeoutMin ?? null) : null,
          message: idle ? (refreshError.message ?? null) : null,
        }),
      );
    }
  } else if (err?.status === 403 && code === 'TWO_FACTOR_SETUP_REQUIRED') {
    api.dispatch(twoFactorSetupRequired());
  } else if (err?.status === 403 && code === 'PASSWORD_CHANGE_REQUIRED') {
    api.dispatch(passwordChangeRequired());
  }
  return result;
}

/** The one RTK Query API. Modules add endpoints with baseApi.injectEndpoints(). */
export const baseApi = createApi({
  reducerPath: 'api',
  baseQuery: baseQueryWithReauth,
  tagTypes: [
    'Session',
    'Settings',
    'Entities',
    'Branches',
    'NumberSeries',
    'ApprovalRules',
    'Departments',
    'Masters',
    'Approvals',
    'ApprovalCount',
    'Audit',
    'Users',
    'Roles',
    'Patients',
    'Bills',
    'Payments',
    'Deposits',
    'Refunds',
    'Shift',
    'Shifts',
    'Subscription',
    'PlatformSession',
    'PlatformPlans',
    'PlatformTenants',
    'PlatformInvoices',
    'PlatformInsights',
    'PlatformLeads',
    'PlatformCoupons',
    'PlatformDunning',
    'PlatformUsage',
    'PlatformSupport',
    'PlatformFlags',
    'PlatformUsers',
  ],
  endpoints: () => ({}),
});
