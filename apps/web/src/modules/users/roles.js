import { PRIVILEGED_ROLES, hasPermission } from '@hms/shared';

/** Admin, Billing Manager, Accounts, HR, Payroll, Super Admin (or a copy of one) need approval. */
export const isPrivileged = (role) =>
  Boolean(role) &&
  (PRIVILEGED_ROLES.includes(role.code) || PRIVILEGED_ROLES.includes(role.clonedFrom));

/** Permission heads a custom role must not get from the editor (platform staff only). */
const HIDDEN_HEADS = new Set(['platform']);

/**
 * The editor's view of the permission catalogue: per module, its keys and the whole-module
 * wildcards (`lab:*`) offered as toggles. Approval levels never get a wildcard toggle.
 */
export function editorGroups(catalog = []) {
  return catalog
    .map((g) => {
      const keys = g.permissions.filter((k) => !HIDDEN_HEADS.has(k.split(':')[0]) && k !== '*');
      const heads = [...new Set(keys.map((k) => k.split(':')[0]))].filter((h) => h !== 'approvals');
      return {
        ...g,
        keys: keys.filter((k) => !k.endsWith(':*') || k.split(':').length > 2),
        heads,
      };
    })
    .filter((g) => g.keys.length || g.heads.length);
}

/** True when `key` is granted by the selection, directly or through a wildcard. */
export const covers = (selected, key) => hasPermission(selected, key);

/** Added and removed keys between two permission lists. */
export function permissionDiff(before = [], after = []) {
  return {
    added: after.filter((p) => !before.includes(p)).sort(),
    removed: before.filter((p) => !after.includes(p)).sort(),
  };
}
