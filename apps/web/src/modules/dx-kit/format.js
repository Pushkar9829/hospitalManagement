/**
 * Display helpers for the diagnostics, pharmacy and stores screens: dates as "09 Oct 2026",
 * times 24-hour, always in IST.
 */
const IST = 'Asia/Kolkata';

function toDate(value) {
  if (value == null || value === '') return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** The Intl locale for the app language. */
export function localeOf(i18n) {
  return i18n?.language === 'hi' ? 'hi-IN' : 'en-IN';
}

/** 09 Oct 2026 */
export function fmtDate(value, locale = 'en-IN') {
  const d = toDate(value);
  if (!d) return '';
  return new Intl.DateTimeFormat(locale, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: IST,
  }).format(d);
}

/** Oct 2026 (expiry dates) */
export function fmtMonth(value, locale = 'en-IN') {
  const d = toDate(value);
  if (!d) return '';
  return new Intl.DateTimeFormat(locale, { month: 'short', year: 'numeric', timeZone: IST }).format(
    d,
  );
}

/** 14:05 */
export function fmtTime(value, locale = 'en-IN') {
  const d = toDate(value);
  if (!d) return '';
  return new Intl.DateTimeFormat(locale, {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone: IST,
  }).format(d);
}

/** 09 Oct 2026, 14:05 */
export function fmtDateTime(value, locale = 'en-IN') {
  const d = toDate(value);
  if (!d) return '';
  return `${fmtDate(d, locale)}, ${fmtTime(d, locale)}`;
}

/** "1 h 10 min" / "52 min" / "2.6 days" from minutes (labels from the caller's strings). */
export function fmtMinutes(min, t) {
  if (min == null) return '';
  if (min >= 1440 * 2) return t('dxkit.days', { n: (min / 1440).toFixed(1) });
  if (min >= 60) {
    const h = Math.floor(min / 60);
    const m = Math.round(min % 60);
    return m ? t('dxkit.hoursMinutes', { h, m }) : t('dxkit.hours', { h });
  }
  return t('dxkit.minutes', { m: Math.round(min) });
}

/** Indian digit grouping for counts: 150000 -> 1,50,000. */
export function fmtNumber(n, locale = 'en-IN', digits) {
  if (n == null || n === '') return '';
  const num = Number(n);
  if (!Number.isFinite(num)) return String(n);
  return new Intl.NumberFormat(locale, {
    maximumFractionDigits: digits ?? 2,
    minimumFractionDigits: digits ?? 0,
  }).format(num);
}
