import { hasPermission } from '@hms/shared';
import { useConsoleMeQuery } from './api.js';

/**
 * Console permissions. The API grants platform roles the keys in PLATFORM_ROLE_PERMISSIONS
 * (apps/api/src/platform/auth.js) and returns them from GET /auth/me. The planned features
 * (leads, coupons, dunning, usage, support sessions, flags, platform users) have no keys there
 * yet; until the API adds them, these role grants (assumed, see the report) decide what a role
 * sees. PLATFORM_SUPER_ADMIN holds '*', so it sees everything either way.
 */
export const PLANNED_ROLE_PERMISSIONS = Object.freeze({
  SALES: ['platform:lead:*', 'platform:coupon:read', 'platform:usage:read'],
  FINANCE: ['platform:dunning:*', 'platform:coupon:read', 'platform:usage:read'],
  SUPPORT: ['platform:support:*', 'platform:usage:read'],
});

export const PLATFORM_ROLES = ['PLATFORM_SUPER_ADMIN', 'SALES', 'FINANCE', 'SUPPORT'];

export function platformPermissions(me) {
  if (!me) return [];
  return [
    ...new Set([
      ...(me.permissions ?? []),
      ...(me.roles ?? []).flatMap((r) => PLANNED_ROLE_PERMISSIONS[r] ?? []),
    ]),
  ];
}

/** `const can = usePlatformCan(); can('platform:tenant:update')`. The API checks again. */
export function usePlatformCan() {
  const { data } = useConsoleMeQuery();
  const granted = platformPermissions(data);
  return (key) => hasPermission(granted, key);
}

/** Console menu (design board "Console"): path, string key, the permission that opens it. */
export const CONSOLE_MENU = [
  { id: 'dashboard', path: '/', permission: 'platform:metrics:read' },
  { id: 'tenants', path: '/tenants', permission: 'platform:tenant:read' },
  { id: 'trials', path: '/trials', permission: 'platform:tenant:read' },
  { id: 'catalogue', path: '/catalogue', permission: 'platform:plan:read' },
  { id: 'subscriptions', path: '/subscriptions', permission: 'platform:subscription:read' },
  { id: 'billing', path: '/billing', permission: 'platform:invoice:read' },
  { id: 'usage', path: '/usage', permission: 'platform:usage:read' },
  { id: 'support', path: '/support', permission: 'platform:support:read' },
  { id: 'releases', path: '/releases', permission: 'platform:flag:read' },
  { id: 'users', path: '/users', permission: 'platform:user:read' },
];

export function menuFor(me) {
  const granted = platformPermissions(me);
  return CONSOLE_MENU.filter((m) => hasPermission(granted, m.permission));
}

/** The first screen a platform user may open (Support has no dashboard). */
export function consoleHome(me) {
  return menuFor(me)[0]?.path ?? '/tenants';
}
