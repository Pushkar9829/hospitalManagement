import { formatINR, toPaise } from '@hms/shared';

/** Paise from the API → the rupee text a form field shows ("499.5" → "499.50", 50000 → "500"). */
export function rupeesText(paise) {
  if (paise == null) return '';
  return paise % 100 ? (paise / 100).toFixed(2) : String(paise / 100);
}

/** A rupee amount typed in a field → paise, or null when the field is empty. */
export function paiseFrom(text) {
  if (text == null || String(text).trim() === '') return null;
  return toPaise(text);
}

/** ₹1,23,456 (no paise when they are zero). */
export function inr(paise) {
  if (paise == null) return '';
  return formatINR(paise, { decimals: paise % 100 ? 2 : 0 });
}

/** ₹1,23,456.00: always with paise, for bill lines and totals. */
export function inrExact(paise) {
  if (paise == null) return '';
  return formatINR(paise, { decimals: 2 });
}

/**
 * The billing and subscription APIs take amounts in rupees (their schemas turn them into paise).
 * Forms keep paise (integers) and convert only here: 49950 -> 499.5.
 */
export function rupeesForApi(paise) {
  return paise == null ? undefined : paise / 100;
}

/**
 * A rupee amount typed by a cashier -> paise: "1,250.50" -> 125050. Empty -> null; anything that
 * is not an amount with at most two decimals ("12.345", "abc") -> NaN, so the form can say so.
 */
export function parseRupees(text) {
  const s = String(text ?? '').replace(/[₹,\s]/g, '');
  if (!s) return null;
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return Number.NaN;
  return toPaise(s);
}
