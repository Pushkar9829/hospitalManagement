import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import { sessionExpired, twoFactorSetupRequired } from './sessionActions.js';

/** Same origin as the app. Built as an absolute URL so it also works under jsdom in tests. */
export const API_BASE = `${globalThis.location?.origin ?? 'http://localhost'}/api/v1`;

const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/** Calls that never trigger a token refresh: they are the sign-in flow itself. */
const NO_REFRESH = [
  '/auth/login',
  '/auth/refresh',
  '/auth/logout',
  '/auth/2fa/verify',
  '/auth/otp/request',
  '/auth/otp/verify',
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
 * user was signed in, the session is marked expired; the page stays mounted so drafts are kept.
 */
export async function baseQueryWithReauth(args, api, extraOptions) {
  const req = withIdempotency(args);
  let result = await rawBaseQuery(req, api, extraOptions);
  const err = result.error;
  const code = err?.data?.error?.code;

  if (err?.status === 401 && REFRESHABLE_CODES.has(code) && !NO_REFRESH.includes(req.url)) {
    const refreshed = await refreshOnce(api, extraOptions);
    if (!refreshed.error) {
      result = await rawBaseQuery(req, api, extraOptions);
    } else if (api.getState().session?.status === 'authenticated') {
      api.dispatch(sessionExpired({ reason: 'token' }));
    }
  } else if (err?.status === 403 && code === 'TWO_FACTOR_SETUP_REQUIRED') {
    api.dispatch(twoFactorSetupRequired());
  }
  return result;
}

/** The one RTK Query API. Modules add endpoints with baseApi.injectEndpoints(). */
export const baseApi = createApi({
  reducerPath: 'api',
  baseQuery: baseQueryWithReauth,
  tagTypes: ['Session'],
  endpoints: () => ({}),
});
