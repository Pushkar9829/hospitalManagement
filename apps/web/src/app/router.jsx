import { Suspense } from 'react';
import { createBrowserRouter } from 'react-router';
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
import {
  ChangePasswordPage,
  DevGalleryPage,
  ForgotPasswordPage,
  LoginPage,
  NotFoundPage,
  SetupTwoFactorPage,
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

export function createAppRouter() {
  return createBrowserRouter(routes);
}
