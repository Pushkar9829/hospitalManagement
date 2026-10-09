import { Suspense } from 'react';
import { Navigate, Outlet, useLocation, useNavigate, useSearchParams } from 'react-router';
import { useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { SCREENS } from '@hms/shared/catalog';
import { Forbidden403, Loading, NotSubscribed402, Page } from '@hms/ui';
import { useMeQuery } from '../modules/auth/api.js';
import { selectSession } from './session.js';
import {
  canChangeSubscription,
  canOpen,
  moduleName,
  roleHome,
  safeNext,
  screenAccess,
} from './access.js';
import { PAGES } from './registry.js';
import { PlannedScreen } from '../modules/system/PlannedScreen.jsx';

export function FullPageLoading() {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-4">
      <Loading rows={3} />
    </div>
  );
}

/** Root: asks the API who is signed in (GET /auth/me) before any route decides. */
export function SessionGate() {
  useMeQuery();
  const { status } = useSelector(selectSession);
  if (status === 'loading') return <FullPageLoading />;
  return <Outlet />;
}

/**
 * Signed-in routes. Anonymous users go to /login?next=…; users who must enrol in two-factor
 * sign-in go to /setup-2fa. An expired session keeps rendering (with the SessionExpired dialog
 * on top) so unsaved work stays on screen.
 */
export function RequireAuth({ setup = false, children }) {
  const { status, data } = useSelector(selectSession);
  const location = useLocation();
  if (!data || status === 'anonymous') {
    const next = `${location.pathname}${location.search}`;
    const qs = next && next !== '/' ? `?next=${encodeURIComponent(next)}` : '';
    return <Navigate to={`/login${qs}`} replace />;
  }
  const mustEnrol = data.user.twoFactorSetupRequired;
  if (mustEnrol && !setup) return <Navigate to="/setup-2fa" replace />;
  if (!mustEnrol && setup) return <Navigate to={roleHome(data)} replace />;
  return children ?? <Outlet />;
}

/** Sign-in pages: once signed in, continue to `next` or the role's home. */
export function PublicOnly({ children }) {
  const { status, data } = useSelector(selectSession);
  const [params] = useSearchParams();
  if (status === 'authenticated' && data) {
    if (data.user.twoFactorSetupRequired) return <Navigate to="/setup-2fa" replace />;
    return <Navigate to={safeNext(params.get('next')) ?? roleHome(data)} replace />;
  }
  return children;
}

/**
 * One catalogue screen: 402 when its module is not subscribed, 403 when the role lacks the
 * permission (both name what is missing), otherwise the page or its planned placeholder.
 */
export function ScreenGate({ screenKey }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data } = useSelector(selectSession);
  const screen = SCREENS[screenKey];
  const access = screenAccess(screen, data);
  const home = roleHome(data);
  if (access === 'module') {
    return (
      <Page width="medium">
        <NotSubscribed402
          className="mt-8"
          module={moduleName(screen.module)}
          canAdd={canChangeSubscription(data)}
          onAdd={() => navigate('/settings/subscription')}
          onBack={() => navigate(home)}
        />
      </Page>
    );
  }
  if (access === 'permission') {
    return (
      <Page width="medium">
        <Forbidden403
          className="mt-8"
          screen={screen.title}
          permission={screen.permissions[0]}
          onBack={() => navigate(home)}
          backLabel={t('common.backToHome')}
        />
      </Page>
    );
  }
  const Component = PAGES[screenKey];
  if (!Component) return <PlannedScreen screenKey={screenKey} />;
  return (
    <Suspense
      fallback={
        <Page>
          <Loading />
        </Page>
      }
    >
      <Component screenKey={screenKey} />
    </Suspense>
  );
}

/** `/` is the admin dashboard for users who have it; everyone else goes to their home. */
export function RootRoute() {
  const { data } = useSelector(selectSession);
  if (canOpen('Dashboard', data)) return <ScreenGate screenKey="Dashboard" />;
  return <Navigate to={roleHome(data)} replace />;
}
