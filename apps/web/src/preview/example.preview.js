/** Smallest example handler; module agents add their own `<module>.preview.js` files. */
export const handlers = {
  'GET /preview/ping': () => ({ ok: true }),
};
