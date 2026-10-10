import { zodResolver } from '@hookform/resolvers/zod';
import {
  ageLabel,
  ageParts,
  estimatedDob,
  isMinor,
  isMobile,
  isSeniorCitizen,
  maskAadhaar,
} from '@hms/shared';
import { apiError } from '../../app/apiError.js';
import { withoutEmpty } from '../../lib/forms.js';

/*
 * The registration form keeps strings (what inputs hold) and a birth mode; the API takes the
 * shared zod shape (patientCreateInput / patientUpdateInput). toPayload() converts one way,
 * fromPatient() the other, and patientResolver() validates the converted payload with the
 * shared schema plus the two rules the API checks beyond fields (guardian under 18 on a full
 * registration, senior category at 60+), so the desk sees them before saving.
 */

const blank = (v) => v === undefined || v === null || String(v).trim() === '';
const allBlank = (obj) => !obj || Object.values(obj).every((v) => blank(v));

/** Empty form values; `prefill` takes { first, last, mobile } from a search. */
export function emptyForm({ registrationType = 'FULL', prefill = {} } = {}) {
  return {
    registrationType,
    name: {
      title: '',
      first: prefill.first ?? '',
      middle: '',
      last: prefill.last ?? '',
      regional: '',
    },
    gender: '',
    birthMode: 'age',
    dob: '',
    age: { years: '', months: '', days: '' },
    mobile: prefill.mobile ?? '',
    altMobile: '',
    email: '',
    preferredLanguage: 'en',
    bloodGroup: '',
    maritalStatus: '',
    address: { line1: '', line2: '', city: '', district: '', state: '', pin: '' },
    relation: { type: '', name: '' },
    guardian: { name: '', relation: '', mobile: '' },
    emergencyContact: { name: '', relation: '', mobile: '' },
    ids: [],
    abhaNumber: '',
    abhaAddress: '',
    allergies: [],
    noKnownAllergies: false,
    chronicConditions: '',
    flags: { vip: false, mlc: false },
    category: 'GENERAL',
    referralDoctor: '',
    photoFileId: '',
  };
}

/** "9876543210" -> mobile; "Ravi Kumar" -> first/last name, for "Register" from a search. */
export function prefillFromSearch(q) {
  const term = String(q ?? '').trim();
  if (!term) return {};
  const digits = term.replace(/\D/g, '');
  if (isMobile(term)) return { mobile: digits.slice(-10) };
  if (/\d/.test(term)) return {};
  const [first, ...rest] = term.split(/\s+/);
  return { first, last: rest.join(' ') };
}

const num = (v) => (blank(v) ? 0 : Number(v));

