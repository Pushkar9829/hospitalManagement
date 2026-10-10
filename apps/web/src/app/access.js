import { MODULES, hasPermission } from '@hms/shared';
import { PANELS, SCREENS, buildMenu, canSeeScreen } from '@hms/shared/catalog';

/** Modules the hospital can use: CORE is always on. */
export function activeModules(session) {
  return ['CORE', ...(session?.tenant?.modules ?? [])];
}

export function accessContext(session) {
  return { modules: activeModules(session), permissions: session?.permissions ?? [] };
}

export function panelKeys(session) {
  return (session?.user?.roles ?? []).map((r) => r.panel).filter((p) => PANELS[p]);
}

/** The user's menu: every role's panel merged, filtered by subscription and permission. */
export function menuFor(session) {
  return buildMenu(panelKeys(session), accessContext(session));
}

/**
 * Why a screen can or cannot be opened: 'ok', 'module' (not subscribed: 402) or 'permission'
 * (403). The subscription is checked first so a missing module never reads as a permission gap.
 */
export function screenAccess(screen, session) {
  if (!screen) return 'missing';
  const ctx = accessContext(session);
  if (screen.module && screen.module !== 'CORE' && !ctx.modules.includes(screen.module)) {
    return 'module';
  }
  return canSeeScreen(screen, ctx) ? 'ok' : 'permission';
}

export function canOpen(screenKey, session) {
  return screenAccess(SCREENS[screenKey], session) === 'ok';
}

/** The first panel's home route if the user can open it, else /home (every role can). */
export function roleHome(session) {
  for (const key of panelKeys(session)) {
    const home = SCREENS[PANELS[key].home];
    if (home?.route?.startsWith('/') && screenAccess(home, session) === 'ok') return home.route;
  }
  return '/home';
}

/** Only Super Admins (or anyone who may change the subscription) see "Add module". */
export function canChangeSubscription(session) {
  return hasPermission(session?.permissions ?? [], 'settings:subscription:update');
}

export function moduleName(code) {
  return MODULES[code]?.name ?? code;
}

/** Keeps `next` on this site: a path, not a protocol-relative URL, and never the login page. */
export function safeNext(next) {
  if (typeof next !== 'string' || !next.startsWith('/') || next.startsWith('//')) return null;
  if (next.startsWith('/login')) return null;
  return next;
}

/**
 * The set-up step a signed-in user must finish before anything else, or null. A password
 * change comes first: until it is done the API refuses every other call, two-factor set-up too.
 */
export function requiredGate(session) {
  if (session?.user.mustChangePassword) return '/change-password';
  if (session?.user.twoFactorSetupRequired) return '/setup-2fa';
  return null;
}
