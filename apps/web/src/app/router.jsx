import { Suspense } from 'react';
import { Navigate, createBrowserRouter } from 'react-router';
import { SCREEN_ROUTES } from './registry.js';
import {
  FullPageLoading,
  PublicOnly,
  RequireAuth,
  RootRoute,
  ScreenGate,
  SessionGate,
} from './guards.jsx';
import { AppLayout } from './shell/AppLayout.jsx';
import { RouteError } from './RouteError.jsx';
import { isMarketingHost } from './host.js';
import {
  ChangePasswordPage,
  DevGalleryPage,
  ForgotPasswordPage,
  LoginPage,
  NotFoundPage,
  PricingPage,
  SetupTwoFactorPage,
  SignupPage,
  SuspendedPage,
  WelcomePage,
} from './pages.js';

function lazyPage(Component) {
  return (
    <Suspense fallback={<FullPageLoading />}>
      <Component />
    </Suspense>
  );
}

/** Route table: public sign-in pages, then the signed-in shell with one route per screen. */
export const routes = [
  ...(DevGalleryPage ? [{ path: '/dev/ui', element: lazyPage(DevGalleryPage) }] : []),
  {
    element: <SessionGate />,
    errorElement: <RouteError />,
    children: [
      { path: '/login', element: <PublicOnly>{lazyPage(LoginPage)}</PublicOnly> },
      { path: '/welcome', element: lazyPage(WelcomePage) },
      {
        path: '/forgot-password',
        element: <PublicOnly>{lazyPage(ForgotPasswordPage)}</PublicOnly>,
      },
      {
        path: '/setup-2fa',
        element: <RequireAuth gate="/setup-2fa">{lazyPage(SetupTwoFactorPage)}</RequireAuth>,
      },
      {
        path: '/change-password',
        element: <RequireAuth gate="/change-password">{lazyPage(ChangePasswordPage)}</RequireAuth>,
      },
      {
        element: <RequireAuth />,
        children: [
          { path: '/suspended', element: lazyPage(SuspendedPage) },
          {
            element: <AppLayout />,
            children: [
              { path: '/', element: <RootRoute /> },
              ...SCREEN_ROUTES.filter((r) => r.path !== '/').map((r) => ({
                path: r.path,
                element: <ScreenGate key={r.key} screenKey={r.key} />,
              })),
              { path: '*', element: <NotFoundPage /> },
            ],
          },
        ],
      },
    ],
  },
];

/**
 * The marketing host (no hospital): pricing and the trial signup, calling /api/public. Nothing
 * here asks /api/v1/auth/me, which needs a hospital address.
 */
export const publicRoutes = [
  {
    errorElement: <RouteError />,
    children: [
      { path: '/pricing', element: lazyPage(PricingPage) },
      { path: '/signup', element: lazyPage(SignupPage) },
      { path: '*', element: <Navigate to="/pricing" replace /> },
    ],
  },
];

/** The staff app on a hospital host, the public pages on the marketing host (see host.js). */
export function createAppRouter(hostname = globalThis.location?.hostname) {
  return createBrowserRouter(isMarketingHost(hostname) ? publicRoutes : routes);
}
