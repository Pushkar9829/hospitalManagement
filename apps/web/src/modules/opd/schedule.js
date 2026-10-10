/** Weekly schedule summaries for the schedule tables (OPD appointments and OPD settings). */

export const WEEKDAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];

/** "Mon to Sat" for a run of three or more days, else "Mon, Wed, Fri". */
export function daysText(t, week) {
  const on = WEEKDAYS.map((d) => week.find((w) => w.day === d)?.sessions.length > 0);
  const idx = on.map((x, i) => (x ? i : -1)).filter((i) => i >= 0);
  if (!idx.length) return t('opd.days.none');
  const contiguous = idx.every((v, i) => i === 0 || v === idx[i - 1] + 1);
  const name = (i) => t(`opd.days.${WEEKDAYS[i]}`);
  if (contiguous && idx.length >= 3)
    return t('opd.days.range', { from: name(idx[0]), to: name(idx.at(-1)) });
  if (idx.length === 1) return t(`opd.days.long.${WEEKDAYS[idx[0]]}`);
  return idx.map(name).join(', ');
}

/** The distinct session times across the week: "10:00 to 13:00, 17:00 to 19:00". */
export function sessionsText(t, week) {
  const seen = new Set();
  for (const w of week)
    for (const s of w.sessions) seen.add(t('opd.days.session', { start: s.start, end: s.end }));
  return [...seen].join(', ');
}

/** The first session of the week (for room, slot length and the cap). */
export function firstSession(week) {
  for (const w of week) if (w.sessions.length) return w.sessions[0];
  return null;
}