/** The date of birth the form describes (estimated from the age when the age was given). */
export function formDob(values, now = new Date()) {
  if (values.birthMode === 'dob') {
    if (!values.dob) return null;
    const d = new Date(`${values.dob}T00:00:00Z`);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const age = {
    years: num(values.age?.years),
    months: num(values.age?.months),
    days: num(values.age?.days),
  };
  if (![age.years, age.months, age.days].every(Number.isFinite)) return null;
  if (age.years + age.months + age.days <= 0) return null;
  return estimatedDob(age, now);
}

/** Age label, minor and senior-citizen flags for a date of birth (or nulls). */
export function ageFacts(dob, now = new Date()) {
  if (!dob) return { label: '', minor: false, senior: false };
  return { label: ageLabel(dob, now), minor: isMinor(dob, now), senior: isSeniorCitizen(dob, now) };
}

/** Form values -> API body. `mode` is 'create' or 'edit'. */
export function toPayload(values, mode = 'create') {
  const birth =
    values.birthMode === 'dob'
      ? { dob: values.dob || undefined }
      : {
          age: {
            years: num(values.age?.years),
            months: num(values.age?.months),
            days: num(values.age?.days),
          },
        };
  const body = {
    ...(mode === 'create'
      ? { registrationType: values.registrationType, confirmNotDuplicate: false }
      : { version: values.version }),
    name: values.name,
    gender: values.gender,
    birth,
    mobile: values.mobile,
    altMobile: values.altMobile,
    email: values.email,
    preferredLanguage: values.preferredLanguage,
    bloodGroup: values.bloodGroup,
    maritalStatus: values.maritalStatus,
    address: allBlank(values.address) ? undefined : values.address,
    relation:
      blank(values.relation?.type) && blank(values.relation?.name) ? undefined : values.relation,
    guardian: allBlank(values.guardian) ? undefined : values.guardian,
    emergencyContact: allBlank(values.emergencyContact) ? undefined : values.emergencyContact,
    ids: (values.ids ?? [])
      .filter((d) => !blank(d.number) || d.fileId)
      .map((d) => ({
        type: d.type,
        number: String(d.number ?? '').trim(),
        fileId: d.fileId || undefined,
      })),
    abhaNumber: values.abhaNumber,
    abhaAddress: values.abhaAddress,
    allergies: (values.allergies ?? []).filter((a) => !allBlank({ s: a.substance, r: a.reaction })),
    noKnownAllergies: Boolean(values.noKnownAllergies),
    chronicConditions: String(values.chronicConditions ?? '')
      .split(',')
      .map((c) => c.trim())
      .filter(Boolean),
    flags: { vip: Boolean(values.flags?.vip), mlc: Boolean(values.flags?.mlc) },
    category: values.category || 'GENERAL',
    referral: blank(values.referralDoctor) ? undefined : { doctorName: values.referralDoctor },
    photoFileId: values.photoFileId,
  };
  return withoutEmpty(body);
}

/** A patient from the API -> form values for editing (Aadhaar stays masked, as the API sends it). */
export function fromPatient(p, now = new Date()) {
  const base = emptyForm({ registrationType: p.registrationType ?? 'FULL' });
  const parts = p.dob ? ageParts(p.dob, now) : null;
  return {
    ...base,
    version: p.version,
    name: {
      ...base.name,
      ...pickStrings(p.name, ['title', 'first', 'middle', 'last', 'regional']),
    },
    gender: p.gender ?? '',
    birthMode: p.dobEstimated ? 'age' : 'dob',
    dob: p.dob && !p.dobEstimated ? String(p.dob).slice(0, 10) : '',
    age:
      p.dobEstimated && parts
        ? { years: String(parts.years), months: String(parts.months), days: String(parts.days) }
        : base.age,
    mobile: p.mobile ?? '',
    altMobile: p.altMobile ?? '',
    email: p.email ?? '',
    preferredLanguage: p.preferredLanguage ?? 'en',
    bloodGroup: p.bloodGroup ?? '',
    maritalStatus: p.maritalStatus ?? '',
    address: { ...base.address, ...pickStrings(p.address, Object.keys(base.address)) },
    relation: { ...base.relation, ...pickStrings(p.relation, ['type', 'name']) },
    guardian: { ...base.guardian, ...pickStrings(p.guardian, ['name', 'relation', 'mobile']) },
    emergencyContact: {
      ...base.emergencyContact,
      ...pickStrings(p.emergencyContact, ['name', 'relation', 'mobile']),
    },
    ids: (p.ids ?? []).map((d) => ({
      type: d.type,
      number: d.number ?? '',
      fileId: d.fileId ?? '',
    })),
    abhaNumber: p.abha?.number ?? '',
    abhaAddress: p.abha?.address ?? '',
    allergies: (p.allergies ?? []).map((a) => ({
      substance: a.substance,
      reaction: a.reaction ?? '',
      severity: a.severity,
    })),
    noKnownAllergies: Boolean(p.noKnownAllergies),
    chronicConditions: (p.chronicConditions ?? []).join(', '),
    flags: { vip: Boolean(p.flags?.vip), mlc: Boolean(p.flags?.mlc) },
    category: p.category ?? 'GENERAL',
    referralDoctor: p.referral?.doctorName ?? '',
    photoFileId: p.photoFileId ?? '',
  };
}

function pickStrings(obj, keys) {
  const out = {};
  for (const k of keys) if (obj?.[k] != null) out[k] = String(obj[k]);
  return out;
}

/** Where a payload error path shows in the form (birth.* sits under the age/date field). */
export function formPath(path) {
  const p = String(path ?? '');
  if (p.startsWith('birth')) return 'birth';
  if (p === 'referral' || p.startsWith('referral.')) return 'referralDoctor';
  return p;
}

/**
 * react-hook-form resolver: converts the form to the API body and validates it with the shared
 * schema, then the guardian (full registration under 18) and senior-category rules.
 */
export function patientResolver(schema, mode) {
  const resolve = zodResolver(schema);
  return async (values, context, options) => {
    const result = await resolve(toPayload(values, mode), context, options);
    const errors = { ...result.errors };
    if (result.errors.birth) {
      errors.birth = {
        type: 'validate',
        message:
          result.errors.birth.dob?.message ??
          result.errors.birth.age?.years?.message ??
          result.errors.birth.age?.months?.message ??
          result.errors.birth.age?.days?.message ??
          result.errors.birth.message,
      };
    }
    if (result.errors.referral) {
      errors.referralDoctor = result.errors.referral.doctorName ?? result.errors.referral;
      delete errors.referral;
    }
    const dob = formDob(values);
    const facts = ageFacts(dob);
    const full = values.registrationType === 'FULL';
    if (full && facts.minor && allBlank(values.guardian)) {
      errors.guardian = {
        name: { type: 'validate', message: 'Add a parent or guardian for a patient under 18' },
      };
    }
    if (values.category === 'SENIOR' && dob && !facts.senior) {
      errors.category = {
        type: 'validate',
        message: 'Senior citizen category needs age 60 or more',
      };
    }
    if (Object.keys(errors).length) return { values: {}, errors };
    return result;
  };
}

/** Aadhaar as typed (12 digits) shown masked once the field is left: XXXX XXXX 1234. */
export function aadhaarDisplay(value, focused) {
  const v = String(value ?? '');
  if (focused) return v;
  return maskAadhaar(v) || v;
}

/** Search query check: UHID, 4+ digits of a mobile, or 2+ letters of a name. */
export function searchHint(q) {
  const term = String(q ?? '').trim();
  if (!term) return 'empty';
  if (/^[\d\s+-]+$/.test(term) && term.replace(/\D/g, '').length < 4) return 'digits';
  if (term.length < 2) return 'short';
  return null;
}

/** Shows 422 field details under their form fields; returns what no field could show. */
export function showFieldErrors(err, setError) {
  const e = apiError(err);
  if (!e || e.code !== 'VALIDATION_FAILED' || !e.details.length) return e;
  const rest = [];
  e.details.forEach((d, i) => {
    if (!d.path) return rest.push(d);
    setError(formPath(d.path), { type: 'server', message: d.message }, { shouldFocus: i === 0 });
  });
  return rest.length ? { ...e, details: rest } : null;
}

/** The candidate list from a POSSIBLE_DUPLICATE error's details. */
export function duplicateMatches(error) {
  const details = error?.data?.error?.details ?? error?.details ?? [];
  return details.filter((d) => d && (d.uhid || d.id));
}
