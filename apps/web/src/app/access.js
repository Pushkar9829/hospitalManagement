import { MODULES, hasPermission } from '@hms/shared';
import { PANELS, canSeeScreen } from '@hms/shared/catalog';
import { ALL_SCREENS, MENU_ROUTES, SCREEN_PERMISSIONS } from './screens.js';

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

/** Suspended hospitals can only sign in and open Subscription (the API answers 402 elsewhere). */
export function isSuspended(session) {
  return session?.tenant?.status === 'SUSPENDED';
}

/** A screen with the web app's permission overrides applied (see SCREEN_PERMISSIONS). */
function gateOf(key) {
  const screen = ALL_SCREENS[key];
  if (!screen) return null;
  return SCREEN_PERMISSIONS[key] ? { ...screen, permissions: SCREEN_PERMISSIONS[key] } : screen;
}

/**
 * The user's menu: every role's panel merged in order, de-duplicated, filtered by subscription
 * and permission (the catalogue's buildMenu with the web app's overrides). While the hospital is
 * suspended only Subscription is listed.
 */
export function menuFor(session) {
  const ctx = accessContext(session);
  const suspended = isSuspended(session);
  const groups = new Map();
  const seen = new Set();
  for (const key of panelKeys(session)) {
    for (const g of PANELS[key]?.menu ?? []) {
      for (const it of g.items) {
        const screen = gateOf(it.screen);
        if (seen.has(it.screen) || !screen?.route || !canSeeScreen(screen, ctx)) continue;
        if (suspended && it.screen !== 'Subscription') continue;
        seen.add(it.screen);
        if (!groups.has(g.group)) groups.set(g.group, []);
        groups.get(g.group).push({
          ...it,
          route: MENU_ROUTES[it.screen] ?? screen.route,
          module: screen.module,
          phase: screen.phase,
        });
      }
    }
  }
  return [...groups].map(([group, items]) => ({ group, items }));
}

/**
 * Why a screen can or cannot be opened: 'ok', 'module' (not subscribed: 402) or 'permission'
 * (403). The subscription is checked first so a missing module never reads as a permission gap.
 * Pass the screen key (preferred, applies the overrides) or a screen object.
 */
export function screenAccess(screenOrKey, session) {
  const screen = typeof screenOrKey === 'string' ? gateOf(screenOrKey) : screenOrKey;
  if (!screen) return 'missing';
  const ctx = accessContext(session);
  if (screen.module && screen.module !== 'CORE' && !ctx.modules.includes(screen.module)) {
    return 'module';
  }
  return canSeeScreen(screen, ctx) ? 'ok' : 'permission';
}

export function canOpen(screenKey, session) {
  return screenAccess(screenKey, session) === 'ok';
}

/**
 * The first panel's home route if the user can open it, else /home (every role can). While the
 * hospital is suspended: Subscription for those who may open it, the suspended notice for others.
 */
export function roleHome(session) {
  if (isSuspended(session))
    return canOpen('Subscription', session) ? '/settings/subscription' : '/suspended';
  for (const key of panelKeys(session)) {
    const homeKey = PANELS[key].home;
    const home = ALL_SCREENS[homeKey];
    if (home?.route?.startsWith('/') && canOpen(homeKey, session)) return home.route;
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
