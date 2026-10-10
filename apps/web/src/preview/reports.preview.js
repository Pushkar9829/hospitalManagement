/**
 * Preview: reports centre (catalogue, report runner, exports, schedules) until /reports lands.
 * Planned contract (all under /api/v1):
 *   GET  /reports                     -> { groups: [{ code, name, reports: [{ code, name, permission, description }] }] }
 *   GET  /reports/:code?from&to&branchId&<filter>&page&limit
 *        -> { code, name, group, description, period: { from, to }, filters: [{ key, label, options }],
 *             kpis: [{ key, label, value, kind, note }], columns: [{ key, label, kind }],
 *             items, total, page, limit, generatedAt }
 *   POST /reports/:code/export { format: 'XLSX' | 'PDF', filters } -> export (202-like: status RUNNING)
 *   GET  /reports/exports?page&limit  -> { items: export[], total, page, limit }
 *   GET  /reports/exports/:id/download -> { url, filename }
 *   GET  /reports/schedules          -> { items: schedule[], total, page, limit }
 *   POST /reports/schedules { reportCode, frequency, time, dayOfWeek?, dayOfMonth?, recipients[], format }
 *   PUT  /reports/schedules/:id { active } · DELETE /reports/schedules/:id
 * Kinds: text, id, money (paise), count, percent, date, datetime, minutes, days, status ({ label, tone }).
 */
import {
  BRANCHES,
  DOCTORS,
  PATIENTS,
  STAFF,
  at,
  inMinutes,
  newId,
  notFound,
  page,
  rs,
  ymd,
} from './coreadmin.seed.js';

const ok = (label) => ({ label, tone: 'success' });
const warn = (label) => ({ label, tone: 'warning' });
const bad = (label) => ({ label, tone: 'critical' });
const info = (label) => ({ label, tone: 'info' });

const DEPTS = [
  'Cardiology',
  'General Medicine',
  'Orthopaedics',
  'Paediatrics',
  'Obstetrics and Gynaecology',
  'General Surgery',
];

/** Report definitions: code, name, group, permission, description, columns, rows, kpis, filters. */
const DEFS = [];
function R(group, perm, code, name, description, cols, rows, kpis = [], filters = []) {
  DEFS.push({
    group,
    permission: `reports:${perm}:read`,
    code,
    name,
    description,
    cols,
    rows,
    kpis,
    filters,
  });
}
const deptFilter = { key: 'department', label: 'Department', options: DEPTS };
const doctorFilter = { key: 'doctor', label: 'Doctor', options: DOCTORS.map((d) => d[0]) };
const modeFilter = {
  key: 'mode',
  label: 'Payment mode',
  options: ['Cash', 'UPI', 'Card', 'Bank transfer'],
};

// ---------------------------------------------------------------- Front office and OPD
const G1 = 'Front office and OPD';
R(
  G1,
  'opd',
  'opd-register',
  'Daily OPD register',
  'Every OPD visit of the day with doctor, visit type and bill.',
  [
    ['token', 'Token', 'id'],
    ['uhid', 'UHID', 'id'],
    ['patient', 'Patient', 'text'],
    ['doctor', 'Doctor', 'text'],
    ['type', 'Visit', 'text'],
    ['checkIn', 'Checked in', 'datetime'],
    ['bill', 'Bill', 'id'],
    ['amount', 'Amount', 'money'],
  ],
  PATIENTS.map((p, i) => [
    `T-${101 + i}`,
    p.uhid,
    p.name,
    DOCTORS[i % 6][0],
    i % 3 ? 'Follow-up' : 'New',
    at(0, `0${9 + (i % 1)}:${String(5 + i * 6).padStart(2, '0')}`),
    `OP/26-27/000${148 + i}`,
    rs([800, 500, 1200, 500, 600, 800, 500, 1500][i]),
  ]),
  [
    ['visits', 'Visits', 142, 'count', '38 new, 104 follow-up'],
    ['revenue', 'OPD revenue', rs(1_18_400), 'money'],
    ['doctors', 'Doctors on duty', 14, 'count'],
    ['noShow', 'No-shows', 9, 'count', '6% of booked'],
  ],
  [deptFilter, doctorFilter],
);
R(
  G1,
  'opd',
  'opd-doctor-footfall',
  'Doctor-wise footfall',
  'Visits per doctor, new against follow-up, with revenue.',
  [
    ['doctor', 'Doctor', 'text'],
    ['department', 'Department', 'text'],
    ['new', 'New', 'count'],
    ['followUp', 'Follow-up', 'count'],
    ['total', 'Total', 'count'],
    ['revenue', 'Revenue', 'money'],
  ],
  DOCTORS.map(([d, dep], i) => [
    d,
    dep,
    [12, 9, 7, 6, 8, 4][i],
    [28, 21, 14, 16, 11, 6][i],
    [40, 30, 21, 22, 19, 10][i],
    rs([36000, 18000, 21000, 19800, 11400, 9000][i]),
  ]),
  [
    ['visits', 'Visits', 142, 'count'],
    ['busiest', 'Busiest doctor', 'Dr. Meera Iyer', 'text', '40 visits'],
    ['avg', 'Average per doctor', 10.1, 'count'],
  ],
  [deptFilter],
);
R(
  G1,
  'opd',
  'opd-new-vs-followup',
  'New vs follow-up',
  'Share of new and follow-up visits by department.',
  [
    ['department', 'Department', 'text'],
    ['new', 'New', 'count'],
    ['followUp', 'Follow-up', 'count'],
    ['newShare', 'New share', 'percent'],
  ],
  DEPTS.map((d, i) => [
    d,
    [12, 9, 7, 8, 5, 4][i],
    [28, 21, 15, 11, 9, 6][i],
    [30, 30, 31.8, 42.1, 35.7, 40][i],
  ]),
  [
    ['new', 'New visits', 45, 'count'],
    ['followUp', 'Follow-up visits', 90, 'count'],
    ['share', 'New share', 33.3, 'percent'],
  ],
);
R(
  G1,
  'opd',
  'opd-wait-times',
  'Waiting and consultation time',
  'Minutes from check-in to doctor and in the room.',
  [
    ['doctor', 'Doctor', 'text'],
    ['visits', 'Visits', 'count'],
    ['wait', 'Median wait', 'minutes'],
    ['p90', '90th percentile wait', 'minutes'],
    ['consult', 'Median consultation', 'minutes'],
  ],
  DOCTORS.map(([d], i) => [
    d,
    [40, 30, 21, 22, 19, 10][i],
    [18, 22, 14, 26, 12, 9][i],
    [41, 48, 30, 55, 25, 20][i],
    [7, 6, 9, 8, 6, 11][i],
  ]),
  [
    ['wait', 'Median wait', 18, 'minutes', 'target under 20'],
    ['consult', 'Median consultation', 7, 'minutes'],
    ['over30', 'Waited over 30 min', 21, 'count'],
  ],
  [doctorFilter],
);
R(
  G1,
  'opd',
  'opd-no-show',
  'No-show rate',
  'Booked appointments that did not arrive, by doctor and channel.',
  [
    ['doctor', 'Doctor', 'text'],
    ['booked', 'Booked', 'count'],
    ['noShow', 'No-show', 'count'],
    ['rate', 'Rate', 'percent'],
    ['channel', 'Main channel', 'text'],
  ],
  DOCTORS.map(([d], i) => [
    d,
    [32, 25, 18, 20, 16, 9][i],
    [2, 1, 2, 3, 1, 0][i],
    [6.3, 4, 11.1, 15, 6.3, 0][i],
    ['Phone', 'Portal', 'Walk-in', 'Phone', 'Portal', 'Phone'][i],
  ]),
  [
    ['booked', 'Booked', 120, 'count'],
    ['noShow', 'No-shows', 9, 'count'],
    ['rate', 'No-show rate', 7.5, 'percent', 'target under 8%'],
  ],
);
R(
  G1,
  'crm',
  'opd-referral-source',
  'Referral source',
  'Where new patients came from.',
  [
    ['source', 'Source', 'text'],
    ['patients', 'New patients', 'count'],
    ['revenue', 'Revenue', 'money'],
    ['share', 'Share', 'percent'],
  ],
  [
    ['Walk-in', 18, rs(14400), 40],
    ['Referring doctor', 11, rs(13200), 24.4],
    ['Website and portal', 8, rs(6400), 17.8],
    ['Health camp', 5, rs(2500), 11.1],
    ['Corporate', 3, rs(2400), 6.7],
  ],
  [
    ['newPatients', 'New patients', 45, 'count'],
    ['topSource', 'Top source', 'Walk-in', 'text'],
  ],
);

