import { hasPermission } from '@hms/shared';
import { AppError, errors } from '../errors/index.js';
import { current } from '../tenancy/context.js';
import { withTransaction } from '../db/model.js';
import { publish } from '../events/events.js';
import { recordAudit } from '../audit/audit.service.js';
import { ApprovalRequest } from './approval.model.js';

/**
 * Called by a module when an action needs approval. Returns the request; the API answers 202
 * APPROVAL_PENDING. Only one open request per record and action.
 */
export async function requestApproval({
  action,
  module,
  entity,
  entityId,
  title,
  payload,
  reason,
  checkerPermission,
  expiresAt,
}) {
  const c = current();
  return withTransaction(async () => {
    const open = await ApprovalRequest.exists({
      action,
      entity,
      entityId: String(entityId),
      status: 'PENDING',
    });
    if (open)
      throw new AppError(
        409,
        'APPROVAL_ALREADY_PENDING',
        'This change is already waiting for approval',
      );
    const [req] = await ApprovalRequest.create([
      {
        action,
        module,
        entity,
        entityId: String(entityId),
        title,
        payload,
        reason,
        checkerPermission,
        makerId: c.userId,
        makerName: c.userName,
        branchId: c.branchId ?? undefined,
        expiresAt,
      },
    ]);
    await publish('approval.requested', {
      approvalId: String(req._id),
      action,
      entity,
      entityId: String(entityId),
    });
    return req;
  });
}

/** Approve or reject. The maker can never check their own request (403 MAKER_CANNOT_CHECK). */
export async function decide(id, { decision, comment, version }) {
  const c = current();
  return withTransaction(async () => {
    const req = await ApprovalRequest.findById(id);
    if (!req) throw errors.notFound('Approval request');
    if (!hasPermission(c.permissions, req.checkerPermission))
      throw errors.forbidden(`You need the permission ${req.checkerPermission}`);
    if (String(req.makerId) === String(c.userId))
      throw new AppError(403, 'MAKER_CANNOT_CHECK', 'You cannot approve a request you raised');
    if (req.version !== version) throw errors.versionConflict();
    if (req.status !== 'PENDING')
      throw new AppError(
        409,
        'APPROVAL_CLOSED',
        `This request is already ${req.status.toLowerCase()}`,
      );
    if (req.expiresAt && req.expiresAt < new Date()) {
      req.status = 'EXPIRED';
      await req.save();
      throw new AppError(409, 'APPROVAL_CLOSED', 'This request has expired');
    }
    req.status = decision === 'APPROVE' ? 'APPROVED' : 'REJECTED';
    req.decidedBy = c.userId;
    req.decidedByName = c.userName;
    req.decidedAt = new Date();
    req.comment = comment;
    await req.save();
    await recordAudit({
      action: decision === 'APPROVE' ? 'APPROVE' : 'REJECT',
      entity: req.entity,
      entityId: req.entityId,
      summary: req.title,
      after: { approvalId: String(req._id), comment },
    });
    await publish('approval.decided', {
      approvalId: String(req._id),
      action: req.action,
      entity: req.entity,
      entityId: req.entityId,
      status: req.status,
      payload: req.payload,
    });
    return req;
  });
}

/** Maker withdraws their own pending request. */
export async function withdraw(id, { version }) {
  const c = current();
  const req = await ApprovalRequest.findById(id);
  if (!req) throw errors.notFound('Approval request');
  if (String(req.makerId) !== String(c.userId))
    throw errors.forbidden('Only the person who raised the request can withdraw it');
  if (req.version !== version) throw errors.versionConflict();
  if (req.status !== 'PENDING')
    throw new AppError(
      409,
      'APPROVAL_CLOSED',
      `This request is already ${req.status.toLowerCase()}`,
    );
  req.status = 'WITHDRAWN';
  await req.save();
  return req;
}
