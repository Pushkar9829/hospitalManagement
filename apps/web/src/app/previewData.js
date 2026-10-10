/**
 * Preview data for screens whose API is not built yet, so every designed screen can be reviewed
 * with realistic content. On in development (turn off with VITE_PREVIEW_DATA=0), off in tests
 * and production builds unless VITE_PREVIEW_DATA=1. Only API paths that have a preview handler
 * are answered here; everything else goes to the real API. Handlers live in src/preview/*.js
 * and load in their own chunk.
 */
const flag = import.meta.env.VITE_PREVIEW_DATA;
export const PREVIEW_ENABLED =
  flag === '1' || (import.meta.env.DEV && import.meta.env.MODE !== 'test' && flag !== '0');

let registry = null;
function load() {
  registry ??= import('../preview/index.js').then((m) => m.compile());
  return registry;
}

/**
 * Answers a request from the preview handlers, or returns null when there is none.
 * Result: { data } or { error: { status, data } } like fetchBaseQuery. A handler returning
 * { __passthrough: true } sends that request on to the real API.
 */
export async function previewResponse(req) {
  if (!PREVIEW_ENABLED) return null;
  const url = new URL(req.url ?? '', 'http://preview.local');
  const method = (req.method ?? 'GET').toUpperCase();
  const match = (await load())(method, url.pathname);
  if (!match) return null;
  const query = Object.fromEntries(url.searchParams);
  Object.assign(query, req.params ?? {});
  const out = await match.handler({ method, params: match.params, query, body: req.body });
  // A handler may decline a request (e.g. a record that exists only in the real API).
  if (out && out.__passthrough) return null;
  if (out && out.__status >= 400)
    return { error: { status: out.__status, data: { error: out.error } } };
  return { data: out ?? null };
}