// ---------------------------------------------------------------- IPD and beds
const G2 = 'IPD and beds';
R(
  G2,
  'ipd',
  'ipd-admission-register',
  'Admission and discharge register',
  'Admissions and discharges with ward, consultant and payer.',
  [
    ['ip', 'IP no.', 'id'],
    ['uhid', 'UHID', 'id'],
    ['patient', 'Patient', 'text'],
    ['ward', 'Ward and bed', 'text'],
    ['consultant', 'Consultant', 'text'],
    ['admitted', 'Admitted', 'datetime'],
    ['discharged', 'Discharged', 'datetime'],
    ['payer', 'Payer', 'text'],
  ],
  PATIENTS.slice(0, 6).map((p, i) => [
    `IP/26-27/000${865 + i}`,
    p.uhid,
    p.name,
    ['W2-204-B', 'W3-PVT-312', 'ICU-04', 'W2-201-A', 'W1-108-A', 'MAT-05'][i],
    DOCTORS[i][0],
    at(3 - (i % 3), '11:20'),
    i % 2 ? at(0, '12:40') : null,
    ['Medi Assist', 'Tata Motors', 'Self', 'CGHS', 'Bajaj Auto', 'Self'][i],
  ]),
  [
    ['admissions', 'Admissions', 18, 'count'],
    ['discharges', 'Discharges', 15, 'count'],
    ['occupancy', 'Occupancy', 84, 'percent'],
    ['alos', 'Average stay', 4.2, 'days'],
  ],
  [deptFilter],
);
R(
  G2,
  'ipd',
  'ipd-occupancy-alos',
  'Bed occupancy and ALOS',
  'Occupancy and average length of stay by ward.',
  [
    ['ward', 'Ward', 'text'],
    ['beds', 'Beds', 'count'],
    ['occupied', 'Occupied', 'count'],
    ['occupancy', 'Occupancy', 'percent'],
    ['alos', 'ALOS', 'days'],
  ],
  [
    ['General ward 1', 30, 26, 86.7, 3.8],
    ['General ward 2', 30, 27, 90, 4.1],
    ['Private rooms', 24, 18, 75, 3.2],
    ['ICU', 12, 11, 91.7, 5.6],
    ['Maternity', 16, 12, 75, 2.9],
    ['Paediatric', 8, 7, 87.5, 3.4],
  ],
  [
    ['beds', 'Beds', 120, 'count'],
    ['occupancy', 'Occupancy', 84.2, 'percent', 'target 80 to 90%'],
    ['alos', 'ALOS', 4.2, 'days'],
  ],
);
R(
  G2,
  'ipd',
  'ipd-midnight-census',
  'Midnight census',
  'Patients in each ward at midnight (bed-day charges).',
  [
    ['ward', 'Ward', 'text'],
    ['opening', 'Opening', 'count'],
    ['admitted', 'Admitted', 'count'],
    ['discharged', 'Discharged', 'count'],
    ['transfers', 'Transfers in/out', 'text'],
    ['midnight', 'At midnight', 'count'],
  ],
  [
    ['General ward 1', 25, 4, 3, '+1 / -1', 26],
    ['General ward 2', 26, 3, 2, '0 / 0', 27],
    ['Private rooms', 17, 4, 3, '0 / 0', 18],
    ['ICU', 10, 2, 0, '0 / -1', 11],
    ['Maternity', 11, 3, 2, '0 / 0', 12],
  ],
  [
    ['census', 'Midnight census', 101, 'count'],
    ['bedDays', 'Bed-day charges posted', 101, 'count'],
  ],
);
R(
  G2,
  'billing',
  'ipd-deposit-vs-bill',
  'Deposit vs bill',
  'Running bill against deposit for each admitted patient.',
  [
    ['ip', 'IP no.', 'id'],
    ['patient', 'Patient', 'text'],
    ['payer', 'Payer', 'text'],
    ['bill', 'Running bill', 'money'],
    ['deposit', 'Deposit', 'money'],
    ['gap', 'Shortfall', 'money'],
    ['status', 'Status', 'status'],
  ],
  PATIENTS.slice(0, 6).map((p, i) => [
    `IP/26-27/000${865 + i}`,
    p.name,
    ['Medi Assist', 'Tata Motors', 'Self', 'CGHS', 'Bajaj Auto', 'Self'][i],
    rs([84200, 68400, 41250, 22800, 42300, 31500][i]),
    rs([50000, 0, 50000, 0, 0, 20000][i]),
    rs([34200, 0, 0, 0, 0, 11500][i]),
    [
      warn('Top-up due'),
      ok('Corporate credit'),
      ok('Covered'),
      ok('Scheme'),
      ok('Corporate credit'),
      warn('Top-up due'),
    ][i],
  ]),
  [
    ['running', 'Running bills', rs(2_90_450), 'money'],
    ['deposits', 'Deposits held', rs(1_20_000), 'money'],
    ['short', 'Patients short of deposit', 2, 'count'],
  ],
);
R(
  G2,
  'ipd',
  'ipd-discharge-tat',
  'Discharge turnaround',
  'Time from discharge advice to the patient leaving.',
  [
    ['ip', 'IP no.', 'id'],
    ['patient', 'Patient', 'text'],
    ['advised', 'Advised', 'datetime'],
    ['billed', 'Final bill', 'datetime'],
    ['left', 'Left', 'datetime'],
    ['tat', 'Turnaround', 'minutes'],
  ],
  PATIENTS.slice(0, 5).map((p, i) => [
    `IP/26-27/000${855 + i}`,
    p.name,
    at(0, `0${9 + (i % 1)}:${10 + i * 7}`),
    at(0, `1${0 + (i % 2)}:${15 + i * 5}`),
    at(0, `1${1 + (i % 2)}:${20 + i * 4}`),
    [130, 185, 150, 210, 160][i],
  ]),
  [
    ['median', 'Median turnaround', 160, 'minutes', 'target under 180'],
    ['over3h', 'Over 3 hours', 2, 'count'],
  ],
);

