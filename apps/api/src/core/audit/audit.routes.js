import { z } from 'zod';
import { pageQuery } from '@hms/shared/schemas';
import { defineRoutes } from '../http/route.js';
import { paginate } from '../http/paginate.js';
import { AuditLog, AUDIT_ACTIONS } from './audit.model.js';

const query = pageQuery.extend({
  entity: z.string().max(60).optional(),
  entityId: z.string().max(60).optional(),
  userId: z
    .string()
    .regex(/^[a-f\d]{24}$/i)
    .optional(),
  action: z.enum(AUDIT_ACTIONS).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

export const auditRoutes = defineRoutes({
  module: 'CORE',
  basePath: '/audit',
  routes: [
    {
      method: 'get',
      path: '/',
      permission: 'audit:log:read',
      audit: null,
      summary: 'Audit log, newest first, filterable by record, user, action and date',
      schema: { query },
      handler: (req) => {
        const { entity, entityId, userId, action, from, to, ...page } = req.valid.query;
        const filter = {
          ...(entity ? { entity } : {}),
          ...(entityId ? { entityId } : {}),
          ...(userId ? { userId } : {}),
          ...(action ? { action } : {}),
          ...(from || to
            ? { at: { ...(from ? { $gte: from } : {}), ...(to ? { $lte: to } : {}) } }
            : {}),
        };
        return paginate(
          AuditLog,
          filter,
          { ...page, sort: '-at' },
          {
            allowedSort: ['at'],
            defaultSort: '-at',
            map: ({ _id, tenantId: _t, ...r }) => ({
              id: String(_id),
              ...r,
              userId: r.userId ? String(r.userId) : undefined,
            }),
          },
        );
      },
    },
  ],
});
