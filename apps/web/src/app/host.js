/*
 * One build serves two kinds of host:
 *  - the marketing host (the root domain, or www.<root>): public pricing and signup, no hospital;
 *  - a hospital host (<subdomain>.<root> or the hospital's own domain): the staff app.
 * The root domain comes from VITE_ROOT_DOMAIN (the API's ROOT_DOMAIN); `localhost` in development,
 * so http://localhost:5173 is the marketing site and http://demo.localhost:5173 the demo hospital.
 */
export const ROOT_DOMAIN = (import.meta.env.VITE_ROOT_DOMAIN || 'localhost').toLowerCase();

const bare = (hostname) =>
  String(hostname ?? '')
    .toLowerCase()
    .replace(/\.$/, '');

/** True for the root domain and www.<root>: serve the public pages there. */
export function isMarketingHost(hostname = globalThis.location?.hostname) {
  const h = bare(hostname);
  return h === ROOT_DOMAIN || h === `www.${ROOT_DOMAIN}`;
}

/** The marketing site's origin, for links from a hospital host ("Start a free trial"). */
export function marketingOrigin(loc = globalThis.location) {
  if (!loc) return `https://${ROOT_DOMAIN}`;
  const port = loc.port ? `:${loc.port}` : '';
  return `${loc.protocol}//${ROOT_DOMAIN}${port}`;
}

/** A hospital's web address shown in the signup form: demo.localhost:5173, demo.example.com. */
export function hospitalHost(subdomain, loc = globalThis.location) {
  const port = loc?.port ? `:${loc.port}` : '';
  return `${subdomain || '…'}.${ROOT_DOMAIN}${port}`;
}
