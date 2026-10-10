import { Schema } from 'mongoose';
import { defineModel } from '../../../core/db/model.js';

/** Common shape: unique code per hospital, name, active flag. */
function master(name, fields, extraIndexes = []) {
  const schema = new Schema({
    code: { type: String, required: true, uppercase: true, trim: true },
    name: { type: String, required: true, trim: true },
    isActive: { type: Boolean, default: true },
    ...fields,
  });
  schema.index({ tenantId: 1, code: 1 }, { unique: true });
  schema.index({ tenantId: 1, isActive: 1, name: 1 });
  for (const idx of extraIndexes) schema.index(idx);
  return defineModel(name, schema);
}

export const PriceList = master('PriceList', {
  kind: { type: String, required: true },
  isDefault: { type: Boolean, default: false },
});

export const TaxCode = master('TaxCode', {
  kind: { type: String, required: true },
  rate: { type: Number, required: true },
  hsnSac: String,
});

export const PaymentMode = master('PaymentMode', {
  kind: { type: String, required: true },
  requiresReference: { type: Boolean, default: false },
});

export const ReferralSource = master('ReferralSource', {
  kind: { type: String, required: true },
  phone: String,
});

export const Unit = master('Unit', { baseUnit: String, factor: { type: Number, default: 1 } });

export const Designation = master('Designation', { grade: String });

export const Holiday = master(
  'Holiday',
  {
    date: { type: Date, required: true },
    branchIds: [{ type: Schema.Types.ObjectId, ref: 'Branch' }],
  },
  [{ tenantId: 1, date: 1 }],
);

/**
 * Every chargeable item (spec 5.3). Rates are per price list in paise. A rate change, and a new
 * service, wait for Super Admin approval (billing.tariffChange) before they are used in bills.
 */
export const Service = master(
  'Service',
  {
    category: { type: String, required: true },
    departmentId: { type: Schema.Types.ObjectId, ref: 'Department' },
    taxCodeId: { type: Schema.Types.ObjectId, ref: 'TaxCode', required: true },
    revenueHead: String,
    rates: [
      {
        _id: false,
        priceListId: { type: Schema.Types.ObjectId, ref: 'PriceList' },
        amount: { type: Number, min: 0 },
      },
    ],
    /** Proposed rates waiting for approval; `rates` stay in use until it is approved. */
    pendingRates: {
      type: [
        {
          _id: false,
          priceListId: { type: Schema.Types.ObjectId, ref: 'PriceList' },
          amount: { type: Number, min: 0 },
        },
      ],
      default: undefined,
    },
    status: {
      type: String,
      enum: ['PENDING_APPROVAL', 'ACTIVE', 'REJECTED', 'INACTIVE'],
      default: 'PENDING_APPROVAL',
    },
    approvalId: { type: Schema.Types.ObjectId, ref: 'ApprovalRequest' },
  },
  [{ tenantId: 1, category: 1, status: 1 }],
);
