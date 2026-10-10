import { IST } from '@hms/ui';
import { inr } from '../../lib/money.js';

/** "09 Oct 2026" in IST. */
export function fmtDate(value, locale = 'en-IN') {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat(locale, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: IST,
  }).format(d);
}

/** "09 Oct 2026, 14:05" in IST, 24-hour. */
export function fmtDateTime(value, locale = 'en-IN') {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const time = new Intl.DateTimeFormat(locale, {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone: IST,
  }).format(d);
  return `${fmtDate(d, locale)}, ${time}`;
}

/** "Oct 2026" in IST. */
export function fmtMonth(value, locale = 'en-IN') {
  if (!value) return '';
  return new Intl.DateTimeFormat(locale, { month: 'short', year: 'numeric', timeZone: IST }).format(
    new Date(value),
  );
}

/** Revenue in lakh and crore for KPIs: ₹18.4 L, ₹2.21 Cr; below a lakh the full amount. */
export function compactInr(paise) {
  if (paise == null) return '';
  const rupees = paise / 100;
  if (Math.abs(rupees) >= 1e7) return `₹${(rupees / 1e7).toFixed(2)} Cr`;
  if (Math.abs(rupees) >= 1e5) return `₹${(rupees / 1e5).toFixed(1)} L`;
  return inr(paise);
}

/** Whole days from now until `iso` (negative once passed). */
export function daysUntil(iso, now = Date.now()) {
  if (!iso) return null;
  return Math.ceil((new Date(iso).getTime() - now) / 86_400_000);
}

export const localeOf = (i18n) => (i18n.language === 'hi' ? 'hi-IN' : 'en-IN');

export const TENANT_STATUSES = ['TRIAL', 'ACTIVE', 'PAST_DUE', 'READ_ONLY', 'SUSPENDED', 'CLOSED'];

export const TENANT_TONES = {
  TRIAL: 'accent',
  ACTIVE: 'success',
  PAST_DUE: 'critical',
  READ_ONLY: 'warning',
  SUSPENDED: 'critical',
  CLOSED: 'neutral',
};

export const HEALTH_TONES = {
  GOOD: 'success',
  AT_RISK: 'critical',
  SETTING_UP: 'accent',
  LOW_USE: 'warning',
};

export const INVOICE_TONES = { PAID: 'success', ISSUED: 'warning', VOID: 'neutral' };

/** The web address of a hospital: cityhospital.example.com (the console's own root domain). */
export function tenantAddress(subdomain, loc = globalThis.location) {
  const host = String(loc?.hostname ?? 'localhost').replace(/^console\./, '');
  return `${subdomain}.${host}`;
}
