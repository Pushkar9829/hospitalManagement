import { render } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { initReactI18next } from 'react-i18next';
import { vi } from 'vitest';
import { createI18n } from '@hms/i18n';
import { createStore } from '../app/store.js';
import { routes } from '../app/router.jsx';
import { Providers } from '../app/providers.jsx';

/**
 * Mocks window.fetch with a table of handlers: { 'GET /auth/me': (req, body) => [status, json] }.
 * Unknown calls answer 404 so a test never reaches the network. Returns the vi.fn.
 */
export function mockApi(handlers) {
  const fetchMock = vi.fn(async (input, init) => {
    const req = input instanceof Request ? input : new Request(input, init);
    const url = new URL(req.url);
    const key = `${req.method} ${url.pathname.replace(/^\/api\/v1/, '')}`;
    const text = await req.text();
    const body = text ? JSON.parse(text) : undefined;
    const handler = handlers[key];
    const [status, json] = handler
      ? await handler(req, body)
      : [404, { error: { code: 'NOT_FOUND', message: key } }];
    return new Response(json === undefined ? null : JSON.stringify(json), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

/** Renders the real route table at `path` with a fresh store. */
export function renderApp(path = '/') {
  const i18n = createI18n('en', { plugins: [initReactI18next] });
  const store = createStore();
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  const utils = render(
    <Providers store={store} i18n={i18n}>
      <RouterProvider router={router} />
    </Providers>,
  );
  return { ...utils, store, router };
}