// ---------------------------------------------------------------- Clinical
const G3 = 'Clinical';
R(
  G3,
  'mrd',
  'clinical-morbidity-icd',
  'Morbidity by ICD-10',
  'Diagnoses coded at discharge and in OPD, by ICD-10 chapter.',
  [
    ['code', 'ICD-10', 'id'],
    ['diagnosis', 'Diagnosis', 'text'],
    ['opd', 'OPD', 'count'],
    ['ipd', 'IPD', 'count'],
    ['total', 'Total', 'count'],
  ],
  [
    ['I10', 'Essential hypertension', 64, 8, 72],
    ['E11', 'Type 2 diabetes mellitus', 51, 6, 57],
    ['J18', 'Pneumonia', 9, 12, 21],
    ['I21', 'Acute myocardial infarction', 0, 6, 6],
    ['O80', 'Normal delivery', 0, 14, 14],
    ['A90', 'Dengue fever', 11, 9, 20],
  ],
  [
    ['coded', 'Records coded', 412, 'count'],
    ['uncoded', 'Waiting for coding', 18, 'count'],
  ],
);
R(
  G3,
  'nursing',
  'nursing-task-compliance',
  'Nursing task compliance',
  'Charted tasks done on time by ward.',
  [
    ['ward', 'Ward', 'text'],
    ['due', 'Tasks due', 'count'],
    ['onTime', 'On time', 'count'],
    ['late', 'Late', 'count'],
    ['missed', 'Missed', 'count'],
    ['rate', 'Compliance', 'percent'],
  ],
  [
    ['General ward 1', 412, 389, 19, 4, 94.4],
    ['General ward 2', 398, 371, 22, 5, 93.2],
    ['ICU', 286, 281, 5, 0, 98.3],
    ['Private rooms', 240, 228, 10, 2, 95],
  ],
  [
    ['rate', 'Compliance', 95.0, 'percent', 'target 95%'],
    ['missed', 'Missed tasks', 11, 'count'],
  ],
);
R(
  G3,
  'nursing',
  'mar-delays',
  'Medication administration delays',
  'Doses given more than 30 minutes late.',
  [
    ['time', 'Due', 'datetime'],
    ['patient', 'Patient', 'text'],
    ['bed', 'Bed', 'id'],
    ['drug', 'Drug', 'text'],
    ['delay', 'Delay', 'minutes'],
    ['nurse', 'Nurse', 'text'],
    ['reason', 'Reason', 'text'],
  ],
  [
    [
      at(0, '06:00'),
      'Ravi Kumar',
      'W2-204-B',
      'Enoxaparin 40 mg',
      45,
      'Anjali Menon',
      'Patient in X-ray',
    ],
    [
      at(0, '08:00'),
      'Lata Joshi',
      'W2-201-A',
      'Metformin 500 mg',
      35,
      'Seema P.',
      'Stock from pharmacy',
    ],
    [at(1, '22:00'), 'Sanjay Patil', 'ICU-04', 'Ceftriaxone 1 g', 40, 'Ramesh K.', 'Line change'],
  ],
  [
    ['delayed', 'Delayed doses', 3, 'count'],
    ['share', 'Of all doses', 0.4, 'percent'],
  ],
);
R(
  G3,
  'lab',
  'critical-value-log',
  'Critical value log',
  'Critical results, who was told and how fast.',
  [
    ['time', 'Result', 'datetime'],
    ['patient', 'Patient', 'text'],
    ['test', 'Test', 'text'],
    ['value', 'Value', 'text'],
    ['informed', 'Informed', 'text'],
    ['minutes', 'Minutes to inform', 'minutes'],
  ],
  [
    [at(0, '07:42'), 'Ravi Kumar', 'Potassium', '6.4 mmol/L', 'Dr. Meera Iyer', 9],
    [at(0, '09:15'), 'Sanjay Patil', 'Troponin I', '2.8 ng/mL', 'Dr. Meera Iyer', 6],
    [at(1, '23:10'), 'Fatima Shaikh', 'Haemoglobin', '6.1 g/dL', 'Dr. Priya Nair', 14],
  ],
  [
    ['critical', 'Critical results', 3, 'count'],
    ['median', 'Median time to inform', 9, 'minutes', 'target under 15'],
  ],
);
R(
  G3,
  'quality',
  'infection-rates',
  'Infection rates',
  'Device-associated and surgical-site infections per 1,000 device days.',
  [
    ['indicator', 'Indicator', 'text'],
    ['cases', 'Cases', 'count'],
    ['days', 'Device days', 'count'],
    ['rate', 'Rate per 1,000', 'text'],
    ['status', 'Status', 'status'],
  ],
  [
    ['CLABSI', 1, 412, '2.4', ok('Within benchmark')],
    ['CAUTI', 2, 520, '3.8', warn('Watch')],
    ['VAP', 0, 186, '0.0', ok('Within benchmark')],
    ['Surgical site infection', 2, 148, '1.4 %', ok('Within benchmark')],
  ],
  [['hai', 'Hospital-acquired infections', 5, 'count']],
);

