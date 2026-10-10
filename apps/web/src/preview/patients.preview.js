/**
 * Preview data for the patient screens' sections whose APIs belong to modules not built yet
 * (OPD visits, IPD admissions, lab and radiology reports, prescriptions, consents, ABDM Scan and
 * Share). The patient record itself, search, registration, timeline and bills are real.
 */
const list = (items, query = {}) => {
  const page = Number(query.page ?? 1);
  const limit = Number(query.limit ?? 25);
  return { items: items.slice((page - 1) * limit, page * limit), total: items.length, page, limit };
};

const today = (hhmm) => {
  const d = new Date();
  const [h, m] = hhmm.split(':').map(Number);
  // IST wall time today, as UTC.
  d.setUTCHours(h - 5, m - 30, 0, 0);
  return d.toISOString();
};

const REGISTERED_TODAY = [
  ['Sana Sheikh', 'CC0000122', '10:38'],
  ['Mohan Lal', 'CC0000121', '10:31'],
  ['Baby of Priya Desai', 'CC0000120', '10:12'],
  ['Farah Ali', 'CC0000119', '10:05'],
  ['Joseph D’Souza', 'CC0000118', '09:58'],
  ['Kavya Nair', 'CC0000117', '09:41'],
].map(([name, uhid, t]) => ({ name, uhid, registeredAt: today(t) }));

const scans = [
  {
    id: 'ss-043',
    at: today('10:52'),
    name: 'Kiran Rao',
    abhaAddress: 'kiranrao@abdm',
    age: '34Y',
    gender: 'F',
    match: 'NEW',
    token: 'R-043',
  },
  {
    id: 'ss-042',
    at: today('10:47'),
    name: 'Vijay Pawar',
    abhaAddress: 'vpawar@abdm',
    age: '58Y',
    gender: 'M',
    match: 'LINKED',
    token: 'R-042',
  },
  {
    id: 'ss-041',
    at: today('10:40'),
    name: 'Asha Kale',
    abhaAddress: 'asha.k@abdm',
    age: '41Y',
    gender: 'F',
    match: 'REVIEW',
    token: null,
  },
];

const VISITS = [
  {
    id: 'v1',
    date: '2026-10-09T05:28:00.000Z',
    doctor: 'Dr. Meera Iyer',
    department: 'Cardiology',
    type: 'FOLLOW_UP',
    diagnosis: 'I20.9 Angina pectoris',
  },
  {
    id: 'v2',
    date: '2026-09-24T04:40:00.000Z',
    doctor: 'Dr. Meera Iyer',
    department: 'Cardiology',
    type: 'NEW',
    diagnosis: 'I10 Essential hypertension',
  },
  {
    id: 'v3',
    date: '2026-06-02T06:10:00.000Z',
    doctor: 'Dr. R. Menon',
    department: 'General Medicine',
    type: 'NEW',
    diagnosis: 'B34.9 Viral fever',
  },
];

const ADMISSIONS = [
  {
    id: 'a1',
    ipNo: 'IP/26-27/000871',
    admittedAt: '2026-10-09T05:50:00.000Z',
    dischargedAt: null,
    bed: 'W2-204-B',
    consultant: 'Dr. Meera Iyer',
    status: 'ADMITTED',
  },
];

const REPORTS = [
  {
    id: 'r1',
    date: '2026-10-09T05:10:00.000Z',
    name: 'Lipid profile',
    kind: 'LAB',
    flag: 'HIGH',
    flagText: 'LDL 168 mg/dL',
    status: 'RELEASED',
  },
  {
    id: 'r2',
    date: '2026-10-09T05:10:00.000Z',
    name: 'HbA1c',
    kind: 'LAB',
    flag: 'NORMAL',
    status: 'RELEASED',
  },
  { id: 'r3', date: '2026-10-09T08:00:00.000Z', name: '2D Echo', kind: 'RAD', status: 'SCHEDULED' },
  {
    id: 'r4',
    date: '2026-01-15T04:30:00.000Z',
    name: 'Chest X-ray',
    kind: 'RAD',
    flag: 'NORMAL',
    status: 'RELEASED',
  },
];

const PRESCRIPTIONS = [
  {
    id: 'm1',
    medicine: 'Ecosprin 75 mg',
    dose: 'Once daily',
    since: '2026-10-09',
    by: 'Dr. Meera Iyer',
  },
  {
    id: 'm2',
    medicine: 'Amlodipine 10 mg',
    dose: 'Once daily',
    since: '2026-09-24',
    by: 'Dr. Meera Iyer',
  },
  {
    id: 'm3',
    medicine: 'Atorvastatin 40 mg',
    dose: 'At night',
    since: '2026-10-09',
    by: 'Dr. Meera Iyer',
  },
];

const CONSENTS = [
  {
    id: 'c1',
    name: 'Treatment and admission',
    givenAt: '2026-10-09',
    channel: 'SIGNATURE',
    validUntil: 'ADMISSION',
  },
  {
    id: 'c2',
    name: 'ABHA record linking',
    givenAt: '2026-09-24',
    channel: 'OTP',
    validUntil: 'WITHDRAWN',
  },
  {
    id: 'c3',
    name: 'WhatsApp messages',
    givenAt: '2026-09-24',
    channel: 'FORM',
    validUntil: 'WITHDRAWN',
  },
];

export const handlers = {
  'GET /patients/registered-today': ({ query }) => list(REGISTERED_TODAY, query),
  'GET /abdm/scan-share': ({ query }) => list(scans, query),
  'GET /patients/:id/visits': ({ query }) => list(VISITS, query),
  'GET /patients/:id/admissions': ({ query }) => list(ADMISSIONS, query),
  'GET /patients/:id/reports': ({ query }) => list(REPORTS, query),
  'GET /patients/:id/prescriptions': ({ query }) => list(PRESCRIPTIONS, query),
  'GET /patients/:id/consents': ({ query }) => list(CONSENTS, query),
  'GET /patients/:id/summary': () => ({
    conditions: ['Hypertension', 'Angina'],
    activeMedicines: PRESCRIPTIONS.length,
    opdVisits: 6,
    ipdStays: 1,
    outstanding: 220000,
    wallet: 150000,
    admission: { ipNo: 'IP/26-27/000871', bed: 'W2-204-B' },
    membership: 'Family Gold',
  }),
};
