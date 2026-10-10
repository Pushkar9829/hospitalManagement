/**
 * OPD display helpers shared by the OPD and front-office screens: status tones (colour always
 * comes with the text label), today's date in IST and small formatting helpers.
 */

/** Appointment status (docs/modules/OPD.md section 4) -> StatusBadge tone. */
export const APPT_TONE = {
  BOOKED: 'info',
  CONFIRMED: 'info',
  CHECKED_IN: 'success',
  IN_CONSULT: 'warning',
  COMPLETED: 'neutral',
  CANCELLED: 'neutral',
  NO_SHOW: 'critical',
  RESCHEDULED: 'neutral',
};

/** Queue stage -> tone. NOT_ARRIVED is a booking that has not checked in yet. */
export const STAGE_TONE = {
  NOT_ARRIVED: 'info',
  WAITING: 'success',
  IN_TRIAGE: 'warning',
  TRIAGED: 'success',
  CALLED: 'accent',
  WITH_DOCTOR: 'warning',
  DONE: 'neutral',
};

/** Slot cell status on the appointment grid -> tone. */
export const SLOT_TONE = {
  FREE: 'neutral',
  BOOKED: 'info',
  CHECKED_IN: 'success',
  IN_CONSULT: 'warning',
  NO_SHOW: 'critical',
  COMPLETED: 'neutral',
  PAST: 'neutral',
  BLOCKED: 'neutral',
};

export const PRIORITY_TONE = { RED: 'critical', AMBER: 'warning', GREEN: 'success' };

export const VISIT_TYPES = ['NEW', 'FOLLOW_UP', 'TELE', 'VACCINATION', 'PROCEDURE', 'HEALTH_CHECK'];
export const CHANNELS = ['DESK', 'PHONE', 'PORTAL', 'WHATSAPP', 'WALK_IN'];
export const FREQUENCIES = ['OD', 'OD_MORNING', 'BD', 'TDS', 'QID', 'HS', 'SOS', 'STAT'];
export const ROUTES = ['Oral', 'Sublingual', 'Topical', 'Inhalation', 'IM', 'IV', 'SC'];

/** Today in IST as YYYY-MM-DD. */
export function todayIST(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

/** YYYY-MM-DD plus n days. */
export function addDaysYmd(ymd, n) {
  const d = new Date(`${ymd}T12:00:00+05:30`);
  return todayIST(new Date(d.getTime() + n * 86_400_000));
}

/** A YYYY-MM-DD date as an instant at noon IST, for the date formatters. */
export function ymdInstant(ymd) {
  return ymd ? new Date(`${ymd}T12:00:00+05:30`) : null;
}

/** BMI from kg and cm, one decimal; null when either is missing. */
export function bmiOf(weightKg, heightCm) {
  const w = Number(weightKg);
  const h = Number(heightCm);
  if (!w || !h) return null;
  return Math.round((w / (h / 100) ** 2) * 10) / 10;
}

/** BMI band (WHO Asian cut-offs are stricter; the board uses the standard bands). */
export function bmiBand(bmi) {
  if (bmi == null) return null;
  if (bmi < 18.5) return 'UNDER';
  if (bmi < 25) return 'NORMAL';
  if (bmi < 30) return 'OVER';
  return 'OBESE';
}

/** A blood pressure reading "148/92" flagged high at 140/90 or more, low under 90/60. */
export function bpFlag(bp) {
  const m = /^(\d{2,3})\s*\/\s*(\d{2,3})$/.exec(String(bp ?? '').trim());
  if (!m) return null;
  const [sys, dia] = [Number(m[1]), Number(m[2])];
  if (sys >= 140 || dia >= 90) return 'HIGH';
  if (sys < 90 || dia < 60) return 'LOW';
  return null;
}

/** Download rows as a CSV file (exports on analytics and the visitor log). */
export function downloadCsv(filename, header, rows) {
  const esc = (v) => {
    const s = String(v ?? '');
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const text = [header, ...rows].map((r) => r.map(esc).join(',')).join('\n');
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