// ---------------------------------------------------------------- Diagnostics
const G4 = 'Diagnostics';
R(
  G4,
  'lab',
  'lab-tat',
  'Lab TAT by stage',
  'Turnaround from order to report, split by stage.',
  [
    ['section', 'Section', 'text'],
    ['tests', 'Tests', 'count'],
    ['collect', 'Order to collection', 'minutes'],
    ['receive', 'Collection to receipt', 'minutes'],
    ['report', 'Receipt to report', 'minutes'],
    ['withinTat', 'Within TAT', 'percent'],
  ],
  [
    ['Biochemistry', 612, 22, 14, 48, 94.1],
    ['Haematology', 488, 18, 12, 32, 96.3],
    ['Microbiology', 74, 30, 20, 2880, 88.0],
    ['Clinical pathology', 142, 25, 16, 40, 95.1],
    ['Serology', 96, 24, 15, 95, 91.7],
  ],
  [
    ['tests', 'Tests reported', 1412, 'count'],
    ['withinTat', 'Within TAT', 94.2, 'percent', 'target 95%'],
    ['stat', 'STAT median', 52, 'minutes'],
  ],
);
R(
  G4,
  'lab',
  'lab-sample-rejections',
  'Sample rejections',
  'Rejected samples with reason and collection point.',
  [
    ['sample', 'Sample', 'id'],
    ['patient', 'Patient', 'text'],
    ['test', 'Test', 'text'],
    ['reason', 'Reason', 'text'],
    ['from', 'Collected at', 'text'],
    ['time', 'Rejected', 'datetime'],
  ],
  [
    ['LB-26-018840', 'Lata Joshi', 'Potassium', 'Haemolysed', 'Ward 2', at(0, '08:05')],
    ['LB-26-018851', 'Anil Pawar', 'HbA1c', 'Clotted', 'OPD collection', at(0, '10:12')],
    [
      'LB-26-018733',
      'Fatima Shaikh',
      'Urine culture',
      'Unlabelled',
      'Home collection',
      at(1, '16:40'),
    ],
  ],
  [
    ['rejected', 'Rejected', 3, 'count'],
    ['rate', 'Rejection rate', 0.8, 'percent', 'target under 1%'],
  ],
);
R(
  G4,
  'lab',
  'lab-test-volume',
  'Test volume and revenue',
  'Tests done and revenue by test.',
  [
    ['test', 'Test', 'text'],
    ['count', 'Tests', 'count'],
    ['revenue', 'Revenue', 'money'],
    ['outsourced', 'Sent out', 'count'],
  ],
  [
    ['Complete blood count', 312, rs(93600), 0],
    ['Liver function test', 118, rs(70800), 0],
    ['HbA1c', 96, rs(48000), 0],
    ['Thyroid profile', 88, rs(52800), 0],
    ['Vitamin D', 41, rs(57400), 41],
    ['Culture and sensitivity', 74, rs(59200), 0],
  ],
  [
    ['tests', 'Tests', 1412, 'count'],
    ['revenue', 'Revenue', rs(4_82_000), 'money'],
  ],
);
R(
  G4,
  'rad',
  'rad-tat',
  'Radiology TAT',
  'Time from scan to signed report by modality.',
  [
    ['modality', 'Modality', 'text'],
    ['studies', 'Studies', 'count'],
    ['median', 'Median TAT', 'minutes'],
    ['p90', '90th percentile', 'minutes'],
    ['withinTat', 'Within TAT', 'percent'],
  ],
  [
    ['X-ray', 86, 35, 70, 96.5],
    ['Ultrasound', 42, 25, 50, 97.6],
    ['CT', 18, 90, 180, 88.9],
    ['MRI', 9, 180, 300, 88.9],
  ],
  [
    ['studies', 'Studies', 155, 'count'],
    ['withinTat', 'Within TAT', 94.8, 'percent'],
  ],
);
R(
  G4,
  'rad',
  'pcpndt-form-f',
  'PCPNDT Form F register',
  'Every obstetric ultrasound with Form F status (statutory).',
  [
    ['formNo', 'Form F no.', 'id'],
    ['patient', 'Patient', 'text'],
    ['date', 'Scan date', 'date'],
    ['indication', 'Indication', 'text'],
    ['doctor', 'Performed by', 'text'],
    ['status', 'Status', 'status'],
  ],
  [
    [
      'FF/26-27/0412',
      'Fatima Shaikh',
      ymd(0),
      'Anomaly scan, 20 weeks',
      'Dr. Priya Nair',
      ok('Complete'),
    ],
    ['FF/26-27/0411', 'Kiran Deshmukh', ymd(-1), 'Dating scan', 'Dr. Priya Nair', ok('Complete')],
    [
      'FF/26-27/0410',
      'Seema Rao',
      ymd(-1),
      'Growth scan',
      'Dr. Priya Nair',
      warn('Declaration pending'),
    ],
  ],
  [
    ['forms', 'Forms this month', 46, 'count'],
    ['pending', 'Incomplete', 1, 'count', 'submit by the 5th'],
  ],
);

// ---------------------------------------------------------------- Pharmacy and stock
const G5 = 'Pharmacy and stock';
R(
  G5,
  'pharmacy',
  'pharmacy-daily-sales',
  'Daily sales',
  'Pharmacy sales by counter and mode.',
  [
    ['bill', 'Bill', 'id'],
    ['time', 'Time', 'datetime'],
    ['patient', 'Patient', 'text'],
    ['items', 'Items', 'count'],
    ['mode', 'Mode', 'text'],
    ['amount', 'Amount', 'money'],
  ],
  PATIENTS.slice(0, 6).map((p, i) => [
    `PH/26-27/00452${i}`,
    at(0, `1${i % 2}:${10 + i * 6}`),
    p.name,
    [3, 5, 2, 7, 1, 4][i],
    ['UPI', 'Cash', 'Card', 'UPI', 'Cash', 'UPI'][i],
    rs([1840, 2260, 420, 3980, 160, 1230][i]),
  ]),
  [
    ['sales', 'Sales', rs(1_38_770), 'money'],
    ['bills', 'Bills', 214, 'count'],
    ['returns', 'Returns', rs(2_150), 'money'],
  ],
  [modeFilter],
);
R(
  G5,
  'inventory',
  'stock-valuation',
  'Stock valuation',
  'Stock value at cost by store and category.',
  [
    ['store', 'Store', 'text'],
    ['category', 'Category', 'text'],
    ['items', 'Items', 'count'],
    ['value', 'Value at cost', 'money'],
    ['mrp', 'Value at MRP', 'money'],
  ],
  [
    ['Main pharmacy', 'Medicines', 1840, rs(18_42_000), rs(26_10_000)],
    ['Main pharmacy', 'Surgical', 412, rs(4_12_500), rs(5_80_000)],
    ['Central store', 'Consumables', 286, rs(6_25_000), rs(6_25_000)],
    ['OT store', 'Implants', 64, rs(9_80_000), rs(12_40_000)],
  ],
  [
    ['value', 'Stock at cost', rs(38_59_500), 'money'],
    ['items', 'Items', 2602, 'count'],
  ],
);
R(
  G5,
  'pharmacy',
  'expiry-report',
  'Expiry report',
  'Batches expiring in the next 90 days.',
  [
    ['drug', 'Drug', 'text'],
    ['batch', 'Batch', 'id'],
    ['expiry', 'Expiry', 'date'],
    ['qty', 'Quantity', 'count'],
    ['value', 'Value', 'money'],
    ['action', 'Action', 'status'],
  ],
  [
    ['Amoxicillin 500 mg', 'AMX2405', ymd(24), 180, rs(1620), warn('Return to vendor')],
    ['Pantoprazole 40 mg inj', 'PNT2311', ymd(41), 60, rs(2940), info('Use first')],
    ['Insulin glargine', 'GLR2402', ymd(12), 8, rs(6400), bad('Expiring soon')],
  ],
  [
    ['batches', 'Batches expiring', 23, 'count'],
    ['value', 'Value at risk', rs(48_600), 'money'],
  ],
);
R(
  G5,
  'pharmacy',
  'fast-slow-moving',
  'Fast and slow moving',
  'Items by movement in the last 90 days.',
  [
    ['drug', 'Drug', 'text'],
    ['issued', 'Issued (90 days)', 'count'],
    ['stock', 'In stock', 'count'],
    ['daysCover', 'Days of cover', 'days'],
    ['class', 'Class', 'status'],
  ],
  [
    ['Paracetamol 650 mg', 9200, 2400, 23, ok('Fast')],
    ['Pantoprazole 40 mg', 5100, 1800, 32, ok('Fast')],
    ['Atorvastatin 20 mg', 1800, 900, 45, info('Normal')],
    ['Rabies immunoglobulin', 4, 20, 450, warn('Slow')],
  ],
  [
    ['fast', 'Fast movers', 212, 'count'],
    ['slow', 'Slow movers', 148, 'count'],
    ['dead', 'No movement', 37, 'count'],
  ],
);
R(
  G5,
  'pharmacy',
  'schedule-h1-register',
  'Schedule H1 register',
  'Statutory register of Schedule H1 drugs sold.',
  [
    ['date', 'Date', 'date'],
    ['bill', 'Bill', 'id'],
    ['patient', 'Patient', 'text'],
    ['prescriber', 'Prescriber', 'text'],
    ['drug', 'Drug', 'text'],
    ['qty', 'Quantity', 'count'],
  ],
  [
    [ymd(0), 'PH/26-27/004521', 'Anil Pawar', 'Dr. Sanjay Kulkarni', 'Cefixime 200 mg', 10],
    [ymd(0), 'PH/26-27/004524', 'Lata Joshi', 'Dr. Sanjay Kulkarni', 'Levofloxacin 500 mg', 7],
    [ymd(-1), 'PH/26-27/004498', 'Sanjay Patil', 'Dr. Meera Iyer', 'Alprazolam 0.25 mg', 10],
  ],
  [['entries', 'Entries this month', 186, 'count']],
);
R(
  G5,
  'inventory',
  'purchase-register',
  'Purchase register',
  'Goods received with vendor, invoice and GST.',
  [
    ['grn', 'GRN', 'id'],
    ['date', 'Date', 'date'],
    ['vendor', 'Vendor', 'text'],
    ['invoice', 'Invoice', 'id'],
    ['taxable', 'Taxable value', 'money'],
    ['gst', 'GST', 'money'],
    ['total', 'Total', 'money'],
  ],
  [
    [
      'GRN/26-27/000318',
      ymd(0),
      'Medplus Distributors',
      'MPD/4471',
      rs(84_200),
      rs(4_210),
      rs(88_410),
    ],
    [
      'GRN/26-27/000317',
      ymd(-1),
      'Pune Surgicals',
      'PS/2026/918',
      rs(42_000),
      rs(5_040),
      rs(47_040),
    ],
    ['GRN/26-27/000316', ymd(-2), 'Cipla Ltd', 'CIP/88213', rs(1_20_500), rs(6_025), rs(1_26_525)],
  ],
  [
    ['purchases', 'Purchases this month', rs(18_40_000), 'money'],
    ['grns', 'GRNs', 41, 'count'],
  ],
);

