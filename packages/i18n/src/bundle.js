/**
 * A lazily loaded set of screen strings: `add(i18n)` merges the English and Hindi strings into an
 * i18next instance once. Screens call it when their chunk loads, so their strings stay out of
 * the first bundle (see admin.js for the admin screens).
 */
export function makeBundle(en, hi) {
  const added = new WeakSet();
  return function add(i18n) {
    if (!i18n || added.has(i18n)) return;
    i18n.addResourceBundle('en', 'translation', en, true, true);
    i18n.addResourceBundle('hi', 'translation', hi, true, true);
    added.add(i18n);
  };
}
