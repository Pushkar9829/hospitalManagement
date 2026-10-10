import { PANELS } from './catalog/panels.js';

/**
 * Permissions each system role gets beyond what its menu implies (spec section 4.3, role to
 * module access matrix). The catalogue derives screen access from the UI design; this table adds
 * the actions a role performs. Each module adds its rows when it is built.
 */
export const ROLE_GRANTS = Object.freeze({
  admin: [
    'settings:branch:*',
    'settings:department:*',
    'settings:master:*',
    'settings:user:*',
    'settings:role:*',
    'settings:hospital:*',
    'settings:approval:read',
    'patients:*',
    'audit:log:read',
    'approvals:patients-merge:l1',
    'approvals:inventory-po:l1',
    'approvals:facility-condemn:l1',
  ],
  medsupt: ['patients:patient:read', 'approvals:ipd-discharge-dues:l1', 'approvals:mrd-release:l1'],
  doctor: ['patients:patient:read', 'patients:patient:update'],
  hod: ['patients:patient:read', 'approvals:inventory-po:l1', 'approvals:finance-expense:l1'],
  clinic: ['patients:*', 'billing:*', 'settings:master:*'],
  nurse: ['patients:patient:read'],
  wardincharge: ['patients:patient:read'],
  frontoffice: [
    'patients:patient:create',
    'patients:patient:update',
    'patients:patient:read',
    'patients:merge:request',
  ],
  cashier: [
    'patients:patient:read',
    'patients:patient:create',
    'billing:bill:read',
    'billing:bill:create',
    'billing:bill:finalize',
    'billing:bill:print',
    'billing:payment:create',
    'billing:payment:read',
    'billing:deposit:create',
    'billing:deposit:read',
    'billing:discount:request',
    'billing:cancel:request',
    'billing:refund:pay',
    'billing:refund:read',
    'billing:shift:open',
    'billing:shift:close',
    'billing:shift:read',
  ],
  billingmgr: [
    'patients:patient:read',
    'billing:*',
    'approvals:billing-discount:l1',
    'approvals:billing-refund:l1',
  ],
  tpa: ['patients:patient:read'],
  lab: [
    'patients:patient:read',
    'approvals:lab-result-release:l1',
    'approvals:lab-report-amend:l1',
  ],
  phlebotomist: ['patients:patient:read'],
  radiology: ['patients:patient:read', 'approvals:rad-report-signoff:l1'],
  pharmacy: ['patients:patient:read', 'approvals:inventory-stock-adjust:l1'],
  store: ['approvals:inventory-grn-variance:l1'],
  hr: ['approvals:hr-salary:l1', 'approvals:payroll-release:l1'],
  accounts: [
    'approvals:billing-refund:l2',
    'approvals:payroll-release:l2',
    'approvals:finance-journal:l1',
    'approvals:inventory-stock-adjust:l2',
    'approvals:finance-expense:l2',
  ],
  auditor: ['audit:log:read', 'audit:log:export', 'approvals:inbox:read-all'],
  mrd: ['patients:patient:read'],
  quality: ['approvals:quality-incident:l1'],
  crm: ['patients:patient:read'],
});

/**
 * Menu-derived permissions that are too broad for a role and are replaced by its grants:
 * the cashier opens the Billing screens but must not verify shifts.
 */
export const ROLE_REVOKE = Object.freeze({
  cashier: ['billing:*', 'billing:ip:*', 'billing:shift:*'],
});

/** Role codes that count as privileged: creating such a user needs Super Admin approval. */
export const PRIVILEGED_ROLES = Object.freeze([
  'superadmin',
  'admin',
  'billingmgr',
  'accounts',
  'hr',
  'payroll',
]);

/** Default permissions of a system role: menu-derived permissions plus explicit grants. */
export function systemRolePermissions(panel) {
  const revoke = new Set(ROLE_REVOKE[panel] ?? []);
  const base = (PANELS[panel]?.permissions ?? []).filter((k) => !revoke.has(k));
  return [...new Set([...base, ...(ROLE_GRANTS[panel] ?? [])])].sort();
}

/** Default concurrent sessions per role (spec 4.4): doctors 2 devices, cashiers 1. */
export const MAX_SESSIONS = Object.freeze({ doctor: 2, cashier: 1 });