// ---------------------------------------------------------------- Billing and finance
const G6 = 'Billing and finance';
R(
  G6,
  'billing',
  'daily-collection',
  'Daily collection by mode',
  'Collection by counter, cashier and payment mode for the day.',
  [
    ['counter', 'Counter', 'text'],
    ['cashier', 'Cashier', 'text'],
    ['cash', 'Cash', 'money'],
    ['upi', 'UPI', 'money'],
    ['card', 'Card', 'money'],
    ['deposits', 'Deposits', 'money'],
    ['total', 'Total', 'money'],
  ],
  [
    ['Billing 1', STAFF.neha.name, rs(22_650), rs(58_200), rs(31_630), 0, rs(1_12_480)],
    ['Billing 2', STAFF.ravi.name, rs(31_400), rs(61_000), rs(42_300), 0, rs(1_34_700)],
    ['Pharmacy', STAFF.suresh.name, rs(28_900), rs(71_400), rs(38_470), 0, rs(1_38_770)],
    [
      'Admission desk',
      STAFF.rohit.name,
      rs(13_500),
      rs(24_000),
      rs(20_500),
      rs(38_400),
      rs(96_400),
    ],
  ],
  [
    ['total', 'Total', rs(4_82_350), 'money'],
    ['bills', 'Bills', 412, 'count'],
    ['refunds', 'Refunds', rs(9_050), 'money'],
    ['net', 'Net', rs(4_73_300), 'money'],
  ],
  [modeFilter],
);
R(
  G6,
  'billing',
  'revenue-by-department',
  'Revenue by department and doctor',
  'Gross, discount and net revenue by department.',
  [
    ['department', 'Department', 'text'],
    ['gross', 'Gross', 'money'],
    ['discount', 'Discount', 'money'],
    ['net', 'Net', 'money'],
    ['share', 'Share', 'percent'],
  ],
  DEPTS.map((d, i) => [
    d,
    rs([18_40_000, 12_10_000, 9_80_000, 4_20_000, 7_60_000, 11_30_000][i]),
    rs([22_000, 18_500, 9_000, 4_100, 6_200, 15_800][i]),
    rs([18_18_000, 11_91_500, 9_71_000, 4_15_900, 7_53_800, 11_14_200][i]),
    [29.3, 19.2, 15.6, 6.7, 12.1, 17.9][i],
  ]),
  [
    ['gross', 'Gross revenue', rs(63_40_000), 'money'],
    ['discount', 'Discounts', rs(75_600), 'money', '1.2% of gross'],
    ['net', 'Net revenue', rs(62_64_400), 'money'],
  ],
  [deptFilter, doctorFilter],
);
R(
  G6,
  'billing',
  'discount-refund-register',
  'Discount and refund register',
  'Every discount and refund with approver and reason.',
  [
    ['bill', 'Bill', 'id'],
    ['patient', 'Patient', 'text'],
    ['type', 'Type', 'text'],
    ['amount', 'Amount', 'money'],
    ['reason', 'Reason', 'text'],
    ['approver', 'Approved by', 'text'],
    ['time', 'Time', 'datetime'],
  ],
  [
    [
      'OP/26-27/000155',
      'Ravi Kumar',
      'Discount 15%',
      rs(360),
      'Senior staff relative',
      'Kavita Desai',
      at(0, '10:52'),
    ],
    [
      'RC/26-27/004498',
      'Anil Pawar',
      'Refund',
      rs(1_200),
      'Test not done',
      'Kavita Desai',
      at(0, '09:40'),
    ],
    [
      'IP/26-27/F/000312',
      'Lata Joshi',
      'Discount ₹5,000',
      rs(5_000),
      'Hardship, MS approved',
      'Dr. Arjun Rao',
      at(1, '17:15'),
    ],
  ],
  [
    ['discounts', 'Discounts', rs(6_360), 'money'],
    ['refunds', 'Refunds', rs(9_050), 'money'],
    ['unapproved', 'Without approval', 0, 'count'],
  ],
);
R(
  G6,
  'billing',
  'outstanding-ageing',
  'Outstanding and ageing',
  'Receivables by payer and age bucket.',
  [
    ['payer', 'Payer type', 'text'],
    ['b0', '0 to 30 days', 'money'],
    ['b31', '31 to 60', 'money'],
    ['b61', '61 to 90', 'money'],
    ['b90', 'Over 90', 'money'],
    ['total', 'Total', 'money'],
  ],
  [
    ['Patient dues', rs(4_20_000), rs(1_10_000), rs(60_000), rs(90_000), rs(6_80_000)],
    ['Corporate', rs(9_05_740), rs(3_52_000), rs(3_12_000), 0, rs(15_69_740)],
    ['Insurance and TPA', rs(38_20_000), rs(14_60_000), rs(5_90_000), rs(2_50_000), rs(61_20_000)],
    ['Government schemes', rs(12_40_000), rs(6_80_000), rs(2_20_000), rs(1_10_000), rs(22_50_000)],
  ],
  [
    ['total', 'Receivables', rs(1_06_19_740), 'money'],
    ['over90', 'Over 90 days', rs(4_50_000), 'money', '4.2% of total'],
  ],
);
R(
  G6,
  'finance',
  'gst-registers',
  'GST registers',
  'Taxable, exempt and GST by rate (GSTR-1 ready).',
  [
    ['rate', 'Rate', 'text'],
    ['hsn', 'HSN/SAC', 'id'],
    ['taxable', 'Taxable value', 'money'],
    ['cgst', 'CGST', 'money'],
    ['sgst', 'SGST', 'money'],
    ['invoices', 'Invoices', 'count'],
  ],
  [
    ['Exempt (health care)', '9993', rs(52_40_000), 0, 0, 3812],
    ['5% (room above ₹5,000)', '9993', rs(3_12_000), rs(7_800), rs(7_800), 48],
    ['5% (medicines, OPD)', '3004', rs(6_80_000), rs(17_000), rs(17_000), 2140],
    ['18% (cafeteria, other)', '9963', rs(42_000), rs(3_780), rs(3_780), 410],
  ],
  [
    ['taxable', 'Taxable value', rs(10_34_000), 'money'],
    ['gst', 'GST', rs(57_160), 'money'],
    ['exempt', 'Exempt value', rs(52_40_000), 'money'],
  ],
);
R(
  G6,
  'finance',
  'doctor-payouts',
  'Doctor payouts',
  'Visiting doctor shares by service, ready for payment.',
  [
    ['doctor', 'Doctor', 'text'],
    ['cases', 'Cases', 'count'],
    ['billed', 'Billed', 'money'],
    ['share', 'Share %', 'percent'],
    ['payout', 'Payout', 'money'],
    ['tds', 'TDS', 'money'],
  ],
  [
    ['Dr. Vikram Shah', 22, rs(4_80_000), 40, rs(1_92_000), rs(19_200)],
    ['Dr. Amol Deshpande', 14, rs(3_60_000), 35, rs(1_26_000), rs(12_600)],
    ['Dr. Farah Khan', 31, rs(1_24_000), 50, rs(62_000), rs(6_200)],
  ],
  [
    ['payout', 'Total payout', rs(3_80_000), 'money'],
    ['tds', 'TDS', rs(38_000), 'money'],
  ],
  [doctorFilter],
);

