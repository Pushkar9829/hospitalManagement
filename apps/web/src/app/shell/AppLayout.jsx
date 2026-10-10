import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { Keyboard, LogOut, Palette, Languages } from 'lucide-react';
import { PANELS } from '@hms/shared/catalog';
import { LANGUAGES } from '@hms/i18n';
import {
  AppShell,
  CommandPalette,
  Loading,
  Offline,
  Page,
  SessionExpired,
  ShortcutsDialog,
  Sidebar,
  SubscriptionBanner,
  THEMES,
  TopBar,
  findActiveItem,
  useHotkeys,
  useOnlineStatus,
  useRegisteredHotkeys,
  useToast,
} from '@hms/ui';
import { baseApi } from '../baseApi.js';
import { menuFor, canChangeSubscription, canOpen, isSuspended, panelKeys } from '../access.js';
import { screenForPath } from '../registry.js';
import { selectSession } from '../session.js';
import { sessionExpired, signedOut } from '../sessionActions.js';
import { usePrefs } from '../prefs-context.js';
import { useLogoutMutation, useSwitchBranchMutation } from '../../modules/auth/api.js';
import { useApprovalCountQuery } from '../../modules/approvals/api.js';
import { useIdleTimeout } from '../../lib/useIdleTimeout.js';
import { clearAllDrafts } from '../../lib/useDraft.js';

/** Loaded when opened: the password form (zod, react-hook-form) stays out of the first bundle. */
const ChangePasswordDialog = lazy(() =>
  import('../../modules/auth/components/ChangePasswordDialog.jsx').then((m) => ({
    default: m.ChangePasswordDialog,
  })),
);

const themeLabel = {
  light: 'topbar.themeLight',
  dark: 'topbar.themeDark',
  contrast: 'topbar.themeContrast',
};

/** Shortcuts handled by the hotkey provider itself, listed in the `?` dialog. */
const BUILT_IN = [
  { keys: 'alt+s', description: 'shortcuts.save', group: 'global' },
  { keys: 'escape', description: 'shortcuts.close', group: 'global' },
  { keys: 'enter', description: 'shortcuts.tableRow', group: 'global' },
];

