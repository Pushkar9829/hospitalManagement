/** `/patients/:id` matches `/patients/42`. `/` matches only `/`. */
export function routeMatches(pattern, path) {
  if (!pattern || !path) return false;
  if (pattern === '/') return path === '/';
  const re = new RegExp(
    `^${pattern
      .split('/')
      .map((seg) => (seg.startsWith(':') ? '[^/]+' : seg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
      .join('/')}/?$`,
  );
  return re.test(path);
}

/** The menu item for the current path: an exact route beats a pattern, a longer one beats a shorter. */
export function findActiveItem(menu, path) {
  let best = null;
  let bestScore = -1;
  for (const g of menu)
    for (const it of g.items) {
      if (!routeMatches(it.route, path)) continue;
      const score = (it.route === path ? 1000 : 0) + it.route.replace(/:[^/]+/g, '').length;
      if (score > bestScore) {
        best = it;
        bestScore = score;
      }
    }
  return best;
}
