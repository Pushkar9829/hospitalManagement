export function isMac() {
  const nav = globalThis.navigator;
  return /Mac|iPhone|iPad/.test(nav?.userAgentData?.platform ?? nav?.platform ?? '');
}

/** Label for a key, with Mac symbols where they apply. */
export function keyLabel(key) {
  const k = String(key);
  if (/^(mod|ctrl)$/i.test(k)) return isMac() && /^mod$/i.test(k) ? '⌘' : 'Ctrl';
  if (/^alt$/i.test(k)) return isMac() ? '⌥' : 'Alt';
  if (/^shift$/i.test(k)) return 'Shift';
  if (/^(esc|escape)$/i.test(k)) return 'Esc';
  if (/^enter$/i.test(k)) return 'Enter';
  return k.length === 1 ? k.toUpperCase() : k;
}
