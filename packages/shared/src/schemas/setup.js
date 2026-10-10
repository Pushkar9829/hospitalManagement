import { z } from 'zod';
import { isGstin, isPan, isPinCode } from '../ids.js';
import { objectId } from './common.js';

const code = (max = 12) =>
  z
    .string()
    .trim()
    .toUpperCase()
    .regex(
      new RegExp(`^[A-Z0-9][A-Z0-9_-]{0,${max - 1}}$`),
      `Use up to ${max} letters, digits, - or _`,
    );
const name = z.string().trim().min(2, 'Enter a name').max(120);
const optionalText = (max = 200) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .or(z.literal('').transform(() => undefined));

export const address = z.object({
  line1: optionalText(),
  line2: optionalText(),
  city: optionalText(80),
  state: optionalText(80),
  pin: z
    .string()
    .trim()
    .refine((v) => !v || isPinCode(v), 'Enter a 6-digit PIN code')
    .optional(),
});

export const gstin = z
  .string()
  .trim()
  .toUpperCase()
  .refine(isGstin, 'Enter a valid GSTIN')
  .optional()
  .or(z.literal('').transform(() => undefined));
export const pan = z
  .string()
  .trim()
  .toUpperCase()
  .refine(isPan, 'Enter a valid PAN')
  .optional()
  .or(z.literal('').transform(() => undefined));

// ---------------------------------------------------------------- hospital, entities, branches

export const legalEntityInput = z.object({
  name,
  registrationNo: optionalText(60),
  gstin,
  pan,
  address: address.optional(),
  signatory: optionalText(120),
  logoFileId: objectId.optional(),
  letterheadFileId: objectId.optional(),
});

export const branchInput = z.object({
  name,
  code: code(8),
  entityId: objectId.optional(),
  address: address.optional(),
  gstin,
  phone: optionalText(20),
  email: z
    .email()
    .optional()
    .or(z.literal('').transform(() => undefined)),
});

/** Hospital-editable settings (spec 5.1). */
export const hospitalSettingsInput = z.object({
  displayName: name,
  financialYearStartMonth: z.number().int().min(1).max(12),
  timezone: z.literal('Asia/Kolkata'),
  dateFormat: z.enum(['DD/MM/YYYY', 'DD-MMM-YYYY']),
  languages: z.array(z.enum(['en', 'hi', 'mr', 'ta', 'te', 'kn', 'bn', 'gu', 'ml'])).min(1),
  idleTimeoutMin: z.number().int().min(5).max(60),
  communication: z
    .object({
      smsSenderId: optionalText(6),
      emailFrom: optionalText(120),
      whatsappNumber: optionalText(15),
    })
    .optional(),
});

// ---------------------------------------------------------------- numbering

export const NUMBER_SERIES = Object.freeze({
  UHID: { label: 'Patient UHID', prefix: 'CC', reset: 'NEVER', perBranch: false, width: 7 },
  OPD_VISIT: { label: 'OPD visit', prefix: 'OV', reset: 'YEARLY', perBranch: true, width: 6 },
  IP: { label: 'In-patient admission', prefix: 'IP', reset: 'YEARLY', perBranch: true, width: 6 },
  OP_BILL: { label: 'OPD bill', prefix: 'OP', reset: 'YEARLY', perBranch: true, width: 6 },
  IP_BILL: { label: 'IPD bill', prefix: 'IPB', reset: 'YEARLY', perBranch: true, width: 6 },
  RECEIPT: { label: 'Receipt', prefix: 'RC', reset: 'YEARLY', perBranch: true, width: 6 },
  REFUND: { label: 'Refund', prefix: 'RF', reset: 'YEARLY', perBranch: true, width: 6 },
  DEPOSIT: { label: 'Deposit', prefix: 'DP', reset: 'YEARLY', perBranch: true, width: 6 },
  PO: { label: 'Purchase order', prefix: 'PO', reset: 'YEARLY', perBranch: true, width: 6 },
  GRN: { label: 'Goods receipt', prefix: 'GRN', reset: 'YEARLY', perBranch: true, width: 6 },
  EMPLOYEE: { label: 'Employee ID', prefix: 'EMP', reset: 'NEVER', perBranch: false, width: 5 },
});

export const numberSeriesInput = z.object({
  prefix: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{1,5}$/, 'Use 1 to 5 capital letters'),
  reset: z.enum(['YEARLY', 'MONTHLY', 'NEVER']),
  width: z.number().int().min(3).max(9),
});

// ---------------------------------------------------------------- departments

export const DEPARTMENT_TYPES = Object.freeze({
  CLINICAL: 'Clinical',
  DIAGNOSTIC: 'Diagnostic',
  SUPPORT: 'Support',
  ADMINISTRATIVE: 'Administrative',
});

export const DEPARTMENT_STATUS = Object.freeze({
  DRAFT: { label: 'Draft', tone: 'neutral' },
  PENDING_APPROVAL: { label: 'Pending approval', tone: 'warning' },
  ACTIVE: { label: 'Active', tone: 'success' },
  CLOSING: { label: 'Closing (approval)', tone: 'warning' },
  INACTIVE: { label: 'Inactive', tone: 'neutral' },
});

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use HH:MM');

