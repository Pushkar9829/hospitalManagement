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
