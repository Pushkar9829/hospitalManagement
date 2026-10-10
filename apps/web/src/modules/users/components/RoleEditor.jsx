import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Copy, Minus, Plus } from 'lucide-react';
import { roleInput } from '@hms/shared/schemas';
import { translateValidation } from '@hms/i18n';
import {
  Banner,
  Button,
  Card,
  ConfirmDialog,
  Dialog,
  FormField,
  Input,
  Select,
  Textarea,
} from '@hms/ui';
import { apiError } from '../../../app/apiError.js';
import { useCan } from '../../../lib/useCan.js';
import { ApiErrorNotice } from '../../../components/ApiErrorNotice.jsx';
import { Status } from '../../../components/Status.jsx';
import { useDeactivateRoleMutation, useSaveRoleMutation } from '../api.js';
import { permissionDiff } from '../roles.js';
import { PermissionList, PermissionPicker } from './PermissionPicker.jsx';

const SCOPES = ['own', 'ward', 'department', 'branch', 'all'];

function DiffList({ diff }) {
  const { t } = useTranslation();
  if (!diff.added.length && !diff.removed.length)
    return <p className="text-sm text-muted">{t('roles.noPermissionChange')}</p>;
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <section>
        <h3 className="mb-1 text-sm font-semibold text-success">
          {t('roles.added', { count: diff.added.length })}
        </h3>
        <ul className="flex flex-col gap-0.5">
          {diff.added.map((k) => (
            <li key={k} className="flex items-center gap-1.5 font-mono text-sm text-ink">
              <Plus size={12} aria-hidden="true" className="text-success" />
              <span className="sr-only">{t('roles.addedOne')}</span>
              {k}
            </li>
          ))}
        </ul>
      </section>
      <section>
        <h3 className="mb-1 text-sm font-semibold text-critical">
          {t('roles.removed', { count: diff.removed.length })}
        </h3>
        <ul className="flex flex-col gap-0.5">
          {diff.removed.map((k) => (
            <li key={k} className="flex items-center gap-1.5 font-mono text-sm text-ink">
              <Minus size={12} aria-hidden="true" className="text-critical" />
              <span className="sr-only">{t('roles.removedOne')}</span>
              {k}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

const initial = (role, base) =>
  role
    ? {
        code: role.code,
        name: role.name,
        clonedFrom: role.clonedFrom ?? '',
        scope: role.scope ?? 'branch',
        maxSessions: role.maxSessions ?? '',
        permissions:
          role.status === 'PENDING_APPROVAL' && role.pendingPermissions
            ? role.pendingPermissions
            : role.permissions,
      }
    : {
        code: '',
        name: base ? `${base.name} (custom)` : '',
        clonedFrom: base?.code ?? '',
        scope: base?.scope ?? 'branch',
        maxSessions: '',
        permissions: (base?.permissions ?? []).filter((p) => p !== '*'),
      };

/**
 * One role. System roles are read-only with "Copy into a custom role"; a custom role edits its
 * name, data scope, session limit and permissions. Permission changes show an added/removed
 * review and go to the Super Admin (202) before they apply.
 */
export function RoleEditor({ role, base, systemRoles, catalog, onCopy, onDone, onReload }) {
  const { t } = useTranslation();
  const can = useCan();
  const isNew = !role;
  const readOnly =
    role?.isSystem ||
    role?.status === 'INACTIVE' ||
    !can(isNew ? 'settings:role:create' : 'settings:role:update');
  const [v, setV] = useState(() => initial(role, base));
  const [errors, setErrors] = useState({});
  const [review, setReview] = useState(false);
  const [reason, setReason] = useState('');
  const [failure, setFailure] = useState(null);
  const [deactivating, setDeactivating] = useState(false);
  const [save, { isLoading: saving }] = useSaveRoleMutation();
  const [deactivate] = useDeactivateRoleMutation();
  const pendingPerms =
    role?.status === 'PENDING_APPROVAL' ||
    Boolean(role?.pendingPermissions?.length && role.status === 'ACTIVE');
  const reference = isNew
    ? (systemRoles.find((r) => r.code === v.clonedFrom)?.permissions ?? [])
    : role.permissions;
  const diff = permissionDiff(reference, v.permissions);
  const set = (k) => (e) => setV((s) => ({ ...s, [k]: e.target.value }));

  const changeBase = (code) => {
    const b = systemRoles.find((r) => r.code === code);
    setV((s) => ({
      ...s,
      clonedFrom: code,
      permissions: (b?.permissions ?? []).filter((p) => p !== '*'),
      scope: b?.scope ?? s.scope,
    }));
  };

  const body = () => ({
    ...(isNew ? { code: v.code.trim(), clonedFrom: v.clonedFrom } : {}),
    name: v.name.trim(),
    permissions: [...new Set(v.permissions)].sort(),
    scope: v.scope,
    maxSessions: v.maxSessions === '' ? null : Number(v.maxSessions),
  });

  const check = () => {
    const parsed = roleInput.safeParse({ code: 'xx', clonedFrom: 'xx', ...body() });
    const errs = {};
    if (!parsed.success)
      for (const i of parsed.error.issues) errs[i.path[0]] ??= translateValidation(t, i.message);
    if (isNew && !/^[a-z][a-z0-9_-]{1,40}$/.test(v.code.trim())) errs.code = t('roles.codeError');
    if (isNew && !v.clonedFrom) errs.clonedFrom = t('roles.baseError');
    if (!v.permissions.length) errs.permissions = t('roles.permissionsError');
    setErrors(errs);
    return !Object.keys(errs).length;
  };

  const submit = async () => {
    setFailure(null);
    try {
      const res = await save({
        ...(isNew ? {} : { id: role.id, version: role.version }),
        ...body(),
        ...(reason.trim() ? { reason: reason.trim() } : {}),
      }).unwrap();
      setReview(false);
      onDone({
        name: v.name,
        approvalId: res?.approvalId ?? null,
        created: isNew,
        id: res?.role?.id,
      });
    } catch (err) {
      setReview(false);
      setFailure(apiError(err));
    }
  };

  const confirmDeactivate = async () => {
    setFailure(null);
    try {
      await deactivate({ id: role.id, version: role.version }).unwrap();
      onDone({ name: role.name, deactivated: true });
    } catch (err) {
      setFailure(apiError(err));
    }
  };

  const baseName = systemRoles.find((r) => r.code === (role?.clonedFrom ?? v.clonedFrom))?.name;
  return (
    <Card padding={false} aria-labelledby="role-title" className="min-w-0">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-4 py-3">
        <div className="min-w-0">
          <h2 id="role-title" className="text-md font-semibold text-ink">
            {isNew ? t('roles.newTitle') : role.name}
          </h2>
          <p className="text-sm text-muted">
            {role?.isSystem
              ? t('roles.systemHint')
              : baseName
                ? t('roles.customHint', { base: baseName })
                : t('roles.customHintNoBase')}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {role && <Status kind="role" code={role.status} />}
          {role?.isSystem && role.code !== 'superadmin' && can('settings:role:create') && (
            <Button
              variant="secondary"
              icon={<Copy size={16} aria-hidden="true" />}
              onClick={() => onCopy(role)}
            >
              {t('roles.copy')}
            </Button>
          )}
          {role && !role.isSystem && role.status === 'ACTIVE' && can('settings:role:update') && (
            <Button variant="ghost" className="text-critical" onClick={() => setDeactivating(true)}>
              {t('roles.deactivate')}
            </Button>
          )}
          {!readOnly && (
            <Button onClick={() => check() && setReview(true)}>
              {diff.added.length || diff.removed.length || isNew
                ? t('roles.review')
                : t('common.save')}
            </Button>
          )}
        </div>
      </div>
      <div className="flex flex-col gap-4 px-4 py-4">
        <ApiErrorNotice
          error={failure}
          onReload={async () => (setFailure(null), await onReload())}
        />
        {pendingPerms && role?.pendingPermissions && (
          <Banner tone="warning" title={t('roles.pendingTitle')}>
            <DiffList diff={permissionDiff(role.permissions, role.pendingPermissions)} />
          </Banner>
        )}
        {role?.status === 'INACTIVE' && <Banner tone="neutral">{t('roles.inactive')}</Banner>}
        <fieldset disabled={readOnly} className="grid min-w-0 grid-cols-1 gap-4 md:grid-cols-2">
          <FormField label={t('roles.name')} error={errors.name} required>
            <Input value={v.name} onChange={set('name')} />
          </FormField>
          <FormField
            label={t('roles.code')}
            hint={isNew ? t('roles.codeHint') : undefined}
            error={errors.code}
            required
          >
            <Input mono value={v.code} onChange={set('code')} readOnly={!isNew} />
          </FormField>
          {isNew && (
            <FormField
              label={t('roles.base')}
              hint={t('roles.baseHint')}
              error={errors.clonedFrom}
              required
            >
              <Select
                value={v.clonedFrom}
                onChange={(e) => changeBase(e.target.value)}
                placeholder={t('roles.chooseBase')}
                options={systemRoles
                  .filter((r) => r.code !== 'superadmin')
                  .map((r) => ({ value: r.code, label: r.name }))}
              />
            </FormField>
          )}
          <FormField
            label={t('roles.maxSessions')}
            hint={t('roles.maxSessionsHint')}
            error={errors.maxSessions}
            optional
          >
            <Input
              type="number"
              min={1}
              max={10}
              className="max-w-28"
              value={v.maxSessions}
              onChange={set('maxSessions')}
            />
          </FormField>
          <fieldset className="md:col-span-2">
            <legend className="text-sm font-semibold text-ink">{t('roles.scope')}</legend>
            <div className="flex flex-wrap gap-x-5">
              {SCOPES.map((s) => (
                <label
                  key={s}
                  className="flex min-h-tap cursor-pointer items-center gap-2 text-base text-ink"
                >
                  <input
                    type="radio"
                    name="role-scope"
                    value={s}
                    checked={v.scope === s}
                    onChange={() => setV((x) => ({ ...x, scope: s }))}
                    className="size-4 accent-primary"
                  />
                  {t(`roles.scopes.${s}`)}
                </label>
              ))}
            </div>
          </fieldset>
        </fieldset>
        <section aria-labelledby="perm-title" className="flex flex-col gap-2">
          <h3 id="perm-title" className="text-sm font-semibold text-ink">
            {t('roles.permissions', { count: v.permissions.length })}
          </h3>
          {readOnly ? (
            <PermissionList value={v.permissions} />
          ) : (
            <PermissionPicker
              catalog={catalog}
              value={v.permissions}
              onChange={(permissions) => setV((s) => ({ ...s, permissions }))}
              disabled={!isNew && role.status === 'PENDING_APPROVAL'}
              error={errors.permissions}
            />
          )}
        </section>
      </div>
      <Dialog
        open={review}
        onOpenChange={setReview}
        size="lg"
        title={t('roles.reviewTitle', { name: v.name })}
        description={diff.added.length || diff.removed.length ? t('roles.reviewBody') : undefined}
        footer={
          <>
            <Button variant="secondary" onClick={() => setReview(false)}>
              {t('common.back')}
            </Button>
            <Button onClick={submit} loading={saving}>
              {diff.added.length || diff.removed.length || isNew
                ? t('roles.submitForApproval')
                : t('common.save')}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <DiffList diff={diff} />
          <FormField
            label={t('approvalNotice.reason')}
            hint={t('approvalNotice.reasonHint')}
            optional
          >
            <Textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
          </FormField>
        </div>
      </Dialog>
      <ConfirmDialog
        open={deactivating}
        onOpenChange={setDeactivating}
        title={t('roles.deactivateTitle', { name: role?.name ?? '' })}
        description={t('roles.deactivateBody')}
        confirmLabel={t('roles.deactivate')}
        requireReason={null}
        onConfirm={confirmDeactivate}
      />
    </Card>
  );
}
