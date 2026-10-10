import { useMemo, useState } from 'react';
import { ChevronDown, Search, Star, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '../lib/cn.js';
import { safeStorage } from '../lib/storage.js';
import { findActiveItem } from './routes.js';

function isPlainClick(e) {
  return e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey;
}

function MenuItem({ item, active, favourite, onToggleFavourite, onNavigate, t }) {
  return (
    <li className="group/item relative flex items-center">
      <a
        href={item.route}
        aria-current={active ? 'page' : undefined}
        onClick={(e) => {
          if (!onNavigate || !isPlainClick(e)) return;
          e.preventDefault();
          onNavigate(item.route, item);
        }}
        className={cn(
          'relative flex min-h-9 flex-1 items-center rounded-control py-1.5 pr-10 pl-3 text-base text-menu-ink transition-colors pointer-coarse:min-h-tap',
          'hover:bg-menu-hover',
          active &&
            'bg-menu-active font-semibold before:absolute before:top-1.5 before:bottom-1.5 before:left-0 before:w-[3px] before:rounded-r before:bg-menu-accent',
        )}
      >
        <span className="truncate">{item.label}</span>
        {item.badge > 0 && (
          <span className="ml-auto inline-flex min-w-5 shrink-0 items-center justify-center rounded-chip bg-accent px-1.5 text-xs leading-5 font-semibold text-on-accent">
            <span aria-hidden="true">{item.badge > 99 ? '99+' : item.badge}</span>
            <span className="sr-only">{item.badgeLabel ?? item.badge}</span>
          </span>
        )}
      </a>
      <button
        type="button"
        aria-pressed={favourite}
        aria-label={
          favourite
            ? t('menu.removeFavourite', { label: item.label })
            : t('menu.addFavourite', { label: item.label })
        }
        onClick={() => onToggleFavourite(item.screen)}
        className={cn(
          'absolute right-1 inline-flex size-8 cursor-pointer items-center justify-center rounded-control text-menu-muted transition-opacity hover:bg-menu-hover hover:text-menu-ink',
          favourite
            ? 'text-menu-accent opacity-100'
            : 'opacity-0 group-hover/item:opacity-100 focus-visible:opacity-100 pointer-coarse:opacity-100',
        )}
      >
        <Star size={14} aria-hidden="true" fill={favourite ? 'currentColor' : 'none'} />
      </button>
    </li>
  );
}

/**
 * Role menu (UI/UX review: the 47-item menu). Search filters items, groups collapse, and a
 * Favourites group is pinned on top. Collapsed groups and favourites are kept in localStorage
 * under `storageKey` (use one key per user).
 *
 * `menu` is the output of buildMenu(): [{ group, items: [{ label, screen, route }] }]. An item
 * may carry `badge` (a count, e.g. approvals waiting) and `badgeLabel` (its spoken text).
 * `onNavigate(route, item)` handles plain clicks; modified clicks open the href normally.
 */
export function Sidebar({
  menu = [],
  activePath,
  onNavigate,
  tenantName,
  branchName,
  panelName,
  storageKey = 'hms:menu',
  searchRef,
  className,
}) {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [collapsed, setCollapsed] = useState(() => safeStorage.get(`${storageKey}:collapsed`, []));
  const [favourites, setFavourites] = useState(() =>
    safeStorage.get(`${storageKey}:favourites`, []),
  );

  const active = useMemo(() => findActiveItem(menu, activePath), [menu, activePath]);
  const allItems = useMemo(() => menu.flatMap((g) => g.items), [menu]);
  const favItems = useMemo(
    () => favourites.map((key) => allItems.find((it) => it.screen === key)).filter(Boolean),
    [favourites, allItems],
  );

  const q = query.trim().toLowerCase();
  const groups = useMemo(() => {
    const base = [
      ...(favItems.length
        ? [{ group: t('menu.favourites'), id: '__favourites', items: favItems }]
        : []),
      ...menu.map((g) => ({ ...g, id: g.group })),
    ];
    if (!q) return base;
    return base
      .filter((g) => g.id !== '__favourites')
      .map((g) => ({
        ...g,
        items: g.items.filter(
          (it) => it.label.toLowerCase().includes(q) || g.group.toLowerCase().includes(q),
        ),
      }))
      .filter((g) => g.items.length);
  }, [menu, favItems, q, t]);

  const toggleGroup = (id) => {
    setCollapsed((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      safeStorage.set(`${storageKey}:collapsed`, next);
      return next;
    });
  };

  const toggleFavourite = (screen) => {
    setFavourites((prev) => {
      const next = prev.includes(screen) ? prev.filter((x) => x !== screen) : [...prev, screen];
      safeStorage.set(`${storageKey}:favourites`, next);
      return next;
    });
  };

  const firstMatch = q ? groups[0]?.items[0] : null;

  return (
    <div
      data-surface="menu"
      className={cn('flex h-full min-h-0 flex-col bg-menu text-menu-ink', className)}
    >
      <div className="flex items-center gap-3 px-4 pt-4 pb-3">
        <span
          aria-hidden="true"
          className="inline-flex size-9 shrink-0 items-center justify-center rounded-control bg-accent text-md font-bold text-on-accent"
        >
          {(tenantName ?? 'H').trim().charAt(0).toUpperCase()}
        </span>
        <div className="min-w-0">
          <p className="truncate text-base font-semibold">{tenantName}</p>
          {(branchName || panelName) && (
            <p className="text-sm text-menu-muted">
              {[branchName, panelName].filter(Boolean).join(' · ')}
            </p>
          )}
        </div>
      </div>

      <div className="px-3 pb-3">
        <div className="relative">
          <Search
            aria-hidden="true"
            size={16}
            className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-menu-muted"
          />
          <input
            ref={searchRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape' && query) {
                e.preventDefault();
                e.stopPropagation();
                setQuery('');
              } else if (e.key === 'Enter' && firstMatch && onNavigate) {
                e.preventDefault();
                onNavigate(firstMatch.route, firstMatch);
                setQuery('');
              }
            }}
            aria-label={t('menu.search')}
            placeholder={t('menu.searchPlaceholder')}
            className="min-h-9 w-full rounded-control border border-menu-line bg-menu-field py-1.5 pr-3 pl-9 text-base text-menu-ink placeholder:text-menu-muted pointer-coarse:min-h-tap [&::-webkit-search-cancel-button]:hidden"
          />
          {query && (
            <button
              type="button"
              aria-label={t('common.dismiss')}
              onClick={() => setQuery('')}
              className="absolute top-1/2 right-1 inline-flex size-7 -translate-y-1/2 cursor-pointer items-center justify-center rounded-control text-menu-muted hover:text-menu-ink"
            >
              <X size={14} aria-hidden="true" />
            </button>
          )}
        </div>
      </div>

      <nav
        aria-label={t('menu.navigation')}
        className="min-h-0 flex-1 [scrollbar-color:var(--color-menu-line)_transparent] overflow-y-auto border-t border-menu-line px-3 pt-2 pb-6"
      >
        {q && groups.length === 0 && (
          <p role="status" className="px-3 py-4 text-sm text-menu-muted">
            {t('menu.noResults', { query })}
          </p>
        )}
        {groups.map((g) => {
          const isCollapsed = !q && collapsed.includes(g.id);
          const listId = `menu-group-${g.id.replace(/\W+/g, '-')}`;
          const containsActive = g.items.some((it) => it === active);
          return (
            <div key={g.id} className="mt-2 first:mt-0">
              <h2>
                <button
                  type="button"
                  aria-expanded={!isCollapsed}
                  aria-controls={listId}
                  onClick={() => toggleGroup(g.id)}
                  disabled={Boolean(q)}
                  className="flex min-h-8 w-full cursor-pointer items-center justify-between rounded-control px-3 text-xs font-semibold tracking-[0.08em] text-menu-muted uppercase hover:text-menu-ink disabled:cursor-default"
                >
                  <span className={cn(containsActive && isCollapsed && 'text-menu-ink')}>
                    {g.id === '__favourites' && (
                      <Star
                        size={12}
                        aria-hidden="true"
                        className="-mt-0.5 mr-1.5 inline"
                        fill="currentColor"
                      />
                    )}
                    {g.group}
                  </span>
                  {!q && (
                    <ChevronDown
                      aria-hidden="true"
                      size={14}
                      className={cn('transition-transform', isCollapsed && '-rotate-90')}
                    />
                  )}
                </button>
              </h2>
              <ul id={listId} hidden={isCollapsed} className="mt-0.5 flex flex-col gap-0.5">
                {g.items.map((it) => (
                  <MenuItem
                    key={`${g.id}-${it.screen}`}
                    item={it}
                    active={it === active}
                    favourite={favourites.includes(it.screen)}
                    onToggleFavourite={toggleFavourite}
                    onNavigate={onNavigate}
                    t={t}
                  />
                ))}
              </ul>
            </div>
          );
        })}
      </nav>
    </div>
  );
}