// ---------------------------------------------------------------- HR and payroll
const G7 = 'HR and payroll';
R(
  G7,
  'hr',
  'headcount-attrition',
  'Headcount and attrition',
  'Headcount, joiners and leavers by department.',
  [
    ['department', 'Department', 'text'],
    ['headcount', 'Headcount', 'count'],
    ['joined', 'Joined', 'count'],
    ['left', 'Left', 'count'],
    ['attrition', 'Attrition (annual)', 'percent'],
  ],
  [
    ['Nursing', 168, 6, 4, 18.2],
    ['Doctors', 64, 2, 1, 6.1],
    ['Billing and front office', 42, 1, 2, 22.4],
    ['Laboratory', 28, 1, 0, 8.6],
    ['Housekeeping', 74, 4, 5, 31.0],
  ],
  [
    ['headcount', 'Headcount', 412, 'count'],
    ['attrition', 'Attrition', 16.8, 'percent'],
  ],
);
R(
  G7,
  'hr',
  'attendance-overtime',
  'Attendance and overtime',
  'Attendance and overtime hours by department.',
  [
    ['department', 'Department', 'text'],
    ['present', 'Present days', 'count'],
    ['absent', 'Absent', 'count'],
    ['late', 'Late marks', 'count'],
    ['otHours', 'Overtime hours', 'count'],
  ],
  [
    ['Nursing', 4380, 46, 62, 412],
    ['Billing and front office', 1090, 12, 18, 36],
    ['Laboratory', 728, 6, 9, 54],
    ['Housekeeping', 1920, 41, 33, 120],
  ],
  [
    ['attendance', 'Attendance', 97.1, 'percent'],
    ['ot', 'Overtime hours', 622, 'count'],
  ],
);
R(
  G7,
  'hr',
  'leave-register',
  'Leave register',
  'Leave taken and balance by employee.',
  [
    ['employee', 'Employee', 'text'],
    ['code', 'Employee ID', 'id'],
    ['type', 'Leave', 'text'],
    ['from', 'From', 'date'],
    ['days', 'Days', 'count'],
    ['status', 'Status', 'status'],
  ],
  [
    ['Anjali Menon', 'EMP0118', 'Casual', ymd(3), 2, ok('Approved')],
    ['Lalit G.', 'EMP0207', 'Sick', ymd(-2), 1, ok('Approved')],
    ['Neha Kulkarni', 'EMP0164', 'Earned', ymd(12), 5, warn('Waiting')],
  ],
  [
    ['onLeave', 'On leave today', 14, 'count'],
    ['pending', 'Waiting for approval', 6, 'count'],
  ],
);
R(
  G7,
  'payroll',
  'payroll-register',
  'Payroll register',
  'Gross, deductions and net pay by employee.',
  [
    ['employee', 'Employee', 'text'],
    ['code', 'Employee ID', 'id'],
    ['gross', 'Gross', 'money'],
    ['deductions', 'Deductions', 'money'],
    ['net', 'Net pay', 'money'],
  ],
  [
    ['Anjali Menon', 'EMP0118', rs(38_500), rs(4_820), rs(33_680)],
    ['Neha Kulkarni', 'EMP0164', rs(28_000), rs(3_160), rs(24_840)],
    ['Lalit G.', 'EMP0207', rs(32_000), rs(3_840), rs(28_160)],
    ['Rohit Verma', 'EMP0172', rs(26_500), rs(2_980), rs(23_520)],
  ],
  [
    ['gross', 'Gross payroll', rs(1_42_80_000), 'money'],
    ['net', 'Net pay', rs(1_24_60_000), 'money'],
    ['employees', 'Employees paid', 412, 'count'],
  ],
);
R(
  G7,
  'payroll',
  'statutory-pf-esi',
  'PF, ESI, PT, TDS',
  'Statutory deductions and employer contributions for the month.',
  [
    ['head', 'Head', 'text'],
    ['employees', 'Employees', 'count'],
    ['employee', 'Employee share', 'money'],
    ['employer', 'Employer share', 'money'],
    ['due', 'Due by', 'date'],
    ['status', 'Status', 'status'],
  ],
  [
    ['Provident fund', 386, rs(9_42_000), rs(9_42_000), ymd(5), warn('Due')],
    ['ESI', 212, rs(48_600), rs(2_10_600), ymd(5), warn('Due')],
    ['Professional tax', 412, rs(82_400), 0, ymd(20), info('Upcoming')],
    ['TDS on salary', 96, rs(6_80_000), 0, ymd(-3), ok('Paid')],
  ],
  [['due', 'Due this month', rs(28_05_600), 'money']],
);
R(
  G7,
  'hr',
  'credential-expiry',
  'Credential expiry',
  'Registrations and licences expiring in 90 days.',
  [
    ['employee', 'Employee', 'text'],
    ['credential', 'Credential', 'text'],
    ['number', 'Number', 'id'],
    ['expires', 'Expires', 'date'],
    ['status', 'Status', 'status'],
  ],
  [
    ['Dr. Farah Khan', 'MMC registration', 'MMC-2011-04471', ymd(21), bad('Renew now')],
    ['Anjali Menon', 'Nursing council', 'MNC-88213', ymd(64), warn('Renewal due')],
    ['Lalit G.', 'BLS certificate', 'BLS-2024-118', ymd(80), info('Upcoming')],
  ],
  [
    ['expiring', 'Expiring in 90 days', 9, 'count'],
    ['expired', 'Expired', 0, 'count'],
  ],
);

