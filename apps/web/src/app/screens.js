import { SCREENS } from '@hms/shared/catalog';

/*
 * Web screens that are not boards of their own in the design catalogue: the patient search
 * behind "Patient profile" and a bill opened from the billing counter. They are routed and gated
 * like catalogue screens.
 */
export const EXTRA_SCREENS = Object.freeze({
  PatientSearch: {
    title: 'Patients',
    route: '/patients',
    app: 'web',
    module: 'CORE',
    permissions: ['patients:patient:read'],
    phase: 1,
  },
  BillDetail: {
    title: 'Bill',
    route: '/billing/bills/:id',
    app: 'web',
    module: 'CORE',
    permissions: ['billing:bill:read'],
    phase: 1,
  },
});

/** Every screen the web app knows: the catalogue plus EXTRA_SCREENS. */
export const ALL_SCREENS = Object.freeze({ ...SCREENS, ...EXTRA_SCREENS });

/**
 * The permission that opens a screen, where the catalogue names a module wildcard the role
 * grants do not hold. The cashier opens the billing counter with `billing:bill:read` (the
 * catalogue says `billing:*`, which only the Billing Manager holds); every action on the screen
 * is checked one by one, by the API and by the buttons.
 */
export const SCREEN_PERMISSIONS = Object.freeze({
  Billing: ['billing:bill:read'],
  BillShift: ['billing:shift:read'],
});

/**
 * Menu items whose catalogue route has a parameter (`/patients/:id`) open their list instead,
 * so the menu never links to a literal `:id`.
 */
export const MENU_ROUTES = Object.freeze({
  PatientProfile: '/patients',
  // OPD Consultation opens the doctor's queue; a visit is /opd/visits/<id>.
  Consult: '/opd/visits/queue',
});
