import { SCREENS } from './screens.js';
import { PANELS } from './panels.js';
import { hasPermission } from '../permissions.js';

export { SCREENS, PANELS };

/** A screen is visible when its module is subscribed (or it has none) and any permission matches. */
export function canSeeScreen(screen, { modules, permissions }) {
  if (!screen) return false;
  const mods = modules instanceof Set ? modules : new Set(modules);
  if (screen.module && screen.module !== 'CORE' && !mods.has(screen.module)) return false;
  if (!screen.permissions.length) return true;
  return screen.permissions.some((k) => hasPermission(permissions, k));
}

/**
 * Menu for a set of panels (a user may hold several roles): groups merged in order, items
 * de-duplicated, filtered by subscription and permission.
 */
export function buildMenu(panelKeys, ctx) {
  const groups = new Map();
  const seen = new Set();
  for (const key of panelKeys) {
    for (const g of PANELS[key]?.menu ?? []) {
      for (const it of g.items) {
        const screen = SCREENS[it.screen];
        if (seen.has(it.screen) || !screen?.route || !canSeeScreen(screen, ctx)) continue;
        seen.add(it.screen);
        if (!groups.has(g.group)) groups.set(g.group, []);
        groups.get(g.group).push({ ...it, route: screen.route, module: screen.module, phase: screen.phase });
      }
    }
  }
  return [...groups].map(([group, items]) => ({ group, items }));
}
