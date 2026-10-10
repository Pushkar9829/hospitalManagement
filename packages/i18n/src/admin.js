import { adminModulesEn } from './admin.en.js';
import { adminModulesHi } from './admin.hi.js';

export { adminModulesEn, adminModulesHi };

const added = new WeakSet();

/**
 * Adds the admin screens' strings (settings, masters, approvals, audit, users, roles) to an
 * i18next instance. The screens call it when they load, so these strings stay out of the first
 * bundle. Safe to call on every render: each instance gets them once.
 */
export function addAdminStrings(i18n) {
  if (!i18n || added.has(i18n)) return;
  i18n.addResourceBundle('en', 'translation', adminModulesEn, true, true);
  i18n.addResourceBundle('hi', 'translation', adminModulesHi, true, true);
  added.add(i18n);
}
