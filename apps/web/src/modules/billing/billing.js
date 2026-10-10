import { DENOMINATIONS, SHIFT_VARIANCE_PAISE } from '@hms/shared/schemas';
import { roundOff } from '@hms/shared';

/** Bill status -> badge tone. Red is kept for act-now states; a due bill is information. */
export const BILL_TONES = {
  DRAFT: 'neutral',
  FINAL: 'info',
  PARTLY_PAID: 'warning',
  PAID: 'success',
  CANCELLED: 'neutral',
};

export const SHIFT_TONES = { OPEN: 'info', COUNTED: 'warning', VERIFIED: 'success' };

/** Price list kind for a patient category (API rule R1: corporate uses the general list for now). */
const CATEGORY_LIST_KIND = {
  GENERAL: 'GENERAL',
  STAFF: 'STAFF',
  SENIOR: 'SENIOR',
  CORPORATE: 'GENERAL',
};

/** The price list a patient is billed from: their category's list, else the default list. */
export function priceListFor(category, priceLists = []) {
  const active = priceLists.filter((l) => l.isActive);
  const fallback = active.find((l) => l.isDefault) ?? active.find((l) => l.kind === 'GENERAL');
  const kind = CATEGORY_LIST_KIND[category] ?? 'GENERAL';
  return active.find((l) => l.kind === kind) ?? fallback ?? null;
}

/**
 * A service's rate for a patient (paise) with the list it came from, falling back to the
 * default list the way the API does; null when neither list has a rate.
 */
export function rateFor(service, list, priceLists = []) {
  const fallback = priceLists.find((l) => l.isActive && l.isDefault) ?? null;
  const amount = (l) => l && service.rates?.find((r) => r.priceListId === l.id)?.amount;
  const own = amount(list);
  if (own !== undefined && own !== null) return { amount: own, list };
  const def = amount(fallback);
  if (def !== undefined && def !== null) return { amount: def, list: fallback };
  return null;
}

/**
 * Estimated totals for lines not yet saved: { lines:[{gross, tax, net}], gross, tax, net,
 * roundOff, total } in paise, computed like the API (GST on the line value; healthcare
 * services are exempt at 0%; the total rounded to the rupee). The draft the API returns is
 * the bill of record.
 */
export function estimate(lines) {
  const priced = lines.map((l) => {
    const gross = (l.unitPrice ?? 0) * (l.qty ?? 1);
    const tax = Math.round((gross * (l.taxRate ?? 0)) / 100);
    return { ...l, gross, tax, net: gross + tax };
  });
  const sum = (k) => priced.reduce((s, l) => s + l[k], 0);
  const net = sum('net');
  const r = roundOff(net);
  return {
    lines: priced,
    gross: sum('gross'),
    tax: sum('tax'),
    net,
    roundOff: r.roundOff,
    total: r.rounded,
  };
}

/** Cash counted from a { '500': 4, '100': 3 } note count, in paise. */
export function countedCash(notes) {
  return DENOMINATIONS.reduce((s, d) => s + d * 100 * (Number(notes?.[String(d)]) || 0), 0);
}

/** Per-mode variance at shift close (counted - expected) and whether a reason is needed (> ₹100). */
export function shiftVariances(expected = {}, cash, nonCash = {}) {
  const out = { CASH: cash - (expected.CASH ?? 0) };
  for (const [mode, amount] of Object.entries(expected))
    if (mode !== 'CASH') out[mode] = (nonCash[mode] ?? 0) - amount;
  for (const [mode, amount] of Object.entries(nonCash)) if (!(mode in out)) out[mode] = amount;
  const big = Object.entries(out).filter(([, v]) => Math.abs(v) > SHIFT_VARIANCE_PAISE);
  return { byMode: out, needsReason: big.length > 0, big };
}

/** Rule R5: above 10% or ₹10,000 the Super Admin approves after the Billing Manager. */
export const DISCOUNT_L2 = { percent: 10, amount: 10_000_00 };

/** Discount amount (paise) for a request on a bill's gross value, as the API computes it. */
export function discountPaise(kind, value, gross) {
  const v = Number(value);
  if (!Number.isFinite(v) || v <= 0) return 0;
  return kind === 'PERCENT' ? Math.round((gross * v) / 100) : Math.round(v * 100);
}
