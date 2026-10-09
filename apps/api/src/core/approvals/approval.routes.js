import { z } from 'zod';
import { hasPermission } from '@hms/shared';
import { objectId, pageQuery } from '@hms/shared/schemas';
import { defineRoutes } from '../http/route.js';
import { paginate } from '../http/paginate.js';
import { current } from '../tenancy/context.js';
import { errors } from '../errors/index.js';
import { ApprovalRequest } from './approval.model.js';
import { decide, withdraw } from './approval.service.js';

const toDto = (r) => ({
  id: String(r._id),
  action: r.action,
  module: r.module,
  entity: r.entity,
  entityId: r.entityId,
  title: r.title,
  payload: r.payload,
  reason: r.reason,
  status: r.status,
  makerName: r.makerName,
  makerId: String(r.makerId),
  decidedByName: r.decidedByName,
  decidedAt: r.decidedAt,
  comment: r.comment,
  createdAt: r.createdAt,
  version: r.version,
});

/** Requests the user can act on or follow: ones they may check, plus their own. */
function visibleFilter() {
  const c = current();
  const all = hasPermission(c.permissions, 'approvals:inbox:decide') || c.permissions.has('*');
  return all ? {} : { makerId: c.userId };
}

export const approvalRoutes = defineRoutes({
  module: 'CORE',
  basePath: '/approvals',
  routes: [
    {
      method: 'get',
      path: '/',
      permission: 'approvals:inbox:read',
      audit: null,
      summary: 'Approval inbox (pending first), filterable by status and module',
      schema: {
        query: pageQuery.extend({
          status: z.enum(['PENDING', 'APPROVED', 'REJECTED', 'WITHDRAWN', 'EXPIRED']).optional(),
          module: z.string().max(8).optional(),
        }),
      },
      handler: (req) => {
        const { status, module, ...page } = req.valid.query;
        const filter = {
          ...visibleFilter(),
          ...(status ? { status } : {}),
          ...(module ? { module } : {}),
        };
        return paginate(ApprovalRequest, filter, page, { map: toDto });
      },
    },
    {
      method: 'get',
      path: '/:id',
      permission: 'approvals:inbox:read',
      audit: null,
      summary: 'One approval request',
      schema: { params: z.object({ id: objectId }) },
      handler: async (req) => {
        const r = await ApprovalRequest.findOne({
          _id: req.valid.params.id,
          ...visibleFilter(),
        }).lean();
        if (!r) throw errors.notFound('Approval request');
        return toDto(r);
      },
    },
    {
      method: 'post',
      path: '/:id/decision',
      permission: 'approvals:inbox:decide',
      audit: 'APPROVE',
      summary: 'Approve or reject (a reason is required to reject)',
      schema: {
        params: z.object({ id: objectId }),
        body: z
          .object({
            decision: z.enum(['APPROVE', 'REJECT']),
            comment: z.string().trim().max(1000).optional(),
            version: z.number().int().min(0),
          })
          .refine((b) => b.decision === 'APPROVE' || (b.comment?.length ?? 0) >= 3, {
            path: ['comment'],
            message: 'Give a reason for rejecting',
          }),
      },
      handler: async (req) => toDto(await decide(req.valid.params.id, req.valid.body)),
    },
    {
      method: 'post',
      path: '/:id/withdraw',
      permission: 'approvals:inbox:read',
      audit: 'UPDATE',
      summary: 'Withdraw your own pending request',
      schema: {
        params: z.object({ id: objectId }),
        body: z.object({ version: z.number().int().min(0) }),
      },
      handler: async (req) => toDto(await withdraw(req.valid.params.id, req.valid.body)),
    },
  ],
});
