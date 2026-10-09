/**
 * localStorage that never throws: private windows, blocked site data and quota errors return the
 * fallback instead of breaking the page.
 */
export const safeStorage = {
  get(key, fallback = null) {
    try {
      const raw = globalThis.localStorage?.getItem(key);
      return raw == null ? fallback : JSON.parse(raw);
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try {
      globalThis.localStorage?.setItem(key, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  },
  remove(key) {
    try {
      globalThis.localStorage?.removeItem(key);
    } catch {
      /* ignore */
    }
  },
  /** Every key that starts with `prefix`. */
  keys(prefix = '') {
    try {
      const ls = globalThis.localStorage;
      if (!ls) return [];
      const out = [];
      for (let i = 0; i < ls.length; i++) {
        const k = ls.key(i);
        if (k && k.startsWith(prefix)) out.push(k);
      }
      return out;
    } catch {
      return [];
    }
  },
};
