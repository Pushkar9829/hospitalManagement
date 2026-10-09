import { describe, expect, it } from 'vitest';
import { createStore, authApi } from './store.js';
import { baseApi } from './baseApi.js';
import { errorBody, makeSession } from '../test/fixtures.js';
import { mockApi } from '../test/renderApp.jsx';

const probe = baseApi.injectEndpoints({
  endpoints: (b) => ({
    probe: b.query({ query: () => '/probe' }),
    save: b.mutation({ query: (body) => ({ url: '/things', method: 'POST', body }) }),
  }),
});

async function signedInStore(session = makeSession()) {
  const store = createStore();
  await store.dispatch(authApi.endpoints.me.initiate());
  expect(store.getState().session.status).toBe('authenticated');
  return { store, session };
}

describe('baseApi', () => {
  it('refreshes once on 401 TOKEN_INVALID and retries the call', async () => {
    let probeCalls = 0;
    const fetchMock = mockApi({
      'GET /auth/me': () => [200, makeSession()],
      'POST /auth/refresh': () => [200, { ok: true }],
      'GET /probe': () =>
        ++probeCalls === 1 ? [401, errorBody('TOKEN_INVALID')] : [200, { ok: 1 }],
    });
    const { store } = await signedInStore();
    const res = await store.dispatch(probe.endpoints.probe.initiate());
    expect(res.data).toEqual({ ok: 1 });
    expect(fetchMock.mock.calls.filter(([r]) => r.url.endsWith('/auth/refresh'))).toHaveLength(1);
  });

  it('shares one refresh between parallel 401s', async () => {
    let refreshed = false;
    const fetchMock = mockApi({
      'GET /auth/me': () => [200, makeSession()],
      'POST /auth/refresh': async () => {
        await new Promise((r) => setTimeout(r, 20));
        refreshed = true;
        return [200, { ok: true }];
      },
      'GET /probe': () => (refreshed ? [200, { ok: 1 }] : [401, errorBody('TOKEN_INVALID')]),
      'POST /things': () => (refreshed ? [201, { id: 1 }] : [401, errorBody('UNAUTHENTICATED')]),
    });
    const { store } = await signedInStore();
    await Promise.all([
      store.dispatch(probe.endpoints.probe.initiate()),
      store.dispatch(probe.endpoints.save.initiate({ a: 1 })),
    ]);
    expect(fetchMock.mock.calls.filter(([r]) => r.url.endsWith('/auth/refresh'))).toHaveLength(1);
  });

  it('marks the session expired when the refresh fails, keeping the session data', async () => {
    mockApi({
      'GET /auth/me': () => [200, makeSession()],
      'POST /auth/refresh': () => [401, errorBody('UNAUTHENTICATED')],
      'GET /probe': () => [401, errorBody('TOKEN_INVALID')],
    });
    const { store } = await signedInStore();
    await store.dispatch(probe.endpoints.probe.initiate());
    const s = store.getState().session;
    expect(s.status).toBe('expired');
    expect(s.data).not.toBeNull();
  });

  it('does not refresh for a failed login', async () => {
    const fetchMock = mockApi({
      'POST /auth/login': () => [401, errorBody('UNAUTHENTICATED')],
    });
    const store = createStore();
    await store.dispatch(authApi.endpoints.login.initiate({ username: 'x', password: 'y' }));
    expect(fetchMock.mock.calls.some(([r]) => r.url.endsWith('/auth/refresh'))).toBe(false);
  });

  it('sends Idempotency-Key on writes (kept on retry) and x-branch-id when a branch is selected', async () => {
    let attempt = 0;
    const fetchMock = mockApi({
      'GET /auth/me': () => [200, makeSession()],
      'POST /auth/refresh': () => [200, { ok: true }],
      'POST /things': () =>
        ++attempt === 1 ? [401, errorBody('TOKEN_INVALID')] : [201, { id: 1 }],
      'GET /probe': () => [200, {}],
    });
    const { store, session } = await signedInStore();
    await store.dispatch(probe.endpoints.save.initiate({ a: 1 }));
    await store.dispatch(probe.endpoints.probe.initiate());
    const writes = fetchMock.mock.calls.map(([r]) => r).filter((r) => r.url.endsWith('/things'));
    expect(writes).toHaveLength(2);
    const key = writes[0].headers.get('Idempotency-Key');
    expect(key).toBeTruthy();
    expect(writes[1].headers.get('Idempotency-Key')).toBe(key);
    expect(writes[0].headers.get('x-branch-id')).toBe(session.branch.id);
    const read = fetchMock.mock.calls.map(([r]) => r).find((r) => r.url.endsWith('/probe'));
    expect(read.headers.get('Idempotency-Key')).toBeNull();
  });

  it('flags two-factor enrolment on 403 TWO_FACTOR_SETUP_REQUIRED', async () => {
    mockApi({
      'GET /auth/me': () => [200, makeSession()],
      'GET /probe': () => [403, errorBody('TWO_FACTOR_SETUP_REQUIRED')],
    });
    const { store } = await signedInStore();
    await store.dispatch(probe.endpoints.probe.initiate());
    expect(store.getState().session.data.user.twoFactorSetupRequired).toBe(true);
  });
});
