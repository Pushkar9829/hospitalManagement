/** Signup helpers shared by the wizard and its tests. */

/** Version of the terms the person accepts (stored with the signup). */
export const TERMS_VERSION = '2026-10';
export const SUBDOMAIN = /^[a-z0-9](?:[a-z0-9-]{1,30}[a-z0-9])$/;
export const RESEND_AFTER_SEC = 30;

/** "St. Mary's Hospital, Pune" -> "st-marys-hospital-pune" (max 32), a first suggestion. */
export function suggestSubdomain(name) {
  return String(name ?? '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 32)
    .replace(/^-|-$/g, '');
}
