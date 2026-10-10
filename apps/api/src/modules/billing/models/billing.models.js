import { Schema } from 'mongoose';
import { defineModel } from '../../../core/db/model.js';

const money = { type: Number, default: 0 }; // paise, integers only

const patientSnapshot = {
  _id: false,
  id: { type: Schema.Types.ObjectId, ref: 'Patient', required: true },
  uhid: String,
  name: String,
  age: String,
  gender: String,
  mobile: String,
};

/**
 * A bill line keeps the price, tax and names as they were when charged (spec: "charges keep the
 * price on the date of service"), so old bills print correctly after tariff changes.
 */
const lineSchema = new Schema({
  serviceId: { type: Schema.Types.ObjectId, ref: 'Service', required: true },
  code: String,
  name: String,
  category: String,
  departmentId: { type: Schema.Types.ObjectId, ref: 'Department' },
  qty: { type: Number, min: 1, required: true },
  unitPrice: money,
  gross: money,
  discount: money,
  taxable: money,
  taxRate: { type: Number, default: 0 },
  hsnSac: String,
  cgst: money,
  sgst: money,
  net: money,
  /** Where the charge came from (rule R3): counter today; orders, census and pharmacy later. */
  source: { type: { type: String, default: 'COUNTER' }, ref: String },
  addedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  addedAt: Date,
});

const billSchema = new Schema({
  billNo: String,
  type: { type: String, enum: ['OP', 'MISC'], required: true },
  patient: patientSnapshot,
  branchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true },
  payer: {
    kind: { type: String, default: 'CASH' },
    priceListId: { type: Schema.Types.ObjectId, ref: 'PriceList' },
    priceListCode: String,
  },
  doctorUserId: { type: Schema.Types.ObjectId, ref: 'User' },
  lines: [lineSchema],
  totals: {
    gross: money,
    discount: money,
    taxable: money,
    cgst: money,
    sgst: money,
    tax: money,
    net: money,
    roundOff: money,
    total: money,
    paid: money,
    refunded: money,
    balance: money,
  },
  discount: {
    kind: String,
    value: Number,
    amount: money,
    reason: String,
    status: { type: String, enum: ['PENDING', 'APPLIED', 'REJECTED'] },
    approvalId: { type: Schema.Types.ObjectId, ref: 'ApprovalRequest' },
  },
  status: {
    type: String,
    enum: ['DRAFT', 'FINAL', 'PARTLY_PAID', 'PAID', 'CANCELLED'],
    default: 'DRAFT',
  },
  /** Held while a discount or cancellation waits for approval: no payments meanwhile. */
  hold: { type: String, enum: ['DISCOUNT', 'CANCELLATION'] },
  cancellation: {
    reason: String,
    approvalId: { type: Schema.Types.ObjectId, ref: 'ApprovalRequest' },
    creditNoteNo: String,
    at: Date,
  },
  finalizedAt: Date,
  finalizedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  shiftId: { type: Schema.Types.ObjectId, ref: 'CashierShift' },
  printCount: { type: Number, default: 0 },
  notes: String,
});
billSchema.index(
  { tenantId: 1, billNo: 1 },
  { unique: true, partialFilterExpression: { billNo: { $type: 'string' } } },
);
billSchema.index({ tenantId: 1, 'patient.id': 1, createdAt: -1 });
billSchema.index({ tenantId: 1, branchId: 1, status: 1, createdAt: -1 });
export const Bill = defineModel('Bill', billSchema);

/** One receipt; it may be split across several bills of the same family. */
const paymentSchema = new Schema({
  receiptNo: { type: String, required: true },
  patientId: { type: Schema.Types.ObjectId, ref: 'Patient', required: true },
  patient: patientSnapshot,
  branchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true },
  mode: { type: String, required: true },
  modeKind: { type: String, required: true },
  amount: { type: Number, required: true, min: 1 },
  reference: String,
  allocations: [
    {
      _id: false,
      billId: { type: Schema.Types.ObjectId, ref: 'Bill' },
      billNo: String,
      amount: Number,
    },
  ],
  depositId: { type: Schema.Types.ObjectId, ref: 'Deposit' },
  status: {
    type: String,
    enum: ['CAPTURED', 'PENDING', 'FAILED', 'REVERSED'],
    default: 'CAPTURED',
  },
  shiftId: { type: Schema.Types.ObjectId, ref: 'CashierShift' },
  collectedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  istDate: { type: String, required: true },
  printCount: { type: Number, default: 0 },
});
paymentSchema.index({ tenantId: 1, receiptNo: 1 }, { unique: true });
paymentSchema.index({ tenantId: 1, patientId: 1, istDate: 1, modeKind: 1 });
paymentSchema.index({ tenantId: 1, shiftId: 1, status: 1 });
export const Payment = defineModel('Payment', paymentSchema);

