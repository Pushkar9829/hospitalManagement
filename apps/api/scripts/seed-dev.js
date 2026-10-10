/**
 * Development data: a demo hospital at http://demo.localhost:5173 with one user per role panel.
 * Usage: pnpm --filter @hms/api seed:dev   (needs MongoDB and Redis from infra/docker)
 * Every user's password is printed once; nothing here is used outside development.
 */
import { env } from '../src/config/env.js';
import { connectDb, disconnectDb } from '../src/core/db/connection.js';
import '../src/modules/index.js'; // registers module seeders
import { closeRedis } from '../src/core/cache/redis.js';
import { runAsSystem } from '../src/core/tenancy/context.js';
import { Tenant } from '../src/core/tenancy/tenant.model.js';
import { tenantRegistry } from '../src/core/tenancy/tenant.registry.js';
import { User } from '../src/core/auth/models/user.model.js';
import { hashPassword } from '../src/core/auth/password.js';
import { provisionTenant } from '../src/core/tenancy/provision.js';

if (env.isProd) throw new Error('seed-dev must never run in production');
const PASSWORD = process.env.SEED_PASSWORD ?? 'Demo@12345';

await connectDb();
const existing = await Tenant.findOne({ subdomain: 'demo' });
if (existing) {
  console.log('Demo hospital already exists: http://demo.localhost:5173');
} else {
  const { tenant, branch, roles } = await provisionTenant({
    name: 'Demo Hospital',
    subdomain: 'demo',
    modules: [
      'OPD',
      'IPD',
      'NUR',
      'LAB',
      'RAD',
      'PHR',
      'INV',
      'HRM',
      'PAY',
      'FIN',
      'MRD',
      'DIET',
      'FAC',
      'QLT',
      'CRM',
    ],
    // Demo only: production tenants require two-factor sign-in for privileged roles.
    settings: { twoFactorRoles: [] },
    admin: {
      name: 'Dr. Arjun Rao',
      username: 'superadmin',
      mobile: '9876500001',
      password: PASSWORD,
    },
  });
  await runAsSystem(tenant._id, async () => {
    const hash = await hashPassword(PASSWORD);
    let i = 2;
    for (const role of roles.filter((r) => r.code !== 'superadmin')) {
      await User.create({
        name: `Demo ${role.name}`,
        username: role.code,
        mobile: `98765${String(i++).padStart(5, '0')}`,
        passwordHash: hash,
        roles: [role._id],
        branchIds: [branch._id],
        defaultBranchId: branch._id,
      });
    }
  });
  await tenantRegistry.invalidate(tenant);
  console.log(`Demo hospital created: http://demo.localhost:5173
Sign in as "superadmin" or any role panel key (doctor, nurse, cashier, ...) with password ${PASSWORD}`);
}
await disconnectDb();
await closeRedis();
