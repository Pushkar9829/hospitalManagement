/**
 * Shared sample people, places and helpers for the core-admin preview handlers (reports, billing
 * settings, corporate desk, billing analytics, setup wizard, settings, users and audit extras).
 * Names match the design boards so the screens tell one story: Demo Hospital, Pune, Main branch
 * and Baner Clinic, patient Ravi Kumar (CC0000123), cashier Neha Kulkarni and so on.
 * Not a handler file: only the *.preview.js files import it.
 */

const IST_OFFSET = 330 * 60_000;

/** ISO time for "n days ago at HH:MM IST" (n = 0 is today). */
export function at(daysAgo = 0, hhmm = '10:00') {
  const now = new Date(Date.now() + IST_OFFSET);
  const [h, m] = hhmm.split(':').map(Number);
  const d = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - daysAgo, h, m);
  return new Date(d - IST_OFFSET).toISOString();
}

/** ISO time `minutes` from now (negative for the past). */
export function inMinutes(minutes) {
  return new Date(Date.now() + minutes * 60_000).toISOString();
}

/** Today in IST as yyyy-mm-dd, shifted by `days`. */
export function ymd(days = 0) {
  return new Date(Date.now() + IST_OFFSET + days * 86_400_000).toISOString().slice(0, 10);
}

/** ₹ → paise. */
export const rs = (rupees) => Math.round(rupees * 100);

/** Paged list in the API's shape. */
export function page(items, query = {}) {
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 25));
  const p = Math.max(1, Number(query.page) || 1);
  return { items: items.slice((p - 1) * limit, p * limit), total: items.length, page: p, limit };
}

/** Case-insensitive match of `q` against any of the given fields. */
export function matches(row, q, fields) {
  if (!q) return true;
  const needle = String(q).toLowerCase();
  return fields.some((f) =>
    String(row[f] ?? '')
      .toLowerCase()
      .includes(needle),
  );
}

let seq = 1000;
export const newId = (prefix = 'pv') => `${prefix}${(seq++).toString(36)}${Date.now() % 997}`;

export const notFound = (what = 'Record') => ({
  __status: 404,
  error: { code: 'NOT_FOUND', message: `${what} not found` },
});

export const invalid = (path, message) => ({
  __status: 422,
  error: {
    code: 'VALIDATION_FAILED',
    message: 'Check the highlighted fields',
    details: [{ path, message }],
  },
});

export const BRANCHES = [
  { id: 'br-main', code: 'MAIN', name: 'Main Branch' },
  { id: 'br-baner', code: 'BANER', name: 'Baner Clinic' },
];

export const STAFF = {
  arjun: {
    id: 'u-arjun',
    name: 'Dr. Arjun Rao',
    username: 'arjun.rao',
    role: 'Hospital Super Admin',
  },
  kavita: {
    id: 'u-kavita',
    name: 'Kavita Desai',
    username: 'kavita.desai',
    role: 'Hospital Admin',
  },
  meera: {
    id: 'u-meera',
    name: 'Dr. Meera Iyer',
    username: 'meera.iyer',
    role: 'Consultant, HOD Cardiology',
  },
  anjali: { id: 'u-anjali', name: 'Anjali Menon', username: 'anjali.menon', role: 'Staff Nurse' },
  neha: { id: 'u-neha', name: 'Neha Kulkarni', username: 'neha.k', role: 'Cashier' },
  ravi: { id: 'u-ravis', name: 'Ravi S.', username: 'ravi.s', role: 'Cashier' },
  suresh: { id: 'u-suresh', name: 'Suresh Patil', username: 'suresh.patil', role: 'Pharmacist' },
  rohit: { id: 'u-rohit', name: 'Rohit Verma', username: 'rohit.verma', role: 'Admission Desk' },
  lalit: { id: 'u-lalit', name: 'Lalit G.', username: 'lalit.g', role: 'Lab Technician' },
  ramesh: {
    id: 'u-ramesh',
    name: 'Ramesh Iyer',
    username: 'ramesh.iyer',
    role: 'Finance Controller',
  },
  rameshK: { id: 'u-rameshk', name: 'Ramesh K.', username: 'ramesh.k', role: 'Staff Nurse (ICU)' },
  nRao: { id: 'u-nrao', name: 'Dr. N. Rao', username: 'n.rao', role: 'Pathologist' },
  kiran: { id: 'u-kiran', name: 'Kiran Joshi', username: 'kiran.joshi', role: 'Payroll Officer' },
  sunita: { id: 'u-sunita', name: 'Sunita Shah', username: 'sunita.shah', role: 'Quality Manager' },
};

export const DOCTORS = [
  ['Dr. Meera Iyer', 'Cardiology'],
  ['Dr. Sanjay Kulkarni', 'General Medicine'],
  ['Dr. Priya Nair', 'Obstetrics and Gynaecology'],
  ['Dr. Vikram Shah', 'Orthopaedics'],
  ['Dr. Farah Khan', 'Paediatrics'],
  ['Dr. Amol Deshpande', 'General Surgery'],
];

export const PATIENTS = [
  { uhid: 'CC0000123', name: 'Ravi Kumar', age: 54, sex: 'M' },
  { uhid: 'CC0000187', name: 'Seema Rao', age: 41, sex: 'F' },
  { uhid: 'CC0000204', name: 'Anil Pawar', age: 37, sex: 'M' },
  { uhid: 'CC0000231', name: 'Lata Joshi', age: 68, sex: 'F' },
  { uhid: 'CC0000256', name: 'Vivek Joshi', age: 45, sex: 'M' },
  { uhid: 'CC0000278', name: 'Kiran Deshmukh', age: 29, sex: 'F' },
  { uhid: 'CC0000301', name: 'Sanjay Patil', age: 52, sex: 'M' },
  { uhid: 'CC0000322', name: 'Fatima Shaikh', age: 33, sex: 'F' },
];

/** Corporate payers, by code (the real payers master holds the same codes in the demo seed). */
export const CORPORATES = [
  {
    code: 'TATAMOTORS',
    name: 'Tata Motors',
    note: 'Employees and families',
    gstin: '27AAACT2727Q1ZW',
    rateCard: 'Tariff less 15%',
    limit: rs(10_00_000),
    used: rs(6_42_300),
    days: 30,
    overdue: 0,
    hold: false,
  },
  {
    code: 'BAJAJAUTO',
    name: 'Bajaj Auto',
    note: 'Employees only',
    gstin: '27AAACB3370K1ZQ',
    rateCard: 'Tariff less 10%',
    limit: rs(5_00_000),
    used: rs(4_61_000),
    days: 45,
    overdue: rs(1_12_000),
    hold: false,
  },
  {
    code: 'PMC',
    name: 'Pune Municipal Corporation',
    note: 'Government body on credit',
    gstin: '27AAALP0222M1Z1',
    rateCard: 'CGHS-like rates',
    limit: rs(20_00_000),
    used: rs(7_10_000),
    days: 60,
    overdue: rs(2_40_000),
    hold: false,
  },
  {
    code: 'INFOSYS',
    name: 'Infosys, Pune campus',
    note: 'Health check-up partner',
    gstin: '27AAACI4798L1ZE',
    rateCard: 'Package rates',
    limit: rs(3_00_000),
    used: rs(3_12_000),
    days: 30,
    overdue: rs(3_12_000),
    hold: true,
  },
];

/** A stable small number from a string (to make sample figures for unknown ids). */
export function hashOf(s) {
  let h = 7;
  for (const ch of String(s)) h = (h * 31 + ch.charCodeAt(0)) % 100_003;
  return h;
}
