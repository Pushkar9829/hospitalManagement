/**
 * OPD preview data (docs/modules/OPD.md): doctors, slots, appointments, the token queue, visits
 * with vitals and consultations, templates, OPD settings and analytics. One in-memory OPD day
 * "as of 11:04 IST" on today's date, so every OPD screen tells the same story: the same
 * patients, UHIDs, doctors, rooms and tokens. Writes change the in-memory state, so booking,
 * check-in, triage, consultation and closing a visit can be clicked through end to end.
 *
 * Planned API contract: paths under /api/v1, lists as { items, total, page, limit }, money in
 * paise, dates as ISO strings. Delete this file when the OPD API lands.
 */

const TZ = 'Asia/Kolkata';
const ymdIST = (d = new Date()) =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
const TODAY = ymdIST();
const at = (hhmm, ymd = TODAY) => new Date(`${ymd}T${hhmm}:00+05:30`).toISOString();
const addDays = (ymd, n) =>
  ymdIST(new Date(new Date(`${ymd}T12:00:00+05:30`).getTime() + n * 86_400_000));
/** The preview OPD day stands still at 11:04 IST. */
const CLOCK = '11:04';
const NOW = at(CLOCK);
const minutes = (hhmm) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
const hhmm = (m) =>
  `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
const rupees = (r) => r * 100;

const err = (status, code, message, extra = {}) => ({
  __status: status,
  error: { code, message, requestId: `preview-${Date.now()}`, ...extra },
});
const page = (items, query = {}) => {
  const limit = Math.min(100, Number(query.limit) || 25);
  const p = Math.max(1, Number(query.page) || 1);
  return { items: items.slice((p - 1) * limit, p * limit), total: items.length, page: p, limit };
};
const like = (text, q) =>
  !q ||
  String(text ?? '')
    .toLowerCase()
    .includes(String(q).toLowerCase());
let seq = 1000;
const nextId = (prefix) => `${prefix}${++seq}`;

// ---------------------------------------------------------------------------------------------
// Doctors and patients
// ---------------------------------------------------------------------------------------------

export const DOCTORS = [
  {
    id: 'pv-d1',
    name: 'Dr. Meera Iyer',
    department: 'Cardiology',
    room: '12',
    qualification: 'MD, DM (Cardiology)',
    regNo: 'MMC-33012',
    designation: 'Consultant Cardiologist',
    start: '10:00',
    end: '13:00',
    slot: 10,
    fees: { NEW: rupees(800), FOLLOW_UP: rupees(500), TELE: rupees(600) },
    followUp: { days: 15, visits: 1 },
  },
  {
    id: 'pv-d2',
    name: 'Dr. P. Joshi',
    department: 'Orthopaedics',
    room: '7',
    qualification: 'MS (Ortho)',
    regNo: 'MMC-28741',
    designation: 'Consultant Orthopaedic Surgeon',
    start: '10:00',
    end: '14:00',
    slot: 15,
    fees: { NEW: rupees(900), FOLLOW_UP: rupees(600), TELE: rupees(700) },
    followUp: { days: 10, visits: 1 },
  },
  {
    id: 'pv-d3',
    name: 'Dr. A. Thomas',
    department: 'Paediatrics',
    room: '3',
    qualification: 'MD (Paediatrics)',
    regNo: 'MMC-30455',
    designation: 'Consultant Paediatrician',
    start: '10:00',
    end: '13:00',
    slot: 10,
    fees: { NEW: rupees(600), FOLLOW_UP: rupees(400), TELE: rupees(500) },
    followUp: { days: 7, visits: 1 },
  },
  {
    id: 'pv-d4',
    name: 'Dr. L. Gupta',
    department: 'Dermatology',
    room: '9',
    qualification: 'MD (DVL)',
    regNo: 'MMC-35120',
    designation: 'Consultant Dermatologist',
    start: '10:00',
    end: '13:00',
    slot: 10,
    fees: { NEW: rupees(700), FOLLOW_UP: rupees(400), TELE: rupees(500) },
    followUp: { days: 15, visits: 1 },
  },
  {
    id: 'pv-d5',
    name: 'Dr. R. Menon',
    department: 'General Medicine',
    room: '5',
    qualification: 'MD (Medicine)',
    regNo: 'MMC-26310',
    designation: 'Consultant Physician',
    start: '10:00',
    end: '13:00',
    slot: 10,
    fees: { NEW: rupees(600), FOLLOW_UP: rupees(400), TELE: rupees(500) },
    followUp: { days: 15, visits: 1 },
  },
  {
    id: 'pv-d6',
    name: 'Dr. F. Khan',
    department: 'Gynaecology',
    room: '10',
    qualification: 'MS (OBGY)',
    regNo: 'MMC-31877',
    designation: 'Consultant Obstetrician and Gynaecologist',
    start: '10:30',
    end: '13:00',
    slot: 15,
    fees: { NEW: rupees(700), FOLLOW_UP: rupees(500), TELE: rupees(600) },
    followUp: { days: 15, visits: 1 },
  },
  {
    id: 'pv-d7',
    name: 'Dr. S. Bhide (visiting)',
    department: 'Orthopaedics',
    room: '7',
    qualification: 'MS (Ortho), Fellowship Arthroplasty',
    regNo: 'MMC-22094',
    designation: 'Visiting Joint Replacement Surgeon',
    start: '15:00',
    end: '18:00',
    slot: 15,
    visiting: true,
    fees: { NEW: rupees(1000), FOLLOW_UP: rupees(1000), TELE: rupees(1000) },
    followUp: { days: 0, visits: 0 },
  },
];
const doctor = (id) => DOCTORS.find((d) => d.id === id);
const doctorCard = (d) => ({ id: d.id, name: d.name, department: d.department, room: d.room });
/** The signed-in doctor in preview ("me"). */
const ME = 'pv-d1';

/** [key, UHID, full name, sex, age, mobile, allergies, blood group, ABHA linked] */
const PATIENT_ROWS = [
  ['ravi', 'CC0000123', 'Ravi Kumar', 'M', '47Y', '9876543210', ['Penicillin'], 'B+', true],
  ['seema', 'CC0000144', 'Seema Deshmukh', 'F', '52Y', '9822011873', [], 'O+', true],
  ['gopal', 'CC0000150', 'Gopal Rao', 'M', '63Y', '9923044120', [], 'A+', false],
  ['rahul', 'CC0000098', 'Rahul Patil', 'M', '38Y', '9881055210', [], 'B+', true],
  ['kiara', 'CC0000161', 'Kiara Shah', 'F', '9M', '9765422018', [], 'O+', true],
  ['usha', 'CC0000088', 'Usha Kulkarni', 'F', '57Y', '9011083472', ['Sulfa drugs'], 'AB+', true],
  ['divya', 'CC0000131', 'Divya Rao', 'F', '29Y', '9820455671', [], 'A+', true],
  ['harish', 'CC0000137', 'Harish Verma', 'M', '44Y', '9819022334', [], 'O-', false],
  ['joseph', 'CC0000102', 'Joseph D’Souza', 'M', '61Y', '9833011442', ['Aspirin'], 'B-', true],
  ['sana', 'CC0000110', 'Sana Shaikh', 'F', '28Y', '9967100234', [], 'A+', false],
  ['mohan', 'CC0000105', 'Mohan Lal', 'M', '68Y', '9890012345', [], 'B+', true],
  ['leela', 'CC0000174', 'Leela Nair', 'F', '66Y', '9821155780', [], 'O+', false],
  ['ritu', 'CC0000182', 'Ritu Jain', 'F', '39Y', '9930044551', [], 'A-', true],
  ['om', 'CC0000184', 'Om Prakash', 'M', '70Y', '9850023119', [], 'B+', false],
  ['arif', 'CC0000112', 'Arif Khan', 'M', '45Y', '9867002211', [], 'O+', true],
  ['kavya', 'CC0000114', 'Kavya Nair', 'F', '31Y', '9769033442', [], 'B+', true],
  ['neeta', 'CC0000155', 'Neeta Pawar', 'F', '35Y', '9822077345', [], 'A+', true],
  ['suresh', 'CC0000117', 'Suresh Bhat', 'M', '58Y', '9920012678', [], 'O+', false],
  ['anil', 'CC0000140', 'Anil Thakur', 'M', '50Y', '9821098765', ['Ibuprofen'], 'B+', true],
  ['raj', 'CC0000170', 'Raj Mehra', 'M', '45Y', '9819876543', [], 'A+', false],
  ['kamal', 'CC0000178', 'Kamal Dutta', 'M', '55Y', '9830012456', [], 'AB-', true],
  ['riya', 'CC0000159', 'Riya Bhosale', 'F', '4M', '9766011223', [], 'O+', true],
  ['aarav', 'CC0000152', 'Aarav Singh', 'M', '5Y', '9821004561', [], 'B+', true],
  ['ishan', 'CC0000163', 'Ishan Mehta', 'M', '2Y', '9867045123', [], 'A+', true],
  ['myra', 'CC0000158', 'Myra Kapoor', 'F', '6Y', '9920087654', [], 'O+', true],
  ['ayaan', 'CC0000165', 'Ayaan Malik', 'M', '4Y', '9833045678', ['Egg'], 'B+', false],
  ['vihaan', 'CC0000172', 'Vihaan Tiwari', 'M', '7Y', '9819034567', [], 'A+', true],
  ['prakash', 'CC0000119', 'Prakash Shetty', 'M', '42Y', '9870012390', [], 'O+', false],
  ['farah', 'CC0000121', 'Farah Ali', 'F', '33Y', '9930011876', [], 'B+', true],
  ['imran', 'CC0000126', 'Imran Sheikh', 'M', '36Y', '9821066345', [], 'A+', true],
  ['rekha', 'CC0000128', 'Rekha Pillai', 'F', '41Y', '9867023891', [], 'O+', true],
  ['tanvi', 'CC0000149', 'Tanvi Gokhale', 'F', '24Y', '9881034567', [], 'B+', true],
  ['nisha', 'CC0000168', 'Nisha Joshi', 'F', '33Y', '9822098712', [], 'A+', false],
  ['pooja', 'CC0000176', 'Pooja Sinha', 'F', '27Y', '9930078123', [], 'O+', true],
  ['sara', 'CC0000180', 'Sara Ahmed', 'F', '31Y', '9819045632', [], 'B+', true],
  ['deepak', 'CC0000133', 'Deepak Chawla', 'M', '53Y', '9820034519', [], 'A+', true],
  ['asha', 'CC0000201', 'Asha Kulkarni', 'F', '61Y', '9881055211', [], 'B+', true],
  ['sunil', 'CC0000135', 'Sunil Kumar', 'M', '49Y', '9867012390', [], 'O+', false],
  ['arifm', 'CC0000190', 'Mohd. Arif', 'M', '8Y', '9765422019', [], 'A+', false],
  ['lata', 'CC0000356', 'Lata Shinde', 'F', '55Y', '9011083473', ['Penicillin'], 'O+', true],
  ['ganesh', 'CC0000192', 'Ganesh More', 'M', '46Y', '9850011287', [], 'B+', false],
  ['shabana', 'CC0000194', 'Shabana Qureshi', 'F', '38Y', '9820099012', [], 'A+', true],
  ['priya', 'CC0000196', 'Priya Menon', 'F', '30Y', '9819011654', [], 'O+', true],
  ['anjali', 'CC0000198', 'Anjali Deshpande', 'F', '27Y', '9930022876', [], 'B+', true],
];
const PATIENTS = Object.fromEntries(
  PATIENT_ROWS.map(([key, uhid, name, gender, age, mobile, allergies, bloodGroup, abha]) => [
    key,
    {
      id: `pv-p-${uhid}`,
      uhid,
      name,
      gender,
      age,
      mobile,
      allergies,
      noKnownAllergies: allergies.length === 0,
      bloodGroup,
      abhaLinked: abha,
    },
  ]),
);
const card = (p) => ({
  id: p.id,
  uhid: p.uhid,
  name: p.name,
  gender: p.gender,
  age: p.age,
  mobile: p.mobile,
  allergies: p.allergies ?? [],
  noKnownAllergies: p.noKnownAllergies ?? false,
  bloodGroup: p.bloodGroup ?? null,
  abhaLinked: Boolean(p.abhaLinked),
});

// ---------------------------------------------------------------------------------------------
// Today's appointments and visits
// ---------------------------------------------------------------------------------------------

/**
 * [time, patient, appointment status, visit type, channel, token, queue stage, extras]
 * Stages: WAITING (for triage), IN_TRIAGE, TRIAGED (waiting for the doctor), WITH_DOCTOR, DONE.
 */
const DAY = {
  'pv-d1': [
    ['10:00', 'sana', 'COMPLETED', 'NEW', 'DESK', 'T-01', 'DONE'],
    ['10:10', 'mohan', 'COMPLETED', 'FOLLOW_UP', 'PHONE', 'T-03', 'DONE'],
    ['10:20', 'joseph', 'COMPLETED', 'NEW', 'DESK', 'T-06', 'DONE', { ordersPending: true }],
    ['10:30', 'ravi', 'IN_CONSULT', 'FOLLOW_UP', 'PORTAL', 'T-07', 'WITH_DOCTOR'],
    ['10:40', 'divya', 'CHECKED_IN', 'NEW', 'WHATSAPP', 'T-08', 'TRIAGED'],
    ['10:50', 'harish', 'CHECKED_IN', 'NEW', 'DESK', 'T-09', 'IN_TRIAGE'],
    ['11:00', 'leela', 'BOOKED', 'NEW', 'PHONE'],
    ['11:20', 'seema', 'CONFIRMED', 'FOLLOW_UP', 'DESK', null, null, { freeDay: 12 }],
    ['11:40', 'rahul', 'CONFIRMED', 'TELE', 'PORTAL', null, null, { prepaid: true }],
    ['11:50', 'ritu', 'BOOKED', 'NEW', 'PHONE'],
    ['12:10', 'om', 'BOOKED', 'FOLLOW_UP', 'DESK'],
    ['12:30', 'priya', 'BOOKED', 'NEW', 'PORTAL', null, null, { prepaid: true }],
  ],
  'pv-d2': [
    ['10:00', 'arif', 'COMPLETED', 'NEW', 'DESK', 'T-02', 'DONE'],
    ['10:15', 'kavya', 'COMPLETED', 'FOLLOW_UP', 'PHONE', 'T-05', 'DONE'],
    ['10:30', 'neeta', 'IN_CONSULT', 'NEW', 'DESK', 'T-14', 'WITH_DOCTOR'],
    ['10:45', 'suresh', 'CHECKED_IN', 'FOLLOW_UP', 'DESK', 'T-15', 'TRIAGED'],
    ['11:00', 'anil', 'CHECKED_IN', 'NEW', 'PHONE', 'T-16', 'WAITING'],
    ['11:30', 'gopal', 'CONFIRMED', 'NEW', 'DESK'],
    ['11:45', 'raj', 'BOOKED', 'NEW', 'PHONE'],
    ['12:15', 'kamal', 'CONFIRMED', 'TELE', 'PORTAL', null, null, { prepaid: true }],
  ],
  'pv-d3': [
    ['10:00', 'riya', 'COMPLETED', 'VACCINATION', 'DESK', 'T-19', 'DONE'],
    ['10:10', 'aarav', 'COMPLETED', 'NEW', 'WHATSAPP', 'T-20', 'DONE'],
    ['10:20', 'ishan', 'IN_CONSULT', 'NEW', 'DESK', 'T-21', 'WITH_DOCTOR'],
    ['10:30', 'myra', 'CHECKED_IN', 'FOLLOW_UP', 'PHONE', 'T-22', 'TRIAGED'],
    ['10:40', 'ayaan', 'CHECKED_IN', 'NEW', 'DESK', 'T-24', 'WAITING'],
    ['11:00', 'vihaan', 'BOOKED', 'NEW', 'PHONE'],
    ['11:40', 'kiara', 'CONFIRMED', 'VACCINATION', 'DESK'],
  ],
  'pv-d4': [
    ['10:00', 'prakash', 'NO_SHOW', 'NEW', 'PORTAL'],
    ['10:10', 'farah', 'COMPLETED', 'FOLLOW_UP', 'PHONE', 'T-04', 'DONE'],
    ['10:20', 'imran', 'COMPLETED', 'NEW', 'DESK', 'T-10', 'DONE'],
    ['10:30', 'rekha', 'IN_CONSULT', 'FOLLOW_UP', 'DESK', 'T-11', 'WITH_DOCTOR'],
    ['10:40', 'tanvi', 'CHECKED_IN', 'NEW', 'WHATSAPP', 'T-12', 'WAITING'],
    ['10:50', 'nisha', 'BOOKED', 'NEW', 'PHONE'],
    ['11:10', 'pooja', 'BOOKED', 'FOLLOW_UP', 'DESK'],
    ['11:50', 'usha', 'CONFIRMED', 'NEW', 'PORTAL', null, null, { prepaid: true }],
    ['12:20', 'sara', 'BOOKED', 'PROCEDURE', 'DESK'],
  ],
  'pv-d5': [
    ['10:00', 'deepak', 'COMPLETED', 'NEW', 'DESK', 'T-13', 'DONE'],
    ['10:10', 'asha', 'COMPLETED', 'FOLLOW_UP', 'PHONE', 'T-17', 'DONE'],
    ['10:20', 'sunil', 'IN_CONSULT', 'NEW', 'DESK', 'T-31', 'WITH_DOCTOR'],
    ['10:30', 'arifm', 'CHECKED_IN', 'NEW', 'WALK_IN', 'T-32', 'TRIAGED'],
    ['10:50', 'lata', 'BOOKED', 'FOLLOW_UP', 'PHONE'],
  ],
  'pv-d6': [
    ['10:30', 'anjali', 'COMPLETED', 'NEW', 'PORTAL', 'T-18', 'DONE'],
    ['10:45', 'shabana', 'IN_CONSULT', 'FOLLOW_UP', 'DESK', 'T-09A', 'WITH_DOCTOR'],
  ],
};
/** Walk-ins without a slot (W- series), merged 1 after every 3 booked (rule R5). */
const WALK_INS = [
  ['pv-d5', 'ganesh', 'W-01', 'DONE', '10:05'],
  ['pv-d5', 'shabana', 'W-02', 'WAITING', '10:58'],
];

const db = {
  appointments: [],
  visits: [],
  apptNo: 400,
  visitNo: 900,
  tokenNo: 33,
  walkInNo: 3,
};

function feeFor(d, visitType, extras = {}) {
  if (visitType === 'FOLLOW_UP' && extras.freeDay)
    return { amount: 0, label: 'FREE_FOLLOW_UP', day: extras.freeDay, window: d.followUp.days };
  const base =
    visitType === 'TELE'
      ? d.fees.TELE
      : visitType === 'FOLLOW_UP'
        ? d.fees.FOLLOW_UP
        : visitType === 'VACCINATION'
          ? d.fees.NEW
          : d.fees.NEW;
  return { amount: base, label: visitType === 'VACCINATION' ? 'PLUS_VACCINE' : null };
}

function makeAppointment({ d, p, date, time, status, visitType, channel, extras = {} }) {
  const fee = feeFor(d, visitType, extras);
  return {
    id: nextId('pv-a'),
    apptNo: `AP/26-27/${String(++db.apptNo).padStart(6, '0')}`,
    date,
    time,
    slotStart: at(time, date),
    doctor: doctorCard(d),
    patient: card(p),
    visitType,
    channel,
    status,
    fee: {
      amount: fee.amount,
      label: fee.label,
      freeDay: fee.day ?? null,
      window: fee.window ?? null,
      paid: Boolean(extras.prepaid) || fee.amount === 0,
      prepaid: Boolean(extras.prepaid),
    },
    token: null,
    visitId: null,
    notes: '',
    createdAt: at('09:00', addDays(date, -2)),
  };
}

const VITALS = {
  ravi: { bp: '148/92', pulse: 84, tempF: 98.4, spo2: 97, weightKg: 78, heightCm: 172, sugar: 132 },
  divya: { bp: '112/74', pulse: 78, tempF: 98.6, spo2: 99, weightKg: 58, heightCm: 162 },
  neeta: { bp: '118/78', pulse: 76, tempF: 98.2, spo2: 99, weightKg: 64, heightCm: 158 },
  suresh: { bp: '136/86', pulse: 72, tempF: 98.4, spo2: 98, weightKg: 81, heightCm: 170 },
  ishan: { bp: null, pulse: 118, tempF: 100.8, spo2: 97, weightKg: 12, heightCm: 86 },
  myra: { bp: null, pulse: 102, tempF: 98.6, spo2: 99, weightKg: 20, heightCm: 115 },
  rekha: { bp: '124/80', pulse: 74, tempF: 98.4, spo2: 99, weightKg: 62, heightCm: 160 },
  sunil: { bp: '130/84', pulse: 96, tempF: 101.2, spo2: 98, weightKg: 71, heightCm: 168 },
  arifm: { bp: null, pulse: 104, tempF: 99.6, spo2: 98, weightKg: 24, heightCm: 126 },
  shabana: { bp: '116/76', pulse: 80, tempF: 98.4, spo2: 99, weightKg: 66, heightCm: 157 },
};
const COMPLAINTS = {
  ravi: 'Chest tightness on climbing stairs, 2 weeks',
  divya: 'Palpitations on and off, 1 month',
  harish: 'Breathlessness on exertion',
  neeta: 'Right knee pain, 3 weeks',
  suresh: 'Review after lumbar spine physiotherapy',
  anil: 'Left shoulder pain and stiffness',
  ishan: 'Fever and cough, 3 days',
  myra: 'Follow-up after asthma attack',
  ayaan: 'Rash after eating egg',
  rekha: 'Acne follow-up',
  tanvi: 'Hair fall, 2 months',
  sunil: 'Fever with body ache for 3 days',
  arifm: 'Cough and cold for 2 days',
  shabana: 'Irregular periods',
  leela: 'Chest discomfort at night',
  seema: 'BP review after medicine change',
  gopal: 'Low back pain radiating to left leg',
  kiara: 'Vaccination (9 months: MR-1)',
  usha: 'Itchy patches on arms',
  rahul: 'Lipid report review',
};

function vitalsFrom(key, by = 'Sr. Nurse Anita Pawar') {
  const v = VITALS[key];
  if (!v) return null;
  const bmi =
    v.weightKg && v.heightCm ? Math.round((v.weightKg / (v.heightCm / 100) ** 2) * 10) / 10 : null;
  return {
    ...v,
    bmi,
    painScore: key === 'ravi' ? 3 : 1,
    complaint: COMPLAINTS[key] ?? '',
    allergiesConfirmed: true,
    priority: key === 'ravi' ? 'AMBER' : 'GREEN',
    priorityReason: '',
    recordedAt: at('10:44'),
    recordedBy: by,
  };
}

function makeVisit(appt, { token, stage, checkedInAt, key, extras = {} }) {
  const done = stage === 'DONE';
  const hasVitals = ['TRIAGED', 'WITH_DOCTOR', 'DONE'].includes(stage);
  const status = done
    ? extras.ordersPending
      ? 'ORDERS_PENDING'
      : 'CLOSED'
    : stage === 'WITH_DOCTOR'
      ? 'OPEN'
      : hasVitals
        ? 'TRIAGE_DONE'
        : 'OPEN';
  return {
    id: nextId('pv-v'),
    visitNo: `OPV/26-27/${String(++db.visitNo).padStart(6, '0')}`,
    token,
    appointmentId: appt?.id ?? null,
    date: TODAY,
    patient: appt ? appt.patient : card(PATIENTS[key]),
    doctor: appt ? appt.doctor : null,
    visitType: appt?.visitType ?? 'NEW',
    channel: appt?.channel ?? 'WALK_IN',
    walkIn: !appt || appt.channel === 'WALK_IN',
    stage,
    status,
    priority: hasVitals ? (key === 'ravi' ? 'AMBER' : 'GREEN') : null,
    late: false,
    checkedInAt,
    calledAt: stage === 'WITH_DOCTOR' || done ? at('10:52') : null,
    closedAt: done ? at('10:40') : null,
    complaint: COMPLAINTS[key] ?? '',
    vitals: hasVitals ? vitalsFrom(key) : null,
    triageSkipped: null,
    procedures: [],
    fee: appt?.fee ?? { amount: rupees(600), paid: true },
    consultation: null,
    key,
  };
}

function seedToday() {
  for (const [docId, rows] of Object.entries(DAY)) {
    const d = doctor(docId);
    for (const [time, key, status, visitType, channel, token, stage, extras] of rows) {
      const appt = makeAppointment({
        d,
        p: PATIENTS[key],
        date: TODAY,
        time,
        status,
        visitType,
        channel,
        extras: extras ?? {},
      });
      if (token) {
        // Checked in: the fee was collected (or waived) at check-in.
        appt.fee.paid = true;
        const checkedInAt = at(hhmm(Math.max(minutes('09:30'), minutes(time) - 12)));
        const v = makeVisit(appt, { token, stage, checkedInAt, key, extras: extras ?? {} });
        appt.token = token;
        appt.visitId = v.id;
        db.visits.push(v);
      }
      db.appointments.push(appt);
    }
  }
  for (const [docId, key, token, stage, time] of WALK_INS) {
    const d = doctor(docId);
    const v = makeVisit(null, { token, stage, checkedInAt: at(time), key });
    v.doctor = doctorCard(d);
    v.walkIn = true;
    v.fee = { amount: d.fees.NEW, paid: true };
    db.visits.push(v);
  }
  // Ravi's consultation in progress, as on the Consult board.
  const ravi = db.visits.find((v) => v.key === 'ravi');
  ravi.consultation = {
    status: 'DRAFT',
    complaints: 'Chest tightness on climbing stairs, 2 weeks',
    history: 'Known hypertensive 5 years, on amlodipine. No diabetes. Ex-smoker.',
    examination: 'S1 S2 normal, no murmur. Chest clear. No pedal oedema.',
    diagnoses: [
      { code: 'I20.9', name: 'Angina pectoris, unspecified', type: 'PROVISIONAL' },
      { code: 'I10', name: 'Essential (primary) hypertension', type: 'FINAL' },
    ],
    noDiagnosisReason: '',
    rx: [
      rxLine('ecosprin75', '1 tab', 'OD', 30, 'Oral', 'After lunch'),
      rxLine('amlodipine10', '1 tab', 'OD_MORNING', 30, 'Oral', 'Morning'),
      rxLine('atorva40', '1 tab', 'HS', 30, 'Oral', 'After dinner'),
      rxLine('sorbitrate5', '1 tab', 'SOS', 10, 'Sublingual', 'Max 3 in 15 min'),
    ],
    orders: [
      orderLine('LIPID', 'ROUTINE', 'TO_BILL'),
      orderLine('HBA1C', 'ROUTINE', 'TO_BILL'),
      orderLine('ECG', 'TODAY', 'TO_BILL'),
      orderLine('ECHO', 'SCHEDULE', 'DRAFT'),
    ],
    advice:
      'Low salt diet. Walk 30 minutes daily. Go to emergency if chest pain lasts over 15 minutes.',
    followUp: { date: addDays(TODAY, 15), note: 'With lipid and ECG reports' },
    printLanguage: 'en',
    specialty: null,
    certificate: null,
    addenda: [],
    savedAt: at('10:52'),
    signedAt: null,
    signedBy: null,
    version: 3,
  };
}

// ---------------------------------------------------------------------------------------------
// Formulary, ICD-10, orderables and templates
// ---------------------------------------------------------------------------------------------

/** [id, brand, generic, form, allergy group, interaction group] */
const DRUG_ROWS = [
  ['ecosprin75', 'Ecosprin 75 mg tab', 'Aspirin', 'Tablet', 'NSAID', 'ANTIPLATELET'],
  ['clopilet75', 'Clopilet 75 mg tab', 'Clopidogrel', 'Tablet', null, 'ANTIPLATELET'],
  ['amlodipine10', 'Amlodipine 10 mg tab', 'Amlodipine', 'Tablet', null, 'CCB'],
  ['amlodipine5', 'Amlong 5 mg tab', 'Amlodipine', 'Tablet', null, 'CCB'],
  ['telma40', 'Telma 40 mg tab', 'Telmisartan', 'Tablet', null, 'ARB'],
  ['atorva40', 'Atorvastatin 40 mg tab', 'Atorvastatin', 'Tablet', null, 'STATIN'],
  ['rosuvas10', 'Rosuvas 10 mg tab', 'Rosuvastatin', 'Tablet', null, 'STATIN'],
  ['sorbitrate5', 'Sorbitrate 5 mg tab', 'Isosorbide dinitrate', 'Tablet', null, 'NITRATE'],
  ['metoprolol25', 'Metolar XR 25 mg tab', 'Metoprolol succinate', 'Tablet', null, 'BETA'],
  ['glycomet500', 'Glycomet 500 mg tab', 'Metformin', 'Tablet', null, null],
  ['dolo650', 'Dolo 650 mg tab', 'Paracetamol', 'Tablet', null, null],
  ['crocin500', 'Crocin 500 mg tab', 'Paracetamol', 'Tablet', null, null],
  ['calpol', 'Calpol 250 mg/5 ml syrup', 'Paracetamol', 'Syrup', null, null],
  ['brufen400', 'Brufen 400 mg tab', 'Ibuprofen', 'Tablet', 'NSAID', 'NSAID'],
  ['combiflam', 'Combiflam tab', 'Ibuprofen + Paracetamol', 'Tablet', 'NSAID', 'NSAID'],
  ['mox500', 'Mox 500 mg cap', 'Amoxicillin', 'Capsule', 'PENICILLIN', null],
  [
    'augmentin625',
    'Augmentin 625 mg tab',
    'Amoxicillin + Clavulanic acid',
    'Tablet',
    'PENICILLIN',
    null,
  ],
  ['azee500', 'Azee 500 mg tab', 'Azithromycin', 'Tablet', null, 'MACROLIDE'],
  ['cefixime200', 'Taxim-O 200 mg tab', 'Cefixime', 'Tablet', 'CEPHALOSPORIN', null],
  ['septran', 'Septran DS tab', 'Cotrimoxazole', 'Tablet', 'SULFA', null],
  ['cetzine10', 'Cetzine 10 mg tab', 'Cetirizine', 'Tablet', null, null],
  ['allegra120', 'Allegra 120 mg tab', 'Fexofenadine', 'Tablet', null, null],
  ['pan40', 'Pan 40 mg tab', 'Pantoprazole', 'Tablet', null, null],
  ['ors', 'Electral ORS sachet', 'Oral rehydration salts', 'Sachet', null, null],
  ['thyronorm50', 'Thyronorm 50 mcg tab', 'Levothyroxine', 'Tablet', null, null],
  ['montair10', 'Montair 10 mg tab', 'Montelukast', 'Tablet', null, null],
  ['asthalin', 'Asthalin inhaler 100 mcg', 'Salbutamol', 'Inhaler', null, null],
  ['budecort', 'Budecort 200 mcg inhaler', 'Budesonide', 'Inhaler', null, null],
  ['shelcal500', 'Shelcal 500 mg tab', 'Calcium + Vitamin D3', 'Tablet', null, null],
  ['etoshine90', 'Etoshine 90 mg tab', 'Etoricoxib', 'Tablet', 'NSAID', 'NSAID'],
  ['adapalene', 'Adaferin 0.1% gel', 'Adapalene', 'Gel', null, null],
  ['clindac', 'Clindac A gel', 'Clindamycin', 'Gel', null, null],
  ['minoxidil5', 'Mintop 5% solution', 'Minoxidil', 'Solution', null, null],
  ['folvite5', 'Folvite 5 mg tab', 'Folic acid', 'Tablet', null, null],
  ['clarith500', 'Claribid 500 mg tab', 'Clarithromycin', 'Tablet', null, 'MACROLIDE'],
];
const DRUGS = DRUG_ROWS.map(([id, brand, generic, form, allergyGroup, group]) => ({
  id,
  brand,
  generic,
  form,
  allergyGroup,
  group,
}));
/** Patient allergy (lower case) -> drug allergy groups it rules out. */
const ALLERGY_GROUPS = {
  penicillin: ['PENICILLIN'],
  'sulfa drugs': ['SULFA'],
  aspirin: ['NSAID'],
  ibuprofen: ['NSAID'],
};
/** Pairs of interaction groups that need a warning. */
const INTERACTIONS = [
  ['ANTIPLATELET', 'NSAID', 'Bleeding risk: antiplatelet with an NSAID.'],
  ['STATIN', 'MACROLIDE', 'Myopathy risk: statin with clarithromycin or azithromycin.'],
  ['BETA', 'CCB', 'Watch heart rate: beta blocker with a calcium channel blocker.'],
];

function rxLine(drugId, dose, frequency, days, route, instructions) {
  const d = DRUGS.find((x) => x.id === drugId);
  return {
    id: nextId('pv-rx'),
    drugId,
    brand: d.brand,
    generic: d.generic,
    dose,
    frequency,
    days,
    route,
    instructions,
  };
}

const ICD10 = [
  ['I10', 'Essential (primary) hypertension'],
  ['I20.9', 'Angina pectoris, unspecified'],
  ['I21.9', 'Acute myocardial infarction, unspecified'],
  ['I25.10', 'Atherosclerotic heart disease of native coronary artery'],
  ['I48.91', 'Atrial fibrillation, unspecified'],
  ['I50.9', 'Heart failure, unspecified'],
  ['E11.9', 'Type 2 diabetes mellitus without complications'],
  ['E11.65', 'Type 2 diabetes mellitus with hyperglycaemia'],
  ['E03.9', 'Hypothyroidism, unspecified'],
  ['E78.5', 'Hyperlipidaemia, unspecified'],
  ['E66.9', 'Obesity, unspecified'],
  ['D50.9', 'Iron deficiency anaemia, unspecified'],
  ['A90', 'Dengue fever (classical dengue)'],
  ['A01.0', 'Typhoid fever'],
  ['B54', 'Unspecified malaria'],
  ['J06.9', 'Acute upper respiratory infection, unspecified'],
  ['J18.9', 'Pneumonia, unspecified organism'],
  ['J45.909', 'Asthma, unspecified, uncomplicated'],
  ['J30.9', 'Allergic rhinitis, unspecified'],
  ['K21.9', 'Gastro-oesophageal reflux disease without oesophagitis'],
  ['K29.70', 'Gastritis, unspecified'],
  ['K59.00', 'Constipation, unspecified'],
  ['N39.0', 'Urinary tract infection, site not specified'],
  ['M17.11', 'Primary osteoarthritis, right knee'],
  ['M54.5', 'Low back pain'],
  ['M54.16', 'Radiculopathy, lumbar region'],
  ['M75.00', 'Adhesive capsulitis of shoulder'],
  ['M79.1', 'Myalgia'],
  ['L70.0', 'Acne vulgaris'],
  ['L20.9', 'Atopic dermatitis, unspecified'],
  ['L65.9', 'Non-scarring hair loss, unspecified'],
  ['B35.4', 'Tinea corporis'],
  ['T78.1', 'Other adverse food reactions, not elsewhere classified'],
  ['R50.9', 'Fever, unspecified'],
  ['R05', 'Cough'],
  ['R07.4', 'Chest pain, unspecified'],
  ['R51', 'Headache'],
  ['R00.2', 'Palpitations'],
  ['R06.0', 'Dyspnoea'],
  ['N92.6', 'Irregular menstruation, unspecified'],
  ['O80', 'Encounter for full-term uncomplicated delivery'],
  ['Z34.90', 'Encounter for supervision of normal pregnancy'],
  ['Z00.00', 'General adult medical examination'],
  ['Z23', 'Encounter for immunisation'],
  ['Z09', 'Follow-up examination after completed treatment'],
  ['F41.9', 'Anxiety disorder, unspecified'],
  ['G43.909', 'Migraine, unspecified'],
  ['H10.9', 'Conjunctivitis, unspecified'],
  ['K02.9', 'Dental caries, unspecified'],
];

/** [code, name, type, price in rupees] */
const ORDERABLE_ROWS = [
  ['CBC', 'Complete blood count', 'LAB', 350],
  ['LIPID', 'Lipid profile', 'LAB', 650],
  ['HBA1C', 'HbA1c', 'LAB', 450],
  ['FBS', 'Blood sugar, fasting', 'LAB', 80],
  ['PPBS', 'Blood sugar, post-prandial', 'LAB', 80],
  ['LFT', 'Liver function test', 'LAB', 700],
  ['KFT', 'Kidney function test', 'LAB', 650],
  ['TSH', 'Thyroid stimulating hormone', 'LAB', 400],
  ['TROP', 'Troponin I', 'LAB', 1200],
  ['NS1', 'Dengue NS1 antigen', 'LAB', 600],
  ['MPAG', 'Malaria antigen', 'LAB', 450],
  ['WIDAL', 'Widal test', 'LAB', 250],
  ['URINE', 'Urine routine', 'LAB', 200],
  ['UMA', 'Urine micro-albumin', 'LAB', 550],
  ['VITD', 'Vitamin D (25-OH)', 'LAB', 1400],
  ['B12', 'Vitamin B12', 'LAB', 900],
  ['BGRP', 'Blood group and Rh', 'LAB', 150],
  ['CXR', 'Chest X-ray PA view', 'RAD', 450],
  ['USGA', 'Ultrasound abdomen', 'RAD', 1200],
  ['USGOB', 'Ultrasound obstetric', 'RAD', 1500],
  ['ECHO', '2D Echo', 'RAD', 2200],
  ['MRIK', 'MRI knee', 'RAD', 6500],
  ['MRILS', 'MRI lumbar spine', 'RAD', 7000],
  ['ECG', 'ECG 12-lead', 'PROC', 300],
  ['TMT', 'Treadmill test (TMT)', 'PROC', 1800],
  ['DRESS', 'Dressing, small', 'PROC', 250],
  ['INJ', 'Injection, intramuscular', 'PROC', 100],
  ['NEB', 'Nebulisation', 'PROC', 200],
];
const ORDERABLES = ORDERABLE_ROWS.map(([code, name, type, price]) => ({
  code,
  name,
  type,
  price: rupees(price),
}));
function orderLine(code, priority = 'ROUTINE', status = 'DRAFT') {
  const o = ORDERABLES.find((x) => x.code === code);
  return { id: nextId('pv-o'), code, name: o.name, type: o.type, priority, price: o.price, status };
}

const TEMPLATES = [
  {
    id: 'pv-t1',
    name: 'Angina follow-up',
    kind: 'RX',
    department: 'Cardiology',
    owner: 'Dr. Meera Iyer',
    usedThisMonth: 42,
    rx: [
      ['ecosprin75', '1 tab', 'OD', 30, 'Oral', 'After lunch'],
      ['amlodipine10', '1 tab', 'OD_MORNING', 30, 'Oral', 'Morning'],
      ['atorva40', '1 tab', 'HS', 30, 'Oral', 'After dinner'],
      ['sorbitrate5', '1 tab', 'SOS', 10, 'Sublingual', 'Max 3 in 15 min'],
    ],
    advice: 'Low salt diet. Walk 30 minutes daily.',
  },
  {
    id: 'pv-t2',
    name: 'Chest pain work-up',
    kind: 'ORDER_SET',
    department: 'Cardiology',
    owner: 'Department',
    usedThisMonth: 31,
    orders: ['ECG', 'TROP', 'LIPID', 'HBA1C', 'ECHO'],
  },
  {
    id: 'pv-t3',
    name: 'Fever panel',
    kind: 'ORDER_SET',
    department: 'General Medicine',
    owner: 'Department',
    usedThisMonth: 88,
    orders: ['CBC', 'NS1', 'MPAG', 'WIDAL', 'URINE'],
  },
  {
    id: 'pv-t4',
    name: 'Viral fever',
    kind: 'RX',
    department: 'General Medicine',
    owner: 'Dr. R. Menon',
    usedThisMonth: 64,
    rx: [
      ['dolo650', '1 tab', 'SOS', 5, 'Oral', 'If fever, max 4 a day'],
      ['ors', '1 sachet in 1 litre water', 'TDS', 3, 'Oral', 'Through the day'],
      ['cetzine10', '1 tab', 'HS', 5, 'Oral', 'At night'],
    ],
    advice: 'Plenty of fluids. Avoid ibuprofen and aspirin until dengue is ruled out.',
  },
  {
    id: 'pv-t5',
    name: 'Diabetes review',
    kind: 'ORDER_SET',
    department: 'General Medicine',
    owner: 'Department',
    usedThisMonth: 47,
    orders: ['FBS', 'PPBS', 'HBA1C', 'KFT', 'UMA'],
  },
  {
    id: 'pv-t6',
    name: 'Antenatal visit',
    kind: 'SPECIALTY',
    department: 'Gynaecology',
    owner: 'Department',
    usedThisMonth: 64,
    specialty: 'ANTENATAL',
  },
  {
    id: 'pv-t7',
    name: 'Well-baby visit',
    kind: 'SPECIALTY',
    department: 'Paediatrics',
    owner: 'Department',
    usedThisMonth: 57,
    specialty: 'PAEDIATRICS',
  },
];
/** Seeded templates hold compact rows; templates saved from the screen hold full lines. */
const templateOut = (t) => ({
  ...t,
  rx: t.rx?.map((r) => (Array.isArray(r) ? rxLine(...r) : { ...r, id: nextId('pv-rx') })),
  orders: t.orders?.map((c) =>
    typeof c === 'string' ? orderLine(c) : { ...c, id: nextId('pv-o'), status: 'DRAFT' },
  ),
});

// ---------------------------------------------------------------------------------------------
// Slots, queue and visits
// ---------------------------------------------------------------------------------------------

const GRID_DOCTORS = ['pv-d1', 'pv-d2', 'pv-d3', 'pv-d4', 'pv-d5', 'pv-d6'];

function sessionTimes(d) {
  const out = [];
  for (let m = minutes(d.start); m < minutes(d.end); m += d.slot) out.push(hhmm(m));
  return out;
}

/** Pseudo-random but stable bookings for days other than today. */
function seedOtherDay(date) {
  if (db.appointments.some((a) => a.date === date)) return;
  const past = date < TODAY;
  let h = [...date].reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 9973, 7);
  const keys = Object.keys(PATIENTS);
  for (const id of GRID_DOCTORS) {
    const d = doctor(id);
    for (const time of sessionTimes(d)) {
      h = (h * 131 + 17) % 9973;
      if (h % 10 > (past ? 6 : 3)) continue;
      const p = PATIENTS[keys[h % keys.length]];
      const status = past ? (h % 13 === 0 ? 'NO_SHOW' : 'COMPLETED') : 'BOOKED';
      const visitType = h % 4 === 0 ? 'FOLLOW_UP' : 'NEW';
      const channel = ['DESK', 'PHONE', 'PORTAL', 'WHATSAPP'][h % 4];
      db.appointments.push(makeAppointment({ d, p, date, time, status, visitType, channel }));
    }
  }
}

function slotsFor(date, department) {
  if (date !== TODAY) seedOtherDay(date);
  const docs = GRID_DOCTORS.map(doctor).filter((d) => !department || d.department === department);
  const times = [...new Set(docs.flatMap(sessionTimes))].sort();
  const blocked = db.blocks.filter((b) => b.from <= date && b.to >= date);
  const cells = docs.map((d) => {
    const own = new Set(sessionTimes(d));
    const isBlocked = blocked.some((b) => b.doctorId === d.id);
    return {
      doctorId: d.id,
      slots: times.map((time) => {
        if (!own.has(time)) return { time, status: 'NONE' };
        const a = db.appointments.find(
          (x) =>
            x.doctor.id === d.id &&
            x.date === date &&
            x.time === time &&
            !['CANCELLED', 'RESCHEDULED'].includes(x.status),
        );
        if (a) {
          const status = a.status === 'CONFIRMED' ? 'BOOKED' : a.status;
          return { time, status, appointmentId: a.id, patientName: a.patient.name };
        }
        const past = date < TODAY || (date === TODAY && time < CLOCK);
        return { time, status: isBlocked ? 'BLOCKED' : past ? 'PAST' : 'FREE' };
      }),
    };
  });
  return { date, now: date === TODAY ? CLOCK : null, doctors: docs.map(doctorCard), times, cells };
}

const STAGE_ORDER = { WITH_DOCTOR: 0, CALLED: 1, TRIAGED: 2, IN_TRIAGE: 3, WAITING: 4, DONE: 9 };
const PRIORITY_ORDER = { RED: 0, AMBER: 1, GREEN: 2 };

function waited(v) {
  if (v.stage === 'DONE') return null;
  return Math.max(0, Math.round((new Date(NOW) - new Date(v.checkedInAt)) / 60000));
}

function queueEntry(v) {
  return {
    visitId: v.id,
    appointmentId: v.appointmentId,
    token: v.token,
    patient: v.patient,
    doctor: v.doctor,
    visitType: v.visitType,
    walkIn: v.walkIn,
    late: v.late,
    stage: v.stage,
    status: v.status,
    priority: v.priority,
    complaint: v.complaint,
    checkedInAt: v.checkedInAt,
    waitedMin: waited(v),
    feeDue: v.fee && !v.fee.paid ? v.fee.amount : 0,
    vitals: v.vitals,
  };
}

/** Rule R11: red first, then booked on time, then walk-ins, then late arrivals. */
function queueSort(a, b) {
  const s = (STAGE_ORDER[a.stage] ?? 5) - (STAGE_ORDER[b.stage] ?? 5);
  if (s) return s;
  const p = (PRIORITY_ORDER[a.priority] ?? 3) - (PRIORITY_ORDER[b.priority] ?? 3);
  if (a.priority === 'RED' || b.priority === 'RED') return p;
  const l = Number(a.late) - Number(b.late);
  if (l) return l;
  return String(a.checkedInAt).localeCompare(String(b.checkedInAt));
}

function queue({ doctorId, stage }) {
  const docId = doctorId === 'me' ? ME : doctorId;
  let visits = db.visits.filter((v) => v.date === TODAY && (!docId || v.doctor?.id === docId));
  if (stage === 'triage') visits = visits.filter((v) => ['WAITING', 'IN_TRIAGE'].includes(v.stage));
  if (stage === 'doctor')
    visits = visits.filter((v) => ['TRIAGED', 'CALLED', 'WITH_DOCTOR'].includes(v.stage));
  const items = visits.map(queueEntry).sort(queueSort);
  if (stage === 'all' || !stage) {
    // Bookings not yet arrived, in slot order, after the patients in the building.
    const waiting = db.appointments
      .filter(
        (a) =>
          a.date === TODAY &&
          (!docId || a.doctor.id === docId) &&
          ['BOOKED', 'CONFIRMED'].includes(a.status),
      )
      .sort((a, b) => a.time.localeCompare(b.time))
      .map((a) => ({
        visitId: null,
        appointmentId: a.id,
        token: null,
        patient: a.patient,
        doctor: a.doctor,
        visitType: a.visitType,
        walkIn: false,
        late: false,
        stage: 'NOT_ARRIVED',
        status: a.status,
        priority: null,
        slotTime: a.time,
        waitedMin: null,
        feeDue: a.fee.paid ? 0 : a.fee.amount,
      }));
    return { items: [...items, ...waiting], total: items.length + waiting.length, page: 1 };
  }
  return { items, total: items.length, page: 1, limit: 100 };
}

const HISTORY = {
  ravi: [
    [-15, 'OPD', 'Dr. Meera Iyer', 'BP 152/96, amlodipine increased to 10 mg'],
    [-15, 'LAB', 'Lipid profile', 'LDL 168 mg/dL, high'],
    [-129, 'OPD', 'Dr. R. Menon', 'Viral fever, 5 days of paracetamol'],
    [-268, 'CHECKUP', 'Executive health check-up', 'All stations done, physician review normal'],
    [-268, 'RAD', 'Chest X-ray PA view', 'Normal'],
  ],
  seema: [[-12, 'OPD', 'Dr. Meera Iyer', 'Hypertension, telmisartan started']],
  divya: [[-40, 'LAB', 'Thyroid profile', 'TSH 2.1, normal']],
  rekha: [[-30, 'OPD', 'Dr. L. Gupta', 'Acne grade 2, adapalene gel started']],
  suresh: [[-21, 'OPD', 'Dr. P. Joshi', 'Lumbar spondylosis, physiotherapy 10 sessions']],
  myra: [[-9, 'OPD', 'Dr. A. Thomas', 'Acute asthma, nebulised, inhaler started']],
};
function historyFor(v) {
  return (HISTORY[v.key] ?? []).map(([days, kind, title, note], i) => ({
    id: `${v.id}-h${i}`,
    date: at('11:00', addDays(TODAY, days)),
    kind,
    title,
    note,
  }));
}

function visitOut(v) {
  const vitalsTrend =
    v.key === 'ravi'
      ? [
          { date: at('10:30', addDays(TODAY, -268)), bp: '134/86', weightKg: 80 },
          { date: at('10:30', addDays(TODAY, -129)), bp: '140/90', weightKg: 79 },
          { date: at('10:30', addDays(TODAY, -15)), bp: '152/96', weightKg: 78 },
        ]
      : [];
  return {
    id: v.id,
    visitNo: v.visitNo,
    token: v.token,
    appointmentId: v.appointmentId,
    date: v.date,
    patient: v.patient,
    doctor: v.doctor,
    visitType: v.visitType,
    channel: v.channel,
    walkIn: v.walkIn,
    stage: v.stage,
    status: v.status,
    priority: v.priority,
    complaint: v.complaint,
    checkedInAt: v.checkedInAt,
    calledAt: v.calledAt,
    closedAt: v.closedAt,
    waitedMin: waited(v),
    vitals: v.vitals,
    triageSkipped: v.triageSkipped,
    procedures: v.procedures,
    fee: v.fee,
    history: historyFor(v),
    vitalsTrend,
    triageRequired: ['Cardiology', 'General Medicine', 'Paediatrics'].includes(
      v.doctor?.department,
    ),
  };
}

function emptyConsultation(v) {
  return {
    status: 'DRAFT',
    complaints: v.complaint ?? '',
    history: '',
    examination: '',
    diagnoses: [],
    noDiagnosisReason: '',
    rx: [],
    orders: [],
    advice: '',
    followUp: { date: '', note: '' },
    printLanguage: 'en',
    specialty: null,
    certificate: null,
    addenda: [],
    savedAt: null,
    signedAt: null,
    signedBy: null,
    version: 0,
  };
}

function visitById(id) {
  return db.visits.find((v) => v.id === id);
}

function checks(v, rx) {
  const groups = new Set(
    (v.patient.allergies ?? []).flatMap((a) => ALLERGY_GROUPS[a.toLowerCase()] ?? []),
  );
  const allergy = rx
    .map((r) => DRUGS.find((d) => d.id === r.drugId))
    .filter((d) => d && d.allergyGroup && groups.has(d.allergyGroup))
    .map((d) => ({ drug: d.brand, allergy: d.allergyGroup }));
  const present = new Set(
    rx.map((r) => DRUGS.find((d) => d.id === r.drugId)?.group).filter(Boolean),
  );
  const interactions = INTERACTIONS.filter(([a, b]) => present.has(a) && present.has(b)).map(
    ([, , message]) => ({ message }),
  );
  const generics = rx.map((r) => r.generic);
  const duplicates = [...new Set(generics.filter((g, i) => generics.indexOf(g) !== i))];
  return { allergy, interactions, duplicates };
}

function consultationOut(v) {
  const c = v.consultation ?? emptyConsultation(v);
  return { ...c, visitId: v.id, checks: checks(v, c.rx) };
}

/** Bill lines for a visit: consultation (or the free follow-up), orders and in-clinic items. */
function chargesFor(v) {
  const c = v.consultation ?? emptyConsultation(v);
  const lines = [
    {
      id: `${v.id}-c`,
      name:
        v.fee.amount === 0
          ? 'Consultation, free follow-up'
          : `Consultation (${v.visitType === 'FOLLOW_UP' ? 'follow-up' : 'new visit'})`,
      qty: 1,
      amount: v.fee.paid ? 0 : v.fee.amount,
      paid: v.fee.paid,
    },
    ...c.orders.map((o) => ({ id: o.id, name: o.name, qty: 1, amount: o.price, paid: false })),
    ...c.rx
      .filter((r) => ['dolo650', 'ors', 'cetzine10'].includes(r.drugId))
      .map((r) => ({
        id: r.id,
        name: r.brand,
        qty: r.drugId === 'ors' ? 6 : 10,
        amount: r.drugId === 'ors' ? 12000 : r.drugId === 'dolo650' ? 3200 : 2400,
        paid: false,
        stock: 'IN_STOCK',
      })),
  ];
  const total = lines.reduce((s, l) => s + l.amount, 0);
  return { visitId: v.id, lines, total };
}

// ---------------------------------------------------------------------------------------------
// OPD settings, schedules and the other appointment tabs
// ---------------------------------------------------------------------------------------------

const WEEKDAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
function weekFor(d) {
  const session = (start, end, extra = {}) => ({
    start,
    end,
    room: d.room,
    slotNew: d.slot,
    slotFollowUp: Math.max(5, d.slot / 2),
    max: Math.round((minutes(end) - minutes(start)) / d.slot),
    overbook: 2,
    online: true,
    tele: false,
    ...extra,
  });
  if (d.visiting)
    return WEEKDAYS.map((day) => ({
      day,
      sessions: day === 'SAT' ? [session(d.start, d.end, { overbook: 0 })] : [],
    }));
  return WEEKDAYS.map((day) => {
    if (day === 'SUN') return { day, sessions: [] };
    if (day === 'SAT') return { day, sessions: [session(d.start, '12:00', { overbook: 0 })] };
    if (day === 'WED' && d.id === 'pv-d1')
      return {
        day,
        sessions: [
          session(d.start, d.end),
          session('17:00', '19:00', { tele: true, max: 12, online: true }),
        ],
      };
    if (d.id === 'pv-d2' && ['MON', 'WED', 'FRI'].includes(day))
      return { day, sessions: [session(d.start, d.end), session('17:00', '19:00')] };
    if (d.id === 'pv-d2') return { day, sessions: [] };
    return { day, sessions: [session(d.start, d.end)] };
  });
}

function scheduleOut(d) {
  const week = db.weeks[d.id] ?? weekFor(d);
  return {
    doctorId: d.id,
    doctor: doctorCard(d),
    visiting: Boolean(d.visiting),
    sessionsPerWeek: week.reduce((s, w) => s + w.sessions.length, 0),
    week,
    fees: { ...d.fees },
    followUp: { ...d.followUp },
    pendingFeeChange: db.pendingFees[d.id] ?? null,
  };
}

const SETTINGS = {
  booking: {
    bookAheadDays: 30,
    latestBeforeMin: 60,
    holdMin: 5,
    maxFuturePerDoctor: 2,
    walkInEvery: 3,
    lateGraceMin: 15,
    prepayOnline: 'OPTIONAL',
    triageRequired: ['Cardiology', 'General Medicine', 'Paediatrics'],
  },
  cancellation: {
    freeUntilHours: 4,
    keepPercent: 50,
    noShowAfterMin: 30,
    noShowRefund: 'CREDIT',
    prepayAfterNoShows: 3,
    prepayWindowDays: 90,
    hospitalChange: 'FULL_REFUND_OR_FREE_RESCHEDULE',
  },
  pending: null,
};

const TOKEN_SERIES = [
  ['T-', 'Booked OPD', 'T-07', 'DAILY', 'OPD floor 1 TV'],
  ['W-', 'Walk-in OPD', 'W-03', 'DAILY', 'OPD floor 1 TV'],
  ['B-', 'Billing counters', 'B-119', 'DAILY', 'Billing TV'],
  ['S-', 'Sample collection', 'S-064', 'DAILY', 'Lab TV'],
  ['P-', 'Pharmacy', 'P-087', 'DAILY', 'Pharmacy TV'],
].map(([prefix, usedFor, example, resets, display], i) => ({
  id: `pv-ts${i}`,
  prefix,
  usedFor,
  example,
  resets,
  display,
}));

const MESSAGES = [
  ['BOOKING_CONFIRMED', 'AT_BOOKING', ['SMS', 'WHATSAPP'], ['en', 'hi', 'mr'], true],
  ['REMINDER', 'BEFORE_24H_2H', ['SMS', 'WHATSAPP'], ['en', 'hi', 'mr'], true],
  ['TOKEN_NEAR', 'THREE_AWAY', ['SMS'], ['en', 'hi'], true],
  ['FOLLOW_UP_DUE', 'BEFORE_2D', ['WHATSAPP'], ['en', 'hi', 'mr'], true],
  ['FEEDBACK', 'AFTER_2H', ['WHATSAPP'], ['en'], true],
  ['DOCTOR_DELAY', 'DOCTOR_LATE_20', ['SMS'], ['en', 'hi'], false],
].map(([code, when, channels, languages, on]) => ({
  id: code,
  code,
  when,
  channels,
  languages,
  on,
}));

const VISIT_TYPES = [
  ['NEW', 10, 'DOCTOR_FEE', 'STARTS_WINDOW', true, false],
  ['FOLLOW_UP', 5, 'FREE_IN_WINDOW', null, true, true],
  ['TELE', 10, 'TELE_FEE', 'DAYS_15', true, true],
  ['VACCINATION', 5, 'FEE_PLUS_VACCINE', null, true, false],
  ['PROCEDURE', 20, 'PER_PROCEDURE', null, false, false],
  ['HEALTH_CHECK', null, 'PACKAGE', null, true, false],
].map(([code, slotMin, fee, freeFollowUp, online, tele]) => ({
  id: code,
  code,
  slotMin,
  fee,
  freeFollowUp,
  online,
  tele,
}));

const CHECKUPS = [
  ['divya', 'Executive health check', null, 6, 9, 'Eye check', 'PENDING'],
  ['raj', 'Pre-employment', 'TechPark Ltd', 4, 4, null, 'PHYSICIAN_REVIEW'],
  ['priya', 'Women’s wellness', null, 2, 8, 'Mammography', 'PENDING'],
].map(([key, pkg, company, done, stations, next, report], i) => ({
  id: `pv-hc${i}`,
  patient: card(PATIENTS[key]),
  package: pkg,
  company,
  stationsDone: done,
  stations,
  nextStation: next,
  report,
}));

const PLANS = [
  ['sara', 'Physiotherapy, knee', 10, 3, 4, '10:00', 'PACKAGE', 4500],
  ['joseph', 'Root canal and crown', 4, 1, 6, '11:30', 'PER_SESSION', null],
  ['tanvi', 'Laser, acne scars', 6, 2, 13, '17:00', 'PACKAGE', 18000],
].map(([key, plan, sessions, done, inDays, time, billing, amount], i) => ({
  id: `pv-tp${i}`,
  patient: card(PATIENTS[key]),
  plan,
  sessions,
  done,
  nextSession: at(time, addDays(TODAY, inDays)),
  billing,
  amount: amount == null ? null : rupees(amount),
}));

const RESOURCES = [
  ['Procedure room 1', 'ROOM', 'Minor procedures, dressings', 6, 12],
  ['Laser machine', 'EQUIPMENT', 'Dermatology', 3, 8],
  ['Physiotherapist Kiran', 'THERAPIST', 'Physiotherapy', 9, 10],
].map(([name, type, bookableFor, booked, slots], i) => ({
  id: `pv-r${i}`,
  name,
  type,
  bookableFor,
  booked,
  slots,
}));

Object.assign(db, {
  blocks: [],
  weeks: {},
  pendingFees: {},
  checkups: CHECKUPS,
  plans: PLANS,
  resources: RESOURCES,
  tokenSeries: TOKEN_SERIES,
  messages: MESSAGES,
  visitTypes: VISIT_TYPES,
  templates: TEMPLATES,
});
seedToday();

// ---------------------------------------------------------------------------------------------
// Analytics
// ---------------------------------------------------------------------------------------------

function analytics(period = 'today', department) {
  const k = period === 'month' ? 26 : period === 'week' ? 6 : 1;
  const stages = [
    ['ARRIVAL_CHECKIN', 4],
    ['CHECKIN_TRIAGE', 9],
    ['TRIAGE_DOCTOR', period === 'today' ? 18 : 21],
    ['CONSULT', 11],
    ['BILLING', 6],
    ['PHARMACY', 8],
  ].map(([stage, medianMin]) => ({ stage, medianMin }));
  const hours = [
    [8, 12],
    [9, 48],
    [10, 96],
    [11, 88],
    [12, 61],
    [13, 22],
    [14, 9],
    [15, 18],
    [16, 34],
    [17, 24],
  ].map(([hour, count]) => ({ hour, count: count * k }));
  const share = department ? 0.22 : 1;
  const visits = Math.round(412 * k * share);
  return {
    period,
    kpis: {
      visits,
      bookedShare: 68,
      walkInShare: 32,
      medianTotalMin: 64,
      waitToDoctorMin: period === 'today' ? 27 : 29,
      noShowRate: 6.8,
      noShows: Math.round(28 * k * share),
      revenuePerVisit: rupees(1284),
      ipdConversion: 4.4,
      admissions: Math.round(18 * k * share),
    },
    targets: { totalMin: 90, waitToDoctorMin: 30, noShowRate: 8 },
    stages,
    arrivalsByHour: hours,
  };
}

function doctorPerformance(period = 'today', department) {
  const k = period === 'month' ? 26 : period === 'week' ? 6 : 1;
  return [
    ['pv-d1', 18, 15, 1, 0, 19, 12, 94, 1.8, 48200],
    ['pv-d2', 24, 19, 2, 30, 41, 9, 88, 1.2, 39600],
    ['pv-d3', 24, 22, 1, 0, 15, 8, 96, 0.9, 21900],
    ['pv-d4', 18, 16, 2, 0, 12, 7, 91, 0.3, 18400],
    ['pv-d5', 30, 27, 2, 10, 24, 10, 93, 1.5, 52700],
  ]
    .map(([id, booked, seen, noShow, lateMin, wait, consult, util, tests, revenue]) => ({
      doctor: doctorCard(doctor(id)),
      booked: booked * k,
      seen: seen * k,
      noShow: noShow * k,
      lateStartMin: lateMin,
      medianWaitMin: wait,
      medianConsultMin: consult,
      utilisation: util,
      testsPerVisit: tests,
      revenue: rupees(revenue * k),
    }))
    .filter((r) => !department || r.doctor.department === department);
}

// ---------------------------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------------------------

function findAppt(id) {
  return db.appointments.find((a) => a.id === id);
}

function nextToken(walkIn) {
  return walkIn
    ? `W-${String(db.walkInNo++).padStart(2, '0')}`
    : `T-${String(db.tokenNo++).padStart(2, '0')}`;
}

function etaFor(docId) {
  const ahead = db.visits.filter(
    (v) => v.doctor?.id === docId && !['DONE'].includes(v.stage),
  ).length;
  return hhmm(minutes(CLOCK) + Math.max(5, ahead * 8));
}

function checkIn(a, body = {}) {
  if (!['BOOKED', 'CONFIRMED'].includes(a.status))
    return err(
      409,
      'INVALID_STATE',
      `This booking is ${a.status.toLowerCase().replace('_', ' ')}.`,
    );
  const late = minutes(CLOCK) - minutes(a.time) > 15 && a.date === TODAY;
  const token = nextToken(a.channel === 'WALK_IN');
  const key = Object.keys(PATIENTS).find((k) => PATIENTS[k].id === a.patient.id) ?? null;
  const tele = a.visitType === 'TELE';
  const v = {
    id: nextId('pv-v'),
    visitNo: `OPV/26-27/${String(++db.visitNo).padStart(6, '0')}`,
    token,
    appointmentId: a.id,
    date: TODAY,
    patient: a.patient,
    doctor: a.doctor,
    visitType: a.visitType,
    channel: a.channel,
    walkIn: a.channel === 'WALK_IN',
    stage: tele ? 'TRIAGED' : 'WAITING',
    status: 'OPEN',
    priority: null,
    late,
    checkedInAt: NOW,
    calledAt: null,
    closedAt: null,
    complaint: COMPLAINTS[key] ?? body.complaint ?? '',
    vitals: null,
    triageSkipped: tele ? { reason: 'Tele-consultation', by: 'System' } : null,
    procedures: [],
    fee: a.fee,
    consultation: null,
    key,
  };
  db.visits.push(v);
  a.status = 'CHECKED_IN';
  a.token = token;
  a.visitId = v.id;
  a.detailsConfirmed = Boolean(body.detailsConfirmed);
  a.whatsappConsent = Boolean(body.whatsappConsent);
  const next = tele ? 'VIDEO' : a.fee.paid ? 'TRIAGE' : 'BILLING';
  return {
    appointment: a,
    visit: visitOut(v),
    token: { no: token, room: doctor(a.doctor.id).room, eta: etaFor(a.doctor.id), late },
    next,
  };
}

function book(body) {
  const d = doctor(body.doctorId);
  if (!d)
    return err(422, 'VALIDATION_FAILED', 'Pick a doctor.', {
      details: [{ path: 'doctorId', message: 'Pick a doctor.' }],
    });
  const date = body.date ?? TODAY;
  const time = body.time;
  const p = body.patient ?? Object.values(PATIENTS).find((x) => x.id === body.patientId);
  if (!p)
    return err(422, 'VALIDATION_FAILED', 'Pick a patient.', {
      details: [{ path: 'patientId', message: 'Pick a patient.' }],
    });
  const walkIn = body.channel === 'WALK_IN';
  if (!walkIn) {
    const taken = db.appointments.some(
      (a) =>
        a.doctor.id === d.id &&
        a.date === date &&
        a.time === time &&
        !['CANCELLED', 'RESCHEDULED'].includes(a.status),
    );
    if (taken) {
      const free = slotsFor(date)
        .cells.find((c) => c.doctorId === d.id)
        ?.slots.find((s) => s.status === 'FREE' && s.time > time);
      return err(409, 'SLOT_TAKEN', `The ${time} slot was just taken.`, {
        details: free
          ? [{ path: 'time', message: `Next free slot: ${free.time}`, nextFree: free.time }]
          : [],
      });
    }
    // Rule R17: at most 2 future bookings per doctor.
    const open = db.appointments.filter(
      (a) =>
        a.patient.id === p.id &&
        a.doctor.id === d.id &&
        a.date >= TODAY &&
        ['BOOKED', 'CONFIRMED'].includes(a.status),
    ).length;
    if (open >= 2)
      return err(409, 'TOO_MANY_BOOKINGS', `${p.name} already has 2 open bookings with ${d.name}.`);
  }
  // Rule R4: free follow-up with the same doctor within the window.
  const lastPaid = db.appointments.find(
    (a) =>
      a.patient.id === p.id && a.doctor.id === d.id && a.status === 'COMPLETED' && a.fee.amount > 0,
  );
  const extras = {};
  if (body.visitType === 'FOLLOW_UP' && lastPaid) extras.freeDay = 1;
  const a = makeAppointment({
    d,
    p,
    date,
    time: time ?? CLOCK,
    status: 'BOOKED',
    visitType: body.visitType ?? 'NEW',
    channel: body.channel ?? 'DESK',
    extras,
  });
  a.notes = body.notes ?? '';
  db.appointments.push(a);
  if (walkIn) return checkIn(a, { detailsConfirmed: true });
  return a;
}

export const handlers = {
  'GET /opd/doctors': ({ query }) => {
    const items = DOCTORS.filter(
      (d) => (!query.department || d.department === query.department) && like(d.name, query.q),
    ).map((d) => ({
      ...doctorCard(d),
      qualification: d.qualification,
      regNo: d.regNo,
      designation: d.designation,
      fees: d.fees,
      followUp: d.followUp,
      visiting: Boolean(d.visiting),
    }));
    return { items, total: items.length, page: 1, limit: 100 };
  },
  'GET /opd/departments': () => {
    const items = [...new Set(DOCTORS.map((d) => d.department))].map((name) => ({
      id: name,
      name,
    }));
    return { items, total: items.length, page: 1, limit: 100 };
  },
  'GET /opd/slots': ({ query }) => slotsFor(query.date || TODAY, query.department || null),

  'GET /opd/appointments': ({ query }) => {
    const date = query.date || TODAY;
    if (date !== TODAY) seedOtherDay(date);
    let items = db.appointments.filter((a) => a.date === date);
    if (query.doctorId) items = items.filter((a) => a.doctor.id === query.doctorId);
    if (query.status) items = items.filter((a) => query.status.split(',').includes(a.status));
    if (query.q)
      items = items.filter(
        (a) =>
          like(a.patient.name, query.q) ||
          like(a.patient.uhid, query.q) ||
          like(a.patient.mobile, query.q) ||
          like(a.apptNo, query.q),
      );
    if (query.from) items = items.filter((a) => a.time >= query.from);
    items = [...items].sort((a, b) => a.time.localeCompare(b.time));
    return page(items, { limit: 100, ...query });
  },
  'GET /opd/appointments/:id': ({ params }) =>
    findAppt(params.id) ?? err(404, 'NOT_FOUND', 'Booking not found.'),
  'POST /opd/appointments': ({ body }) => book(body ?? {}),
  'POST /opd/appointments/:id/check-in': ({ params, body }) => {
    const a = findAppt(params.id);
    return a ? checkIn(a, body) : err(404, 'NOT_FOUND', 'Booking not found.');
  },
  'POST /opd/appointments/:id/reschedule': ({ params, body }) => {
    const a = findAppt(params.id);
    if (!a) return err(404, 'NOT_FOUND', 'Booking not found.');
    if (!['BOOKED', 'CONFIRMED'].includes(a.status))
      return err(409, 'INVALID_STATE', 'Only a booking that has not arrived can be moved.');
    const moved = book({
      patientId: a.patient.id,
      patient: a.patient,
      doctorId: body.doctorId ?? a.doctor.id,
      date: body.date ?? a.date,
      time: body.time,
      visitType: a.visitType,
      channel: a.channel,
    });
    if (moved.__status) return moved;
    moved.fee = a.fee;
    a.status = 'RESCHEDULED';
    a.rescheduledTo = moved.id;
    a.reason = body.reason ?? '';
    return { appointment: moved, previous: a };
  },
  'POST /opd/appointments/:id/cancel': ({ params, body }) => {
    const a = findAppt(params.id);
    if (!a) return err(404, 'NOT_FOUND', 'Booking not found.');
    if (!['BOOKED', 'CONFIRMED'].includes(a.status))
      return err(409, 'INVALID_STATE', 'Only a booking that has not arrived can be cancelled.');
    a.status = 'CANCELLED';
    a.reason = body?.reason ?? '';
    // Rule R9: free until 4 h before the slot, then 50% of a prepaid fee is kept as credit.
    const hoursLeft = (new Date(a.slotStart) - new Date(NOW)) / 3_600_000;
    const refund = a.fee.prepaid
      ? hoursLeft >= 4
        ? { amount: a.fee.amount, mode: 'ORIGINAL' }
        : { amount: Math.round(a.fee.amount / 2), mode: 'CREDIT' }
      : null;
    return { appointment: a, refund };
  },
  'POST /opd/appointments/:id/no-show': ({ params }) => {
    const a = findAppt(params.id);
    if (!a) return err(404, 'NOT_FOUND', 'Booking not found.');
    a.status = 'NO_SHOW';
    return a;
  },

  'GET /opd/queue': ({ query }) => queue({ doctorId: query.doctorId, stage: query.stage }),
  'GET /opd/queue/display': () => {
    const rooms = GRID_DOCTORS.map(doctor).map((d) => {
      const q = queue({ doctorId: d.id, stage: 'doctor' }).items;
      const now = q.find((x) => x.stage === 'WITH_DOCTOR' || x.stage === 'CALLED');
      const next = q.find((x) => x !== now && x.stage === 'TRIAGED');
      return { doctor: doctorCard(d), now: now?.token ?? null, next: next?.token ?? null };
    });
    return {
      title: 'OPD Floor 1',
      rooms,
      counters: [
        { name: 'Billing', current: 'B-119' },
        { name: 'Pharmacy', current: 'P-087' },
        { name: 'Sample collection', current: 'S-064' },
      ],
      updatedAt: new Date().toISOString(),
    };
  },

  'GET /opd/visits/:id': ({ params }) => {
    const v = visitById(params.id);
    return v ? visitOut(v) : err(404, 'NOT_FOUND', 'Visit not found.');
  },
  'POST /opd/visits/:id/start-triage': ({ params }) => {
    const v = visitById(params.id);
    if (!v) return err(404, 'NOT_FOUND', 'Visit not found.');
    for (const o of db.visits) if (o.stage === 'IN_TRIAGE' && o.id !== v.id) o.stage = 'WAITING';
    v.stage = 'IN_TRIAGE';
    return visitOut(v);
  },
  'POST /opd/visits/:id/vitals': ({ params, body }) => {
    const v = visitById(params.id);
    if (!v) return err(404, 'NOT_FOUND', 'Visit not found.');
    if (body.priority === 'RED' && !String(body.priorityReason ?? '').trim())
      return err(422, 'VALIDATION_FAILED', 'Give the reason for a red flag.', {
        details: [{ path: 'priorityReason', message: 'Give the reason for a red flag.' }],
      });
    const bmi =
      body.weightKg && body.heightCm
        ? Math.round((body.weightKg / (body.heightCm / 100) ** 2) * 10) / 10
        : null;
    v.vitals = { ...body, bmi, recordedAt: new Date().toISOString(), recordedBy: 'You' };
    v.priority = body.priority ?? 'GREEN';
    v.complaint = body.complaint ?? v.complaint;
    if (['WAITING', 'IN_TRIAGE'].includes(v.stage)) v.stage = 'TRIAGED';
    if (v.status === 'OPEN') v.status = 'TRIAGE_DONE';
    return visitOut(v);
  },
  'POST /opd/visits/:id/skip-triage': ({ params, body }) => {
    const v = visitById(params.id);
    if (!v) return err(404, 'NOT_FOUND', 'Visit not found.');
    v.triageSkipped = { reason: body.reason, by: 'You', at: new Date().toISOString() };
    v.stage = 'TRIAGED';
    return visitOut(v);
  },
  'POST /opd/visits/:id/procedures': ({ params, body }) => {
    const v = visitById(params.id);
    if (!v) return err(404, 'NOT_FOUND', 'Visit not found.');
    const p = { id: nextId('pv-pr'), ...body, recordedAt: new Date().toISOString(), by: 'You' };
    v.procedures.push(p);
    return p;
  },
  'POST /opd/visits/:id/call': ({ params }) => {
    const v = visitById(params.id);
    if (!v) return err(404, 'NOT_FOUND', 'Visit not found.');
    // The doctor's previous patient goes back to waiting; the called one is with the doctor.
    v.stage = 'WITH_DOCTOR';
    v.calledAt = new Date().toISOString();
    const a = findAppt(v.appointmentId);
    if (a) a.status = 'IN_CONSULT';
    return visitOut(v);
  },
  'POST /opd/visits/:id/skip': ({ params, body }) => {
    const v = visitById(params.id);
    if (!v) return err(404, 'NOT_FOUND', 'Visit not found.');
    v.late = true;
    v.skipReason = body?.reason ?? '';
    if (v.stage === 'WITH_DOCTOR' || v.stage === 'CALLED') v.stage = 'TRIAGED';
    return visitOut(v);
  },
  'POST /opd/visits/:id/move': ({ params, body }) => {
    const v = visitById(params.id);
    if (!v) return err(404, 'NOT_FOUND', 'Visit not found.');
    if (!String(body?.reason ?? '').trim())
      return err(422, 'VALIDATION_FAILED', 'A queue move needs a reason (rule R11).');
    v.priority = 'RED';
    v.moveReason = body.reason;
    return visitOut(v);
  },
  'GET /opd/visits/:id/consultation': ({ params }) => {
    const v = visitById(params.id);
    return v ? consultationOut(v) : err(404, 'NOT_FOUND', 'Visit not found.');
  },
  'PUT /opd/visits/:id/consultation': ({ params, body }) => {
    const v = visitById(params.id);
    if (!v) return err(404, 'NOT_FOUND', 'Visit not found.');
    const cur = v.consultation ?? emptyConsultation(v);
    if (cur.status === 'SIGNED')
      return err(
        409,
        'INVALID_STATE',
        'This consultation is signed. Add an addendum instead (rule R14).',
      );
    v.consultation = {
      ...cur,
      ...body,
      status: 'DRAFT',
      savedAt: new Date().toISOString(),
      version: cur.version + 1,
    };
    return consultationOut(v);
  },
  'POST /opd/visits/:id/complete': ({ params, body }) => {
    const v = visitById(params.id);
    if (!v) return err(404, 'NOT_FOUND', 'Visit not found.');
    const c = { ...(v.consultation ?? emptyConsultation(v)), ...(body ?? {}) };
    if (!c.diagnoses?.length && !String(c.noDiagnosisReason ?? '').trim())
      return err(
        422,
        'NO_DIAGNOSIS',
        'Add at least one diagnosis, or the reason there is none (rule R13).',
        {
          details: [
            {
              path: 'diagnoses',
              message: 'Add at least one diagnosis, or the reason there is none.',
            },
          ],
        },
      );
    v.consultation = {
      ...c,
      status: 'SIGNED',
      signedAt: new Date().toISOString(),
      signedBy: v.doctor?.name ?? 'Doctor',
      savedAt: new Date().toISOString(),
      version: (c.version ?? 0) + 1,
    };
    v.stage = 'DONE';
    v.status = c.orders?.length ? 'ORDERS_PENDING' : 'CLOSED';
    v.closedAt = new Date().toISOString();
    const a = findAppt(v.appointmentId);
    if (a) a.status = 'COMPLETED';
    let followUp = null;
    if (c.followUp?.date) {
      followUp = book({
        patientId: v.patient.id,
        patient: v.patient,
        doctorId: v.doctor.id,
        date: c.followUp.date,
        time: '11:00',
        visitType: 'FOLLOW_UP',
        channel: 'DESK',
      });
      if (followUp.__status) followUp = null;
    }
    const next = queue({ doctorId: v.doctor?.id, stage: 'doctor' }).items.find(
      (x) => x.stage === 'TRIAGED',
    );
    return { visit: visitOut(v), consultation: consultationOut(v), followUp, next: next ?? null };
  },
  'POST /opd/visits/:id/addenda': ({ params, body }) => {
    const v = visitById(params.id);
    if (!v?.consultation) return err(404, 'NOT_FOUND', 'Consultation not found.');
    const a = {
      id: nextId('pv-ad'),
      text: body.text,
      by: v.doctor?.name,
      at: new Date().toISOString(),
    };
    v.consultation.addenda = [...(v.consultation.addenda ?? []), a];
    return consultationOut(v);
  },
  'POST /opd/visits/:id/share': ({ params, body }) => {
    const v = visitById(params.id);
    if (!v) return err(404, 'NOT_FOUND', 'Visit not found.');
    return {
      sentTo: v.patient.mobile,
      channel: body?.channel ?? 'WHATSAPP',
      at: new Date().toISOString(),
    };
  },
  'POST /opd/visits/:id/admission-request': ({ params, body }) => {
    const v = visitById(params.id);
    if (!v) return err(404, 'NOT_FOUND', 'Visit not found.');
    v.admissionRequest = { id: nextId('pv-adm'), ...body, status: 'REQUESTED' };
    return v.admissionRequest;
  },
  'POST /opd/visits/:id/referral': ({ params, body }) => {
    const v = visitById(params.id);
    if (!v) return err(404, 'NOT_FOUND', 'Visit not found.');
    const d = doctor(body.doctorId);
    if (!d) return err(422, 'VALIDATION_FAILED', 'Pick the doctor to refer to.');
    const slot = slotsFor(TODAY)
      .cells.find((c) => c.doctorId === d.id)
      ?.slots.find((s) => s.status === 'FREE');
    return {
      id: nextId('pv-ref'),
      doctor: doctorCard(d),
      slot: slot?.time ?? null,
      note: body.note,
      priority: body.priority,
    };
  },
  'POST /opd/visits/:id/certificates': ({ params, body }) => {
    const v = visitById(params.id);
    if (!v) return err(404, 'NOT_FOUND', 'Visit not found.');
    const cert = {
      id: nextId('pv-cert'),
      no: `MC/26-27/${String(seq).padStart(6, '0')}`,
      ...body,
      signedAt: new Date().toISOString(),
      signedBy: v.doctor?.name,
    };
    if (v.consultation) v.consultation.certificate = cert;
    return cert;
  },
  'GET /opd/visits/:id/charges': ({ params }) => {
    const v = visitById(params.id);
    return v ? chargesFor(v) : err(404, 'NOT_FOUND', 'Visit not found.');
  },
  'POST /opd/visits/:id/close': ({ params, body }) => {
    const v = visitById(params.id);
    if (!v) return err(404, 'NOT_FOUND', 'Visit not found.');
    const charges = chargesFor(v);
    v.fee = { ...v.fee, paid: true };
    v.stage = 'DONE';
    v.status = 'CLOSED';
    v.closedAt = new Date().toISOString();
    if (v.consultation) v.consultation.status = 'SIGNED';
    const a = findAppt(v.appointmentId);
    if (a) a.status = 'COMPLETED';
    return {
      visit: visitOut(v),
      receipt: {
        no: `RC/26-27/${String(++seq).padStart(6, '0')}`,
        amount: charges.total,
        mode: body?.mode ?? 'UPI',
      },
      outputs: body?.outputs ?? [],
    };
  },

  'GET /opd/icd10': ({ query }) => {
    const q = String(query.q ?? '').trim();
    const items = ICD10.filter(([code, name]) => like(code, q) || like(name, q))
      .slice(0, 12)
      .map(([code, name]) => ({ code, name }));
    return { items, total: items.length, page: 1, limit: 12 };
  },
  'GET /opd/formulary': ({ query }) => {
    const q = String(query.q ?? '').trim();
    const items = DRUGS.filter((d) => like(d.brand, q) || like(d.generic, q)).slice(0, 10);
    return { items, total: items.length, page: 1, limit: 10 };
  },
  'GET /opd/orderables': ({ query }) => {
    const q = String(query.q ?? '').trim();
    const items = ORDERABLES.filter(
      (o) => (like(o.name, q) || like(o.code, q)) && (!query.type || o.type === query.type),
    ).slice(0, 12);
    return { items, total: items.length, page: 1, limit: 12 };
  },
  'GET /opd/templates': ({ query }) => {
    const items = db.templates
      .filter((t) => !query.kind || t.kind === query.kind)
      .filter((t) => like(t.name, query.q))
      .map(templateOut);
    return { items, total: items.length, page: 1, limit: 100 };
  },
  'POST /opd/templates': ({ body }) => {
    const t = { id: nextId('pv-t'), usedThisMonth: 0, owner: 'You', ...body };
    db.templates.push(t);
    return templateOut(t);
  },

  'GET /opd/schedules': ({ query }) => {
    const items = DOCTORS.filter((d) => like(d.name, query.q)).map(scheduleOut);
    return { items, total: items.length, page: 1, limit: 100 };
  },
  'GET /opd/schedules/:doctorId': ({ params }) => {
    const d = doctor(params.doctorId);
    return d ? scheduleOut(d) : err(404, 'NOT_FOUND', 'Doctor not found.');
  },
  'PUT /opd/schedules/:doctorId': ({ params, body }) => {
    const d = doctor(params.doctorId);
    if (!d) return err(404, 'NOT_FOUND', 'Doctor not found.');
    if (body.week) db.weeks[d.id] = body.week;
    const feeChanged =
      body.fees &&
      Object.keys(d.fees).some((k) => body.fees[k] != null && body.fees[k] !== d.fees[k]);
    if (body.followUp) d.followUp = { ...d.followUp, ...body.followUp };
    if (feeChanged) {
      db.pendingFees[d.id] = { fees: body.fees, approvalId: nextId('pv-apr') };
      return {
        __status: 202,
        ...scheduleOut(d),
        approval: { id: db.pendingFees[d.id].approvalId, status: 'PENDING' },
      };
    }
    return scheduleOut(d);
  },
  'POST /opd/schedules/:doctorId/blocks': ({ params, body }) => {
    const d = doctor(params.doctorId);
    if (!d) return err(404, 'NOT_FOUND', 'Doctor not found.');
    const block = {
      id: nextId('pv-blk'),
      doctorId: d.id,
      from: body.from,
      to: body.to ?? body.from,
      reason: body.reason,
    };
    db.blocks.push(block);
    const affected = db.appointments.filter(
      (a) =>
        a.doctor.id === d.id &&
        a.date >= block.from &&
        a.date <= block.to &&
        ['BOOKED', 'CONFIRMED'].includes(a.status),
    );
    return { block, affected };
  },
  'POST /opd/appointments/bulk-move': ({ body }) => {
    const moved = [];
    for (const id of body.appointmentIds ?? []) {
      const a = findAppt(id);
      if (!a || !['BOOKED', 'CONFIRMED'].includes(a.status)) continue;
      const d = doctor(body.doctorId) ?? doctor(a.doctor.id);
      a.doctor = doctorCard(d);
      if (body.date) a.date = body.date;
      a.slotStart = at(a.time, a.date);
      moved.push(a.id);
    }
    return { moved: moved.length, messaged: moved.length };
  },
  'GET /opd/settings': () => SETTINGS,
  'PUT /opd/settings': ({ body }) => {
    if (body.cancellation) {
      SETTINGS.pending = {
        section: 'cancellation',
        values: body.cancellation,
        approvalId: nextId('pv-apr'),
      };
      return {
        __status: 202,
        ...SETTINGS,
        approval: { id: SETTINGS.pending.approvalId, status: 'PENDING' },
      };
    }
    if (body.booking) SETTINGS.booking = { ...SETTINGS.booking, ...body.booking };
    return SETTINGS;
  },
  'GET /opd/token-series': () => ({
    items: db.tokenSeries,
    total: db.tokenSeries.length,
    page: 1,
    limit: 100,
  }),
  'POST /opd/token-series': ({ body }) => {
    const s = { id: nextId('pv-ts'), example: `${body.prefix}01`, ...body };
    db.tokenSeries.push(s);
    return s;
  },
  'GET /opd/message-templates': () => ({
    items: db.messages,
    total: db.messages.length,
    page: 1,
    limit: 100,
  }),
  'PUT /opd/message-templates/:id': ({ params, body }) => {
    const m = db.messages.find((x) => x.id === params.id);
    if (!m) return err(404, 'NOT_FOUND', 'Message not found.');
    Object.assign(m, body);
    return m;
  },
  'GET /opd/visit-types': () => ({
    items: db.visitTypes,
    total: db.visitTypes.length,
    page: 1,
    limit: 100,
  }),
  'POST /opd/visit-types': ({ body }) => {
    const v = { id: body.code, ...body };
    db.visitTypes.push(v);
    return v;
  },

  'GET /opd/health-checkups': ({ query }) => page(db.checkups, query),
  'POST /opd/health-checkups': ({ body }) => {
    const p = body.patient ?? card(PATIENTS.priya);
    const c = {
      id: nextId('pv-hc'),
      patient: p,
      package: body.package,
      company: body.company || null,
      stationsDone: 0,
      stations: body.stations ?? 8,
      nextStation: 'Registration',
      report: 'PENDING',
    };
    db.checkups.unshift(c);
    return c;
  },
  'POST /opd/health-checkups/import': ({ body }) => {
    const rows = String(body?.csv ?? '')
      .split(/\r?\n/)
      .filter((r) => r.trim())
      .slice(1);
    return { received: rows.length, booked: rows.length, errors: [] };
  },
  'GET /opd/tele-consults': () => {
    const items = db.appointments
      .filter((a) => a.date === TODAY && a.visitType === 'TELE')
      .map((a) => ({
        id: a.id,
        time: a.time,
        patient: a.patient,
        doctor: a.doctor,
        paid: a.fee.amount,
        consent: true,
        status:
          a.status === 'IN_CONSULT'
            ? 'IN_CALL'
            : a.status === 'COMPLETED'
              ? 'DONE'
              : a.time <= '11:45'
                ? 'WAITING_ROOM'
                : 'SCHEDULED',
      }));
    return { items, total: items.length, page: 1, limit: 100 };
  },
  'POST /opd/tele-consults/:id/start': ({ params }) => {
    const a = findAppt(params.id);
    if (!a) return err(404, 'NOT_FOUND', 'Booking not found.');
    a.status = 'IN_CONSULT';
    return { joinUrl: `https://meet.example.in/opd/${a.id}`, appointment: a };
  },
  'GET /opd/treatment-plans': ({ query }) => page(db.plans, query),
  'POST /opd/treatment-plans': ({ body }) => {
    const p = {
      id: nextId('pv-tp'),
      patient: body.patient,
      plan: body.plan,
      sessions: body.sessions,
      done: 0,
      nextSession: body.firstSession
        ? new Date(`${body.firstSession}:00+05:30`).toISOString()
        : null,
      billing: body.billing,
      amount: body.amount ?? null,
    };
    db.plans.unshift(p);
    return p;
  },
  'GET /opd/resources': ({ query }) => page(db.resources, query),
  'POST /opd/resources': ({ body }) => {
    const r = { id: nextId('pv-r'), booked: 0, ...body };
    db.resources.push(r);
    return r;
  },

  'GET /reports/opd-wait-times': ({ query }) => analytics(query.period, query.department),
  'GET /reports/opd-doctor-performance': ({ query }) => {
    const items = doctorPerformance(query.period, query.department);
    return { items, total: items.length, page: 1, limit: 100 };
  },
};
