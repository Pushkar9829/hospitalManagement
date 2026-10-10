import { financialYear, formatSequence, formatUhid } from '@hms/shared';

/** Period part as the API writes it: "26-27" (yearly), "2610" (monthly), none (never resets). */
function periodLabel(reset, date = new Date()) {
  if (reset === 'NEVER') return null;
  if (reset === 'YEARLY') return financialYear(date);
  const ist = new Date(date.getTime() + 330 * 60_000);
  return `${String(ist.getUTCFullYear()).slice(-2)}${String(ist.getUTCMonth() + 1).padStart(2, '0')}`;
}

/** The first number the series would issue with these settings, e.g. "OP/26-27/000001". */
export function exampleNumber({ prefix, reset, width }) {
  const p = String(prefix || '').toUpperCase() || '—';
  const w = Number(width);
  if (!Number.isInteger(w) || w < 3 || w > 9) return null;
  const period = periodLabel(reset);
  return period ? formatSequence(p, period, 1, w) : formatUhid(p, 1, w);
}