/** The signed-in frame: menu, top bar, palette, shortcuts, idle sign-out, session expiry. */
export function AppLayout() {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const online = useOnlineStatus();
  const { theme, setTheme, language, setLanguage } = usePrefs();
  const { status, data, expired } = useSelector(selectSession);
  const [logout] = useLogoutMutation();
  const [switchBranch] = useSwitchBranchMutation();

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const searchRef = useRef(null);
  const mainFocusPath = useRef(location.pathname);

  // Approvals waiting for me: polled every minute as background traffic (x-background: 1), so
  // it never keeps an idle session alive; decisions refetch it straight away.
  const approvalsVisible = canOpen('Approvals', data) && !isSuspended(data);
  const { data: approvalCount } = useApprovalCountQuery(undefined, {
    skip: !approvalsVisible || status !== 'authenticated',
    pollingInterval: 60_000,
    skipPollingIfUnfocused: true,
  });
  const waiting = approvalCount?.inbox ?? 0;
  const baseMenu = useMemo(() => menuFor(data), [data]);
  const menu = useMemo(
    () =>
      waiting
        ? baseMenu.map((g) => ({
            ...g,
            items: g.items.map((it) =>
              it.screen === 'Approvals'
                ? {
                    ...it,
                    badge: waiting,
                    badgeLabel: t('menu.approvalsWaiting', { count: waiting }),
                  }
                : it,
            ),
          }))
        : baseMenu,
    [baseMenu, waiting, t],
  );
  const panels = panelKeys(data).map((k) => PANELS[k]);
  const panelName = panels.map((p) => p.name).join(', ');
  const active = findActiveItem(menu, location.pathname);
  const route = screenForPath(location.pathname);
  const title = active?.label ?? route?.screen.title ?? '';
  const group = active ? menu.find((g) => g.items.includes(active))?.group : null;

  const go = useCallback(
    (to) => {
      setDrawerOpen(false);
      navigate(to);
    },
    [navigate],
  );

  // Page title and focus: a new screen announces itself to screen readers via the h1 in <main>.
  useEffect(() => {
    document.title = title ? `${title} · ${data.tenant.name}` : data.tenant.name;
  }, [title, data.tenant.name]);
  useEffect(() => {
    if (mainFocusPath.current === location.pathname) return;
    mainFocusPath.current = location.pathname;
    document.getElementById('main')?.focus({ preventScroll: true });
  }, [location.pathname]);

  const signOut = useCallback(async () => {
    try {
      await logout().unwrap();
    } catch {
      // Signed out locally either way; the cookie expires on its own.
    }
    clearAllDrafts();
    dispatch(signedOut());
    dispatch(baseApi.util.resetApiState());
    navigate('/login', { replace: true });
  }, [logout, dispatch, navigate]);

  useIdleTimeout({
    minutes: data.idleTimeoutMin,
    enabled: status === 'authenticated',
    onIdle: () => {
      logout().catch(() => {});
      dispatch(sessionExpired({ reason: 'idle', minutes: data.idleTimeoutMin }));
    },
  });

  useHotkeys(
    [
      {
        keys: 'mod+k',
        handler: () => setPaletteOpen((o) => !o),
        allowInInputs: true,
        description: t('shortcuts.palette'),
      },
      { keys: '?', handler: () => setShortcutsOpen(true), description: t('shortcuts.help') },
      {
        keys: '/',
        handler: () => {
          if (window.matchMedia?.('(min-width: 1024px)').matches) searchRef.current?.focus();
          else setDrawerOpen(true);
        },
        description: t('shortcuts.menuSearch'),
      },
    ],
    { group: 'global' },
  );
  const registered = useRegisteredHotkeys();
  const shortcutList = useMemo(
    () => [...registered, ...BUILT_IN.map((b) => ({ ...b, description: t(b.description) }))],
    [registered, t],
  );

  const onBranchChange = async (branchId) => {
    if (branchId === data.branch?.id) return;
    try {
      const s = await switchBranch({ branchId }).unwrap();
      toast({ title: t('topbar.branchSwitched', { branch: s.branch?.name ?? '' }) });
    } catch {
      toast({ title: t('states.errorBody'), tone: 'critical' });
    }
  };

  const paletteGroups = useMemo(
    () => [
      {
        heading: t('palette.screens'),
        items: menu.flatMap((g) =>
          g.items.map((it) => ({
            id: `screen:${it.screen}`,
            label: it.label,
            hint: g.group,
            keywords: [it.screen],
            onSelect: () => go(it.route),
          })),
        ),
      },
      {
        heading: t('palette.actions'),
        items: [
          {
            id: 'action:shortcuts',
            label: t('palette.openShortcuts'),
            shortcut: '?',
            icon: <Keyboard size={16} />,
            onSelect: () => setShortcutsOpen(true),
          },
          ...THEMES.filter((th) => th !== theme).map((th) => ({
            id: `action:theme:${th}`,
            label: t('palette.switchTheme', { theme: t(themeLabel[th]) }),
            icon: <Palette size={16} />,
            onSelect: () => setTheme(th),
          })),
          ...LANGUAGES.filter((l) => l.code !== language).map((l) => ({
            id: `action:lang:${l.code}`,
            label: `${t('topbar.language')}: ${l.label}`,
            icon: <Languages size={16} />,
            onSelect: () => setLanguage(l.code),
          })),
          {
            id: 'action:signout',
            label: t('palette.signOut'),
            icon: <LogOut size={16} />,
            onSelect: signOut,
          },
        ],
      },
    ],
    [menu, t, go, theme, setTheme, language, setLanguage, signOut],
  );

  const sidebarProps = {
    menu,
    activePath: location.pathname,
    onNavigate: go,
    tenantName: data.tenant.name,
    branchName: data.branch?.name,
    panelName,
    storageKey: `hms:menu:${data.tenant.id}:${data.user.id}`,
  };

  // Subscription state (spec 2.4): Super Admins get a link to fix it on Subscription.
  const fixSubscription =
    canChangeSubscription(data) && location.pathname !== '/settings/subscription'
      ? () => go('/settings/subscription')
      : undefined;
  const banners = [
    data.tenant.status === 'READ_ONLY' && (
      <SubscriptionBanner
        key="ro"
        variant="readOnly"
        onFix={fixSubscription}
        fixLabel={t('errors.limitAction')}
      />
    ),
    data.tenant.status === 'PAST_DUE' && (
      <SubscriptionBanner key="due" variant="paymentFailed" onFix={fixSubscription} />
    ),
    !online && <Offline key="offline" />,
  ].filter(Boolean);

  return (
    <AppShell
      sidebar={<Sidebar {...sidebarProps} searchRef={searchRef} />}
      drawerSidebar={<Sidebar {...sidebarProps} />}
      drawerOpen={drawerOpen}
      onDrawerOpenChange={setDrawerOpen}
      banner={banners.length ? banners : null}
      topbar={
        <TopBar
          title={title}
          breadcrumb={[group ?? panelName, title].filter(Boolean).join(' / ')}
          onMenuClick={() => setDrawerOpen(true)}
          onOpenPalette={() => setPaletteOpen(true)}
          branches={data.branches}
          branchId={data.branch?.id}
          onBranchChange={onBranchChange}
          user={{
            name: data.user.name,
            subtitle: data.user.designation ?? data.user.roles.map((r) => r.name).join(', '),
          }}
          theme={theme}
          onThemeChange={setTheme}
          language={language}
          languages={LANGUAGES}
          onLanguageChange={setLanguage}
          onMySpace={canOpen('MySpace', data) ? () => go('/me') : undefined}
          onChangePassword={() => setPasswordOpen(true)}
          onShortcuts={() => setShortcutsOpen(true)}
          onSignOut={signOut}
        />
      }
    >
      <Suspense
        fallback={
          <Page>
            <Loading />
          </Page>
        }
      >
        <Outlet />
      </Suspense>
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} groups={paletteGroups} />
      <ShortcutsDialog
        open={shortcutsOpen}
        onOpenChange={setShortcutsOpen}
        shortcuts={shortcutList}
      />
      {passwordOpen && (
        <Suspense fallback={null}>
          <ChangePasswordDialog open onOpenChange={setPasswordOpen} />
        </Suspense>
      )}
      {status === 'expired' && (
        <SessionExpired
          dialog
          minutes={expired?.reason === 'idle' ? expired.minutes : null}
          message={expired?.message}
          onSignIn={() =>
            navigate(`/login?next=${encodeURIComponent(`${location.pathname}${location.search}`)}`)
          }
        />
      )}
    </AppShell>
  );
}
