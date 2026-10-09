import { PANELS } from '@hms/shared/catalog';
import { runAsSystem } from './context.js';
import { Tenant } from './tenant.model.js';
import { Branch } from './branch.model.js';
import { Role } from '../auth/models/role.model.js';
import { User } from '../auth/models/user.model.js';
import { hashPassword } from '../auth/password.js';

/**
 * Creates a hospital with its first branch, the 28 system roles from the UI design (role panels)
 * and a Super Admin. Used by self-service signup (Phase 1), the platform console and tests.
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
  const tenant = await Tenant.create({
    name,
    subdomain,
    status,
    modules: modules.map((code) => ({ code })),
    settings,
  });
  return runAsSystem(tenant._id, async () => {
    const mainBranch = await Branch.create(branch);
    const roles = await Role.create(
      Object.entries(PANELS).map(([code, p]) => ({
        code,
        name: p.name,
        panel: code,
        permissions: p.permissions,
        isSystem: true,
        scope: code === 'superadmin' || p.readOnly ? 'all' : 'branch',
      })),
    );
    let superAdmin = null;
    if (admin) {
      superAdmin = await User.create({
        name: admin.name,
        username: admin.username,
        mobile: admin.mobile,
        email: admin.email,
        designation: 'Super Admin',
        passwordHash: await hashPassword(admin.password),
        roles: [roles.find((r) => r.code === 'superadmin')._id],
        branchIds: [mainBranch._id],
        defaultBranchId: mainBranch._id,
      });
    }
    return { tenant, branch: mainBranch, roles, superAdmin };
  });
}
