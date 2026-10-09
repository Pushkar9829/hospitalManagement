import { PANELS } from '@hms/shared/catalog';
import { runAsSystem } from './context.js';
import { Tenant } from './tenant.model.js';
import { Branch } from './branch.model.js';
import { Role } from '../auth/models/role.model.js';
import { User } from '../auth/models/user.model.js';
import { hashPassword } from '../auth/password.js';
import { withTransaction } from '../db/model.js';

/**
 * Creates a hospital with its first branch, the 28 system roles from the UI design (role panels)
 * and a Super Admin. Used by self-service signup (Phase 1), the platform console and tests.
 * All or nothing: a failure part-way never leaves a hospital without roles or an admin.
 */
export async function provisionTenant({
  name,
  subdomain,
  modules = [],
  status = 'ACTIVE',
  settings = {},
  branch = { name: 'Main Branch', code: 'MAIN' },
  admin,
}) {
  const passwordHash = admin ? await hashPassword(admin.password) : undefined;
  return withTransaction(async () => {
    const [tenant] = await Tenant.create([
      { name, subdomain, status, modules: modules.map((code) => ({ code })), settings },
    ]);
    return runAsSystem(tenant._id, async () => {
      const [mainBranch] = await Branch.create([branch]);
      const roles = await Role.create(
        Object.entries(PANELS).map(([code, p]) => ({
          code,
          name: p.name,
          panel: code,
          permissions: p.permissions,
          isSystem: true,
          scope: code === 'superadmin' || p.readOnly ? 'all' : 'branch',
        })),
        { ordered: true },
      );
      let superAdmin = null;
      if (admin) {
        [superAdmin] = await User.create([
          {
            name: admin.name,
            username: admin.username,
            mobile: admin.mobile,
            email: admin.email,
            designation: 'Super Admin',
            passwordHash,
            roles: [roles.find((r) => r.code === 'superadmin')._id],
            branchIds: [mainBranch._id],
            defaultBranchId: mainBranch._id,
          },
        ]);
      }
      return { tenant, branch: mainBranch, roles, superAdmin };
    });
  });
}