// ---------------------------------------------------------------- Support and quality
const G8 = 'Support and quality';
R(
  G8,
  'mrd',
  'record-deficiencies',
  'Record deficiencies',
  'Discharged files with missing documents or signatures.',
  [
    ['ip', 'IP no.', 'id'],
    ['patient', 'Patient', 'text'],
    ['consultant', 'Consultant', 'text'],
    ['missing', 'Missing', 'text'],
    ['days', 'Days open', 'days'],
  ],
  [
    ['IP/26-27/000842', 'Vivek Joshi', 'Dr. Vikram Shah', 'Operation notes signature', 4],
    ['IP/26-27/000839', 'Kiran Deshmukh', 'Dr. Priya Nair', 'Consent form scan', 6],
    ['IP/26-27/000831', 'Sanjay Patil', 'Dr. Meera Iyer', 'Discharge summary', 9],
  ],
  [
    ['open', 'Open deficiencies', 17, 'count'],
    ['over7', 'Over 7 days', 4, 'count'],
  ],
);
R(
  G8,
  'mrd',
  'births-deaths',
  'Births and deaths',
  'Registrations reported to the municipal registrar.',
  [
    ['type', 'Type', 'text'],
    ['date', 'Date', 'date'],
    ['name', 'Name', 'text'],
    ['regNo', 'Registration no.', 'id'],
    ['status', 'Status', 'status'],
  ],
  [
    ['Birth', ymd(-1), 'Baby of Fatima Shaikh', 'PMC/B/2026/18412', ok('Reported')],
    ['Birth', ymd(-2), 'Baby of Kiran Deshmukh', 'PMC/B/2026/18377', ok('Reported')],
    ['Death', ymd(-3), 'Ramchandra Pawar', '-', warn('Due in 21 days')],
  ],
  [
    ['births', 'Births this month', 38, 'count'],
    ['deaths', 'Deaths this month', 6, 'count'],
  ],
);
R(
  G8,
  'diet',
  'meal-counts',
  'Meal counts and cost',
  'Meals served by diet type with food cost.',
  [
    ['diet', 'Diet', 'text'],
    ['breakfast', 'Breakfast', 'count'],
    ['lunch', 'Lunch', 'count'],
    ['dinner', 'Dinner', 'count'],
    ['cost', 'Food cost', 'money'],
  ],
  [
    ['Normal', 58, 61, 60, rs(10_740)],
    ['Diabetic', 22, 22, 21, rs(4_550)],
    ['Soft', 9, 10, 10, rs(1_740)],
    ['Liquid', 6, 6, 6, rs(720)],
    ['Renal', 4, 4, 4, rs(960)],
  ],
  [
    ['meals', 'Meals served', 318, 'count'],
    ['cost', 'Food cost', rs(18_710), 'money'],
  ],
);
R(
  G8,
  'facility',
  'housekeeping-tat',
  'Housekeeping TAT',
  'Bed turnaround after discharge, by ward.',
  [
    ['ward', 'Ward', 'text'],
    ['beds', 'Beds cleaned', 'count'],
    ['median', 'Median TAT', 'minutes'],
    ['over60', 'Over 60 min', 'count'],
  ],
  [
    ['General ward 1', 9, 42, 1],
    ['General ward 2', 7, 38, 0],
    ['Private rooms', 6, 55, 2],
    ['ICU', 2, 70, 1],
  ],
  [
    ['median', 'Median TAT', 45, 'minutes', 'target under 45'],
    ['beds', 'Beds turned', 24, 'count'],
  ],
);
R(
  G8,
  'facility',
  'equipment-downtime',
  'Equipment downtime',
  'Breakdowns and hours down for critical equipment.',
  [
    ['equipment', 'Equipment', 'text'],
    ['asset', 'Asset', 'id'],
    ['down', 'Down since', 'datetime'],
    ['hours', 'Hours down', 'count'],
    ['status', 'Status', 'status'],
  ],
  [
    ['CT scanner', 'BME-CT-01', at(2, '14:00'), 6, ok('Restored')],
    ['Ventilator ICU-04', 'BME-VNT-07', at(0, '06:30'), 4, warn('Engineer assigned')],
    ['Autoclave CSSD', 'BME-AC-02', at(1, '09:00'), 26, bad('Waiting for part')],
  ],
  [
    ['uptime', 'Critical uptime', 98.6, 'percent', 'target 98%'],
    ['open', 'Open breakdowns', 2, 'count'],
  ],
);
R(
  G8,
  'quality',
  'nabh-indicators',
  'NABH indicators',
  'Monthly quality indicators for NABH.',
  [
    ['indicator', 'Indicator', 'text'],
    ['value', 'Value', 'text'],
    ['target', 'Target', 'text'],
    ['status', 'Status', 'status'],
  ],
  [
    ['Time for initial assessment (OPD)', '14 min', 'Under 20 min', ok('On target')],
    ['Medication errors per 1,000 doses', '0.4', 'Under 1', ok('On target')],
    ['Return to ICU within 48 h', '2.1%', 'Under 3%', ok('On target')],
    ['Patient falls per 1,000 bed days', '0.9', 'Under 0.5', warn('Above target')],
    ['Bed turnaround', '45 min', 'Under 45 min', info('Watch')],
  ],
  [
    ['onTarget', 'On target', 18, 'count', 'of 22 indicators'],
    ['above', 'Above target', 4, 'count'],
  ],
);
R(
  G8,
  'crm',
  'campaign-response',
  'Campaign response',
  'Leads and visits from each campaign.',
  [
    ['campaign', 'Campaign', 'text'],
    ['channel', 'Channel', 'text'],
    ['sent', 'Sent', 'count'],
    ['leads', 'Leads', 'count'],
    ['visits', 'Visits', 'count'],
    ['revenue', 'Revenue', 'money'],
  ],
  [
    ['Heart check-up month', 'WhatsApp', 12_000, 418, 96, rs(2_88_000)],
    ['Diabetes camp, Baner', 'SMS', 8_000, 212, 61, rs(61_000)],
    ['Senior citizen OPD', 'E-mail', 3_500, 88, 30, rs(24_000)],
  ],
  [
    ['leads', 'Leads', 718, 'count'],
    ['visits', 'Visits', 187, 'count'],
    ['conversion', 'Conversion', 26, 'percent'],
  ],
);

const GROUPS = [...new Set(DEFS.map((d) => d.group))];
const groupCode = (name) =>
  name
    .toLowerCase()
    .replace(/[^a-z]+/g, '-')
    .replace(/-$/, '');
const byCode = new Map(DEFS.map((d) => [d.code, d]));

