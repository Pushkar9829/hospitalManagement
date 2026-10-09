import { Schema } from 'mongoose';
import { APPROVAL_STATUS } from '@hms/shared';
import { defineModel } from '../db/model.js';

/**
 * Maker-checker request (spec "Maker-checker and approvals"). The owning module creates it,
 * a checker decides, and the module applies the change when it receives `approval.decided`.
 */
const schema = new Schema({
  action: { type: String, required: true, match: /^[a-z]+\.[a-zA-Z.]+$/ }, // e.g. billing.discount
  module: { type: String, required: true },
  entity: { type: String, required: true },
  entityId: { type: String, required: true },
  title: { type: String, required: true, maxlength: 200 },
  /** What will change if approved; shown to the checker. */
  payload: { type: Schema.Types.Mixed, default: {} },
  reason: { type: String, required: true, maxlength: 1000 },
  /** Checkers need this permission, e.g. approvals:billing-discount:decide. */
  checkerPermission: { type: String, required: true },
  makerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  makerName: String,
  branchId: { type: Schema.Types.ObjectId },
  status: { type: String, enum: Object.keys(APPROVAL_STATUS), default: 'PENDING' },
  decidedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  decidedByName: String,
  decidedAt: Date,
  comment: { type: String, maxlength: 1000 },
  expiresAt: Date,
});
schema.index({ tenantId: 1, status: 1, createdAt: -1 });
schema.index({ tenantId: 1, entity: 1, entityId: 1, status: 1 });
schema.index({ tenantId: 1, makerId: 1, createdAt: -1 });

export const ApprovalRequest = defineModel('ApprovalRequest', schema);