export const departmentInput = z.object({
  code: code(8),
  name,
  type: z.enum(Object.keys(DEPARTMENT_TYPES)),
  parentId: objectId.optional(),
  hodUserId: objectId.optional(),
  location: z.object({
    branchId: objectId,
    building: optionalText(60),
    floor: optionalText(20),
    rooms: optionalText(60),
  }),
  services: z.object({
    opd: z.boolean(),
    ipd: z.boolean(),
    procedures: z.boolean(),
    diagnostics: z.boolean(),
  }),
  costCentre: optionalText(30),
  opdTimings: z
    .array(
      z
        .object({ day: z.number().int().min(0).max(6), from: time, to: time })
        .refine((t) => t.from < t.to, { path: ['to'], message: 'End after start' }),
    )
    .max(21)
    .default([]),
});

// ---------------------------------------------------------------- masters

const rupees = z.coerce.number().min(0).max(1_00_00_000);

/** Every master type: label, input schema and Excel import columns (header -> field). */
export const MASTERS = Object.freeze({
  'price-lists': {
    label: 'Price lists',
    input: z.object({
      code: code(),
      name,
      kind: z.enum(['GENERAL', 'STAFF', 'SENIOR', 'CORPORATE']),
      isDefault: z.boolean().default(false),
    }),
    columns: { Code: 'code', Name: 'name', Kind: 'kind', Default: 'isDefault' },
  },
  'tax-codes': {
    label: 'Tax codes',
    input: z
      .object({
        code: code(),
        name,
        kind: z.enum(['GST', 'EXEMPT']),
        // GST slabs after the September 2025 rationalisation (0.25% and 3% are special rates).
        rate: z.coerce
          .number()
          .refine((r) => [0, 0.25, 3, 5, 18, 40].includes(r), 'Not a current GST rate'),
        hsnSac: z
          .string()
          .trim()
          .regex(/^\d{4,8}$/, 'HSN/SAC has 4 to 8 digits')
          .optional(),
      })
      .refine((t) => t.kind !== 'EXEMPT' || t.rate === 0, {
        path: ['rate'],
        message: 'Exempt codes have rate 0',
      }),
    columns: { Code: 'code', Name: 'name', Kind: 'kind', 'Rate %': 'rate', 'HSN/SAC': 'hsnSac' },
  },
  'payment-modes': {
    label: 'Payment modes',
    input: z.object({
      code: code(),
      name,
      kind: z.enum([
        'CASH',
        'CARD',
        'UPI',
        'CHEQUE',
        'BANK_TRANSFER',
        'WALLET',
        'ADVANCE',
        'PAYMENT_LINK',
      ]),
      requiresReference: z.boolean().default(false),
    }),
    columns: { Code: 'code', Name: 'name', Kind: 'kind', 'Needs reference': 'requiresReference' },
  },
  'referral-sources': {
    label: 'Referral sources',
    input: z.object({
      code: code(),
      name,
      kind: z.enum(['DOCTOR', 'CAMP', 'WEBSITE', 'WALK_IN', 'CORPORATE', 'OTHER']),
      phone: optionalText(15),
    }),
    columns: { Code: 'code', Name: 'name', Kind: 'kind', Phone: 'phone' },
  },
  units: {
    label: 'Units of measure',
    input: z.object({
      code: code(),
      name,
      baseUnit: code().optional(),
      factor: z.coerce.number().positive().default(1),
    }),
    columns: { Code: 'code', Name: 'name', 'Base unit': 'baseUnit', Factor: 'factor' },
  },
  designations: {
    label: 'Designations',
    input: z.object({ code: code(), name, grade: optionalText(20) }),
    columns: { Code: 'code', Name: 'name', Grade: 'grade' },
  },
  holidays: {
    label: 'Public holidays',
    input: z.object({
      code: code(16),
      name,
      date: z.coerce.date(),
      branchCodes: z.array(code(8)).default([]),
    }),
    columns: { Code: 'code', Name: 'name', Date: 'date', Branches: 'branchCodes' },
  },
  services: {
    label: 'Services and tariffs',
    input: z.object({
      code: code(16),
      name,
      category: z.enum([
        'CONSULTATION',
        'PROCEDURE',
        'BED',
        'LAB',
        'RAD',
        'PACKAGE',
        'NURSING',
        'OTHER',
      ]),
      departmentCode: code(8).optional(),
      taxCode: code(),
      revenueHead: optionalText(40),
      /** Price list code -> amount in rupees (stored in paise). */
      rates: z
        .record(code(), rupees)
        .refine((r) => Object.keys(r).length > 0, 'Give at least one rate'),
    }),
    columns: {
      Code: 'code',
      Name: 'name',
      Category: 'category',
      Department: 'departmentCode',
      'Tax code': 'taxCode',
      'Revenue head': 'revenueHead',
      'Rate *': 'rates',
    },
  },
});

export const MASTER_TYPES = Object.freeze(Object.keys(MASTERS));
