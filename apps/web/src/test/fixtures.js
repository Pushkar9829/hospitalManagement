import { PANELS } from '@hms/shared/catalog';
import { sessionSchema } from '@hms/shared/schemas';

/** Sessions that conform to sessionSchema (validated here so the fixtures cannot drift). */
export function makeSession({
  panel = 'superadmin',
  modules = ['OPD', 'IPD', 'LAB'],
  permissions = PANELS[panel].permissions,
  twoFactorSetupRequired = false,
  branches = [{ id: '64b000000000000000000001', name: 'Main Branch' }],
  name = 'Test User',
} = {}) {
  return sessionSchema.parse({
    user: {
      id: 'u1',
      name,
      username: 'test.user',
      roles: [{ code: panel.toUpperCase(), name: PANELS[panel].name, panel }],
      twoFactorEnabled: !twoFactorSetupRequired,
      twoFactorSetupRequired,
      preferredLanguage: 'en',
    },
    tenant: { id: 't1', name: 'Test Hospital', subdomain: 'test', status: 'ACTIVE', modules },
    branch: branches[0] ?? null,
    branches,
    permissions,
    idleTimeoutMin: 15,
  });
}

export const errorBody = (code, message = code, extra = {}) => ({
  error: { code, message, requestId: 'req-test-1', ...extra },
});
