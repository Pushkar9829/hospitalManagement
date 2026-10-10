/**
 * Preview handler registry. Each module file exports `handlers`:
 *   { 'GET /opd/queue': ({ params, query, body }) => data, 'POST /opd/visits/:id/vitals': ... }
 * Paths are relative to /api/v1; a key may also name a full path outside it, such as
 * 'GET /api/platform/coupons' (the platform console). Return data, { __status: 4xx, error: { code,
 * message } }, or { __passthrough: true } to let the real API answer.
 * Never used in production builds (see app/previewData.js).
 */
const modules = import.meta.glob('./*.preview.js', { eager: true });

export function compile() {
  const routes = [];
  for (const mod of Object.values(modules)) {
    for (const [key, handler] of Object.entries(mod.handlers ?? {})) {
      const [method, path] = key.split(' ');
      const names = [];
      const re = new RegExp(
        `^${path.replace(/:[A-Za-z]+/g, (m) => {
          names.push(m.slice(1));
          return '([^/]+)';
        })}/?$`,
      );
      routes.push({ method, re, names, handler, specificity: path.replace(/:[^/]+/g, '').length });
    }
  }
  routes.sort((a, b) => b.specificity - a.specificity);
  return (method, pathname) => {
    const path = pathname.replace(/^\/api\/v1/, '');
    for (const r of routes) {
      if (r.method !== method) continue;
      const m = r.re.exec(path);
      if (m)
        return {
          handler: r.handler,
          params: Object.fromEntries(r.names.map((n, i) => [n, decodeURIComponent(m[i + 1])])),
        };
    }
    return null;
  };
}
