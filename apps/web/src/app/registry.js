import { lazy } from 'react';
import { routeMatches } from '@hms/ui';
import { ALL_SCREENS } from './screens.js';

/*
 * Module registry: every web screen in the design catalogue (packages/shared/catalog, plus the
 * web-only screens in screens.js) gets a route. Screens built so far map to a page component;
 * every other route shows PlannedScreen until its module is built. Each module adds its pages
 * here when it lands.
 */

const HomePage = lazy(() => import('../modules/home/HomePage.jsx'));
const SettingsPage = lazy(() => import('../modules/setup/pages/SettingsPage.jsx'));
const MastersPage = lazy(() => import('../modules/setup/pages/MastersPage.jsx'));
const ApprovalsPage = lazy(() => import('../modules/approvals/pages/ApprovalsPage.jsx'));
const AuditLogPage = lazy(() => import('../modules/audit/pages/AuditLogPage.jsx'));
const UsersPage = lazy(() => import('../modules/users/pages/UsersPage.jsx'));
const RolesPage = lazy(() => import('../modules/users/pages/RolesPage.jsx'));
const PatientSearchPage = lazy(() => import('../modules/patients/pages/PatientSearchPage.jsx'));
const RegisterPatientPage = lazy(() => import('../modules/patients/pages/RegisterPatientPage.jsx'));
const PatientProfilePage = lazy(() => import('../modules/patients/pages/PatientProfilePage.jsx'));
const BillingPage = lazy(() => import('../modules/billing/pages/BillingPage.jsx'));
const BillDetailPage = lazy(() => import('../modules/billing/pages/BillDetailPage.jsx'));
const ShiftPage = lazy(() => import('../modules/billing/pages/ShiftPage.jsx'));
const SubscriptionPage = lazy(() => import('../modules/subscription/pages/SubscriptionPage.jsx'));
// OPD and front office
const OpdPage = lazy(() => import('../modules/opd/pages/OpdPage.jsx'));
const OpdCheckinPage = lazy(() => import('../modules/opd/pages/OpdCheckinPage.jsx'));

/** Screen key -> page component. The admin dashboard is the role home until Phase 1 fills it. */
export const PAGES = {
  Home: HomePage,
  Dashboard: HomePage,
  Settings: SettingsPage,
  Departments: MastersPage,
  Approvals: ApprovalsPage,
  AuditLog: AuditLogPage,
  Users: UsersPage,
  Roles: RolesPage,
  PatientSearch: PatientSearchPage,
  Patients: RegisterPatientPage,
  PatientProfile: PatientProfilePage,
  Billing: BillingPage,
  BillDetail: BillDetailPage,
  BillShift: ShiftPage,
  Subscription: SubscriptionPage,
  // OPD and front office
  Opd: OpdPage,
  OpdCheckin: OpdCheckinPage,
};

/** Screens served outside the signed-in shell. */
export const PUBLIC_SCREENS = new Set(['Login']);

/** Every routable web screen: { key, path, screen, Component | null }. */
export const SCREEN_ROUTES = Object.entries(ALL_SCREENS)
  .filter(([key, s]) => s.app === 'web' && s.route?.startsWith('/') && !PUBLIC_SCREENS.has(key))
  .map(([key, screen]) => ({ key, path: screen.route, screen, Component: PAGES[key] ?? null }));

/** The screen for a URL path (exact routes beat patterns such as /patients/:id). */
export function screenForPath(path) {
  let best = null;
  let bestScore = -1;
  for (const r of SCREEN_ROUTES) {
    if (!routeMatches(r.path, path)) continue;
    const score = (r.path === path ? 1000 : 0) + r.path.replace(/:[^/]+/g, '').length;
    if (score > bestScore) {
      best = r;
      bestScore = score;
    }
  }
  return best;
}

/** The developer component gallery is in dev builds, or when VITE_DEV_GALLERY=1 (smoke tests). */
export const GALLERY_ENABLED =
  import.meta.env.DEV ||
  import.meta.env.VITE_DEV_GALLERY === '1' ||
  import.meta.env.MODE === 'test';