const depositSchema = new Schema({
  depositNo: { type: String, required: true },
  patientId: { type: Schema.Types.ObjectId, ref: 'Patient', required: true },
  patient: patientSnapshot,
  branchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true },
  mode: String,
  modeKind: String,
  reference: String,
  purpose: String,
  amount: { type: Number, required: true, min: 1 },
  used: money,
  refunded: money,
  status: { type: String, enum: ['OPEN', 'CLOSED'], default: 'OPEN' },
  shiftId: { type: Schema.Types.ObjectId, ref: 'CashierShift' },
  istDate: String,
});
depositSchema.index({ tenantId: 1, depositNo: 1 }, { unique: true });
depositSchema.index({ tenantId: 1, patientId: 1, status: 1 });
export const Deposit = defineModel('Deposit', depositSchema);

/** Money going back; always to the original payment mode (rule R6). */
const refundSchema = new Schema({
  refundNo: String,
  patientId: { type: Schema.Types.ObjectId, ref: 'Patient', required: true },
  billId: { type: Schema.Types.ObjectId, ref: 'Bill' },
  depositId: { type: Schema.Types.ObjectId, ref: 'Deposit' },
  branchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true },
  amount: { type: Number, required: true, min: 1 },
  /** Original modes and how much goes back through each. */
  modes: [{ _id: false, mode: String, modeKind: String, amount: Number, reference: String }],
  reason: String,
  status: { type: String, enum: ['APPROVED', 'PAID'], default: 'APPROVED' },
  paidAt: Date,
  paidBy: { type: Schema.Types.ObjectId, ref: 'User' },
  shiftId: { type: Schema.Types.ObjectId, ref: 'CashierShift' },
  reference: String,
});
refundSchema.index(
  { tenantId: 1, refundNo: 1 },
  { unique: true, partialFilterExpression: { refundNo: { $type: 'string' } } },
);
refundSchema.index({ tenantId: 1, status: 1, branchId: 1 });
export const Refund = defineModel('Refund', refundSchema);

const creditNoteSchema = new Schema({
  creditNoteNo: { type: String, required: true },
  billId: { type: Schema.Types.ObjectId, ref: 'Bill', required: true },
  billNo: String,
  patient: patientSnapshot,
  amount: { type: Number, required: true },
  tax: money,
  reason: String,
  approvalId: { type: Schema.Types.ObjectId, ref: 'ApprovalRequest' },
});
creditNoteSchema.index({ tenantId: 1, creditNoteNo: 1 }, { unique: true });
export const CreditNote = defineModel('CreditNote', creditNoteSchema);

/** One cashier, one counter, one drawer (rules R10, R11; edge case: two cashiers on one counter). */
const shiftSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  userName: String,
  branchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true },
  counter: { type: String, required: true },
  openedAt: { type: Date, required: true },
  openingCash: money,
  status: { type: String, enum: ['OPEN', 'COUNTED', 'VERIFIED'], default: 'OPEN' },
  closedAt: Date,
  expected: { type: Schema.Types.Mixed },
  counted: { notes: Schema.Types.Mixed, cash: Number, nonCash: Schema.Types.Mixed },
  cashVariance: Number,
  varianceReason: String,
  verifiedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  verifiedAt: Date,
  verifyComment: String,
});
shiftSchema.index({ tenantId: 1, userId: 1, status: 1 });
shiftSchema.index({ tenantId: 1, branchId: 1, counter: 1, status: 1 });
// At most one open shift per cashier and per counter.
shiftSchema.index(
  { tenantId: 1, userId: 1 },
  { unique: true, partialFilterExpression: { status: 'OPEN' } },
);
shiftSchema.index(
  { tenantId: 1, branchId: 1, counter: 1 },
  { unique: true, partialFilterExpression: { status: 'OPEN' } },
);
export const CashierShift = defineModel('CashierShift', shiftSchema);

/**
 * One row per patient per IST day, bumped inside every cash receipt's transaction. Concurrent
 * cash receipts for the same person then conflict and retry, so the section 269ST check
 * always sees the other receipt (it cannot be bypassed by two counters at once).
 */
const cashLockSchema = new Schema({
  patientId: { type: Schema.Types.ObjectId, required: true },
  istDate: { type: String, required: true },
  n: { type: Number, default: 0 },
});
cashLockSchema.index({ tenantId: 1, patientId: 1, istDate: 1 }, { unique: true });
export const CashLock = defineModel('CashLock', cashLockSchema, { audit: false, base: false });
