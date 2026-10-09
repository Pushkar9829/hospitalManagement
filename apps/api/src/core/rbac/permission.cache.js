import { Role } from '../auth/models/role.model.js';
import { User } from '../auth/models/user.model.js';
import { redis } from '../cache/redis.js';

const TTL_SEC = 60;
const key = (tenantId, userId) => `perm:${tenantId}:${userId}`;

/**
 * The signed-in user's effective access: union of role permissions, role panels and branches.
 * Cached for 60 s so a disabled user or changed role takes effect within a minute; call
 * invalidate() from user and role management for an immediate change.
 */
export const permissionCache = {
  async forUser(tenantId, userId) {
    const hit = await redis().get(key(tenantId, userId));
    if (hit) return JSON.parse(hit);
    const user = await User.findById(userId)
      .select('name status roles branchIds defaultBranchId twoFactor.enabled')
      .lean();
    if (!user) return null;
    const roles = await Role.find({ _id: { $in: user.roles } })
      .select('code name panel permissions scope')
      .lean();
    const access = {
      name: user.name,
      status: user.status,
      permissions: [...new Set(roles.flatMap((r) => r.permissions))],
      roles: roles.map((r) => ({ code: r.code, name: r.name, panel: r.panel, scope: r.scope })),
      branchIds: (user.branchIds ?? []).map(String),
      defaultBranchId: user.defaultBranchId ? String(user.defaultBranchId) : null,
      twoFactorEnabled: Boolean(user.twoFactor?.enabled),
    };
    await redis().set(key(tenantId, userId), JSON.stringify(access), 'EX', TTL_SEC);
    return access;
  },
  async invalidate(tenantId, userId) {
    await redis().del(key(tenantId, userId));
  },
};
