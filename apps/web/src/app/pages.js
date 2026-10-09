import { lazy } from 'react';
import { GALLERY_ENABLED } from './registry.js';

/** Pages outside the screen catalogue, each loaded only when opened. */
export const LoginPage = lazy(() => import('../modules/auth/pages/LoginPage.jsx'));
export const ForgotPasswordPage = lazy(
  () => import('../modules/auth/pages/ForgotPasswordPage.jsx'),
);
export const SetupTwoFactorPage = lazy(
  () => import('../modules/auth/pages/SetupTwoFactorPage.jsx'),
);
export const NotFoundPage = lazy(() => import('../modules/system/NotFoundPage.jsx'));
export const DevGalleryPage = GALLERY_ENABLED
  ? lazy(() => import('../modules/dev/DevGalleryPage.jsx'))
  : null;