function runReport(def, query) {
  const filters = def.filters.filter((f) => query[f.key]);
  let rows = def.rows.map((r) =>
    Object.fromEntries(def.cols.map(([key], i) => [key, r[i] ?? null])),
  );
  // Narrow on the report's own filters where a column carries the value.
  for (const f of filters) {
    const col = def.cols.find(
      ([key]) => key === f.key || key === f.key.replace('department', 'department'),
    );
    if (col) rows = rows.filter((r) => String(r[col[0]]) === query[f.key]);
  }
  if (query.q) {
    const q = String(query.q).toLowerCase();
    rows = rows.filter((r) =>
      Object.values(r).some((v) =>
        String(v?.label ?? v ?? '')
          .toLowerCase()
          .includes(q),
      ),
    );
  }
  const paged = page(rows, query);
  return {
    code: def.code,
    name: def.name,
    group: def.group,
    description: def.description,
    period: { from: query.from || ymd(0), to: query.to || ymd(0) },
    branch: BRANCHES.find((b) => b.id === query.branchId)?.name ?? null,
    filters: def.filters.map((f) => ({
      key: f.key,
      label: f.label,
      options: f.options.map((o) => ({ value: o, label: o })),
    })),
    kpis: def.kpis.map(([key, label, value, kind, note]) => ({
      key,
      label,
      value,
      kind,
      note: note ?? null,
    })),
    columns: def.cols.map(([key, label, kind]) => ({ key, label, kind })),
    ...paged,
    generatedAt: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------- exports and schedules
const EXPORTS = [
  {
    id: 'ex-101',
    reportCode: 'revenue-by-department',
    reportName: 'Revenue by department and doctor',
    filtersLabel: 'September 2026 · Main Branch',
    format: 'XLSX',
    rows: 18_440,
    requestedAt: at(1, '10:02'),
    requestedBy: STAFF.ramesh.name,
    status: 'READY',
    readyAt: at(1, '10:04'),
    expiresAt: inMinutes(60 * 24 * 6),
  },
  {
    id: 'ex-100',
    reportCode: 'payroll-register',
    reportName: 'Payroll register',
    filtersLabel: 'September 2026',
    format: 'PDF',
    rows: 412,
    requestedAt: at(2, '16:20'),
    requestedBy: STAFF.kiran.name,
    status: 'READY',
    readyAt: at(2, '16:21'),
    expiresAt: inMinutes(60 * 24 * 5),
  },
  {
    id: 'ex-099',
    reportCode: 'gst-registers',
    reportName: 'GST registers',
    filtersLabel: 'August 2026',
    format: 'XLSX',
    rows: 6_410,
    requestedAt: at(9, '11:30'),
    requestedBy: STAFF.ramesh.name,
    status: 'EXPIRED',
    readyAt: at(9, '11:31'),
    expiresAt: at(2, '11:31'),
  },
];

const SCHEDULES = [
  {
    id: 'sc-1',
    reportCode: 'daily-collection',
    reportName: 'Daily collection by mode',
    frequency: 'DAILY',
    time: '21:00',
    recipients: ['Super Admin', 'Finance'],
    format: 'PDF',
    active: true,
    nextRunAt: at(0, '21:00'),
    lastRunAt: at(1, '21:00'),
  },
  {
    id: 'sc-2',
    reportCode: 'ipd-occupancy-alos',
    reportName: 'Bed occupancy and ALOS',
    frequency: 'DAILY',
    time: '08:00',
    recipients: ['Medical Superintendent'],
    format: 'PDF',
    active: true,
    nextRunAt: at(-1, '08:00'),
    lastRunAt: at(0, '08:00'),
  },
  {
    id: 'sc-3',
    reportCode: 'nabh-indicators',
    reportName: 'NABH indicators',
    frequency: 'MONTHLY',
    dayOfMonth: 1,
    time: '07:00',
    recipients: ['Quality Manager'],
    format: 'XLSX',
    active: true,
    nextRunAt: '2026-11-01T01:30:00.000Z',
    lastRunAt: '2026-10-01T01:30:00.000Z',
  },
];

function exportView(e) {
  const ready = e.status === 'RUNNING' && Date.now() >= new Date(e.readyAt).getTime();
  if (ready) e.status = 'READY';
  return { ...e };
}

function nextRun({ frequency, time, dayOfWeek, dayOfMonth }) {
  const [h, m] = time.split(':').map(Number);
  const now = new Date(Date.now() + 330 * 60_000);
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), h, m));
  if (frequency === 'MONTHLY') {
    d.setUTCDate(dayOfMonth ?? 1);
    if (d <= now) d.setUTCMonth(d.getUTCMonth() + 1);
  } else if (frequency === 'WEEKLY') {
    const want = dayOfWeek ?? 1;
    while (d.getUTCDay() !== want || d <= now) d.setUTCDate(d.getUTCDate() + 1);
  } else if (d <= now) d.setUTCDate(d.getUTCDate() + 1);
  return new Date(d.getTime() - 330 * 60_000).toISOString();
}

export const handlers = {
  'GET /reports': () => ({
    groups: GROUPS.map((g) => ({
      code: groupCode(g),
      name: g,
      reports: DEFS.filter((d) => d.group === g).map(({ code, name, permission, description }) => ({
        code,
        name,
        permission,
        description,
      })),
    })),
  }),
  'GET /reports/exports': ({ query }) => page(EXPORTS.map(exportView), query),
  'GET /reports/exports/:id/download': ({ params }) => {
    const e = EXPORTS.find((x) => x.id === params.id);
    if (!e) return notFound('Export');
    if (e.status !== 'READY')
      return {
        __status: 409,
        error: { code: 'INVALID_STATE', message: 'This export is not ready to download.' },
      };
    const def = byCode.get(e.reportCode);
    const csv = def
      ? [
          def.cols.map((c) => c[1]).join(','),
          ...def.rows.map((r) => r.map((v) => v?.label ?? v ?? '').join(',')),
        ].join('\n')
      : 'No data';
    return {
      url: `data:text/csv;charset=utf-8,${encodeURIComponent(csv)}`,
      filename: `${e.reportCode}.csv`,
    };
  },
  'POST /reports/:code/export': ({ params, body }) => {
    const def = byCode.get(params.code);
    if (!def) return notFound('Report');
    const f = body?.filters ?? {};
    const e = {
      id: newId('ex-'),
      reportCode: def.code,
      reportName: def.name,
      filtersLabel:
        [
          f.from && f.to ? (f.from === f.to ? f.from : `${f.from} to ${f.to}`) : null,
          BRANCHES.find((b) => b.id === f.branchId)?.name,
        ]
          .filter(Boolean)
          .join(' · ') || 'Today',
      format: body?.format === 'PDF' ? 'PDF' : 'XLSX',
      rows: def.rows.length * 37,
      requestedAt: new Date().toISOString(),
      requestedBy: 'You',
      status: 'RUNNING',
      readyAt: inMinutes(0.08),
      expiresAt: inMinutes(60 * 24 * 7),
    };
    EXPORTS.unshift(e);
    return e;
  },
  'GET /reports/schedules': ({ query }) => page(SCHEDULES, query),
  'POST /reports/schedules': ({ body }) => {
    const def = byCode.get(body?.reportCode);
    if (!def)
      return {
        __status: 422,
        error: {
          code: 'VALIDATION_FAILED',
          message: 'Pick a report',
          details: [{ path: 'reportCode', message: 'Pick a report' }],
        },
      };
    const s = { id: newId('sc-'), reportName: def.name, active: true, lastRunAt: null, ...body };
    s.nextRunAt = nextRun(s);
    SCHEDULES.unshift(s);
    return s;
  },
  'PUT /reports/schedules/:id': ({ params, body }) => {
    const s = SCHEDULES.find((x) => x.id === params.id);
    if (!s) return notFound('Schedule');
    Object.assign(s, { active: Boolean(body?.active) });
    return s;
  },
  'DELETE /reports/schedules/:id': ({ params }) => {
    const i = SCHEDULES.findIndex((x) => x.id === params.id);
    if (i < 0) return notFound('Schedule');
    SCHEDULES.splice(i, 1);
    return null;
  },
  'GET /reports/:code': ({ params, query }) => {
    const def = byCode.get(params.code);
    return def ? runReport(def, query) : notFound('Report');
  },
};
