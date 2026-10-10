/** Relative "in 41 h" / "in 25 min" countdown parts until `iso`, or null when it has passed. */
export function timeLeft(iso, now = Date.now()) {
  const ms = new Date(iso).getTime() - now;
  if (!Number.isFinite(ms) || ms <= 0) return null;
  const minutes = Math.floor(ms / 60000);
  if (minutes < 60) return { unit: 'min', value: Math.max(1, minutes) };
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return { unit: 'h', value: hours };
  return { unit: 'd', value: Math.floor(hours / 24) };
}

/** Start and end of a calendar day in IST as ISO strings, for date-range filters. */
export function istDayStart(ymd) {
  return ymd ? new Date(`${ymd}T00:00:00+05:30`).toISOString() : undefined;
}
export function istDayEnd(ymd) {
  return ymd ? new Date(`${ymd}T23:59:59.999+05:30`).toISOString() : undefined;
}

export const DAY = 86_400_000;

/** Whole days left until `iso` (today counts), or 0 once it has passed. */
export function daysLeft(iso, now = Date.now()) {
  if (!iso) return null;
  return Math.max(0, Math.ceil((new Date(iso).getTime() - now) / DAY));
}
