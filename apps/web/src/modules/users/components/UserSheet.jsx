import { useEffect, useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { LANGUAGES } from '@hms/shared';
import { userCreateInput, userUpdateInput } from '@hms/shared/schemas';
import { translateValidation } from '@hms/i18n';
import { Banner, Button, FormField, Input, Select, Sheet, StatusBadge, Textarea } from '@hms/ui';
import { applyFieldErrors, cleanResolver } from '../../../lib/forms.js';
import { useCan } from '../../../lib/useCan.js';
import { ApiErrorNotice } from '../../../components/ApiErrorNotice.jsx';
import { PasswordRules } from '../../../components/PasswordRules.jsx';
import { Status } from '../../../components/Status.jsx';
import { useBranchesQuery, useDepartmentsQuery } from '../../setup/api.js';
import { useRolesQuery, useSaveUserMutation } from '../api.js';
import { generatePassword } from '../password.js';
import { isPrivileged } from '../roles.js';
import { CheckboxList } from '../../../components/CheckboxList.jsx';

const FIELDS = [
  'name',
  'username',
  'mobile',
  'email',
  'designation',
  'roleCodes',
  'branchIds',
  'defaultBranchId',
  'departmentIds',
  'preferredLanguage',
  'onboarding',
  'reason',
];

const toForm = (u) => ({
  name: u?.name ?? '',
  ...(u ? { version: u.version } : { username: '' }),
  mobile: u?.mobile ?? '',
  email: u?.email ?? '',
  designation: u?.designation ?? '',
  roleCodes: u?.roles?.map((r) => r.code) ?? [],
  branchIds: u?.branchIds ?? [],
  defaultBranchId: u?.defaultBranchId ?? '',
  departmentIds: u?.departmentIds ?? [],
  preferredLanguage: u?.preferredLanguage ?? 'en',
  ...(u ? {} : { onboarding: { mode: 'TEMP_PASSWORD', temporaryPassword: '' } }),
  reason: '',
});

/**
 * New login or edit (spec 4.4): name, contact, roles, branches, departments, language, and for
 * a new login an SMS invitation or a temporary password. A privileged role (Admin, Billing
 * Manager, …) waits for Super Admin approval (202); on edit the current roles stay until then.
 */
export function UserSheet({ user, open, onOpenChange, onDone, onReload }) {
  const { t } = useTranslation();
  const can = useCan();
  const isNew = !user;
  const canWrite = isNew ? can('settings:user:create') : can('settings:user:update');
  const { data: roles = [] } = useRolesQuery();
  const { data: branches = [] } = useBranchesQuery();
  const { data: depts } = useDepartmentsQuery({ status: 'ACTIVE', limit: 100 });
  const [save] = useSaveUserMutation();
  const [failure, setFailure] = useState(null);
  const schema = isNew ? userCreateInput : userUpdateInput;
  const form = useForm({ resolver: cleanResolver(schema), defaultValues: toForm(user) });
  const {
    register,
    handleSubmit,
    reset,
    watch,
    control,
    setValue,
    setError,
    formState: { errors, isSubmitting },
  } = form;

  useEffect(() => {
    reset(toForm(user), { keepDirtyValues: true });
  }, [user, reset]);

  const roleCodes = watch('roleCodes') ?? [];
  const branchIds = watch('branchIds') ?? [];
  const mode = watch('onboarding.mode');
  const temp = watch('onboarding.temporaryPassword') ?? '';
  const activeRoles = roles.filter((r) => r.status === 'ACTIVE' || roleCodes.includes(r.code));
  const roleByCode = useMemo(() => new Map(roles.map((r) => [r.code, r])), [roles]);
  const current = new Set(user?.roles?.map((r) => r.code) ?? []);
  const needsApproval = roleCodes.filter((c) => !current.has(c) && isPrivileged(roleByCode.get(c)));

  const onSubmit = async ({ reason, ...values }) => {
    setFailure(null);
    const note = reason?.trim();
    try {
      const res = await save({
        ...(user ? { id: user.id } : {}),
        ...values,
        ...(note ? { reason: note } : {}),
      }).unwrap();
      onDone({ name: values.name, approvalId: res?.approvalId ?? null, created: isNew, mode });
      onOpenChange(false);
    } catch (err) {
      setFailure(applyFieldErrors(err, setError, FIELDS));
    }
  };
  const msg = (e) => translateValidation(t, e?.message);
  const formId = 'user-form';

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      size="lg"
      title={isNew ? t('users.addTitle') : t('users.editTitle', { name: user.name })}
      description={isNew ? t('users.addHint') : undefined}
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          {canWrite && (
            <Button type="submit" form={formId} loading={isSubmitting}>
              {needsApproval.length
                ? t('users.submitForApproval')
                : isNew
                  ? t('users.create')
                  : t('common.save')}
            </Button>
          )}
        </>
      }
    >
      <form
        id={formId}
        onSubmit={handleSubmit(onSubmit)}
        noValidate
        className="flex flex-col gap-4"
      >
        {user && (
          <div className="flex flex-wrap items-center gap-2">
            <Status kind="user" code={user.status} />
            {user.pendingRoleCodes?.length > 0 && (
              <StatusBadge
                tone="warning"
                label={t('users.pendingRoles', {
                  roles: user.pendingRoleCodes.map((c) => roleByCode.get(c)?.name ?? c).join(', '),
                })}
              />
            )}
          </div>
        )}
        <ApiErrorNotice
          error={failure}
          onReload={async () => {
            setFailure(null);
            await onReload();
          }}
        />
        <fieldset disabled={!canWrite} className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField label={t('users.name')} error={msg(errors.name)} required>
            <Input autoComplete="off" {...register('name')} />
          </FormField>
          {isNew ? (
            <FormField
              label={t('users.username')}
              hint={t('users.usernameHint')}
              error={msg(errors.username)}
              required
            >
              <Input
                mono
                autoCapitalize="none"
                spellCheck={false}
                autoComplete="off"
                {...register('username')}
              />
            </FormField>
          ) : (
            <FormField label={t('users.username')} hint={t('users.usernameLocked')}>
              <Input mono value={user.username} readOnly />
            </FormField>
          )}
          <FormField
            label={t('users.mobile')}
            hint={mode === 'INVITE' ? t('users.mobileInvite') : undefined}
            error={msg(errors.mobile)}
            required={mode === 'INVITE'}
            optional={mode !== 'INVITE'}
          >
            <Input type="tel" inputMode="numeric" mono {...register('mobile')} />
          </FormField>
          <FormField label={t('users.email')} error={msg(errors.email)} optional>
            <Input type="email" {...register('email')} />
          </FormField>
          <FormField label={t('users.designation')} error={msg(errors.designation)} optional>
            <Input {...register('designation')} />
          </FormField>
          <FormField label={t('users.language')} error={msg(errors.preferredLanguage)}>
            <Select
              options={Object.entries(LANGUAGES).map(([value, label]) => ({ value, label }))}
              {...register('preferredLanguage')}
            />
          </FormField>
          <Controller
            control={control}
            name="roleCodes"
            render={({ field }) => (
              <CheckboxList
                className="sm:col-span-2"
                legend={t('users.roles')}
                hint={t('users.rolesHint')}
                error={msg(errors.roleCodes)}
                required
                value={field.value}
                onChange={field.onChange}
                options={activeRoles.map((r) => ({
                  value: r.code,
                  label: (
                    <span className="inline-flex flex-wrap items-center gap-1.5">
                      {r.name}
                      {isPrivileged(r) && (
                        <StatusBadge tone="warning" label={t('users.privileged')} />
                      )}
                    </span>
                  ),
                }))}
              />
            )}
          />
          {needsApproval.length > 0 && (
            <Banner tone="warning" className="sm:col-span-2">
              {t(isNew ? 'users.privilegedNew' : 'users.privilegedEdit', {
                roles: needsApproval.map((c) => roleByCode.get(c)?.name ?? c).join(', '),
              })}
            </Banner>
          )}
          <Controller
            control={control}
            name="branchIds"
            render={({ field }) => (
              <CheckboxList
                className="sm:col-span-2"
                legend={t('users.branches')}
                error={msg(errors.branchIds)}
                required
                value={field.value}
                onChange={field.onChange}
                options={branches
                  .filter((b) => b.status === 'ACTIVE' || field.value.includes(b.id))
                  .map((b) => ({ value: b.id, label: b.name }))}
              />
            )}
          />
          <FormField label={t('users.defaultBranch')} error={msg(errors.defaultBranchId)} optional>
            <Select
              placeholder={t('users.firstBranch')}
              options={branches
                .filter((b) => branchIds.includes(b.id))
                .map((b) => ({ value: b.id, label: b.name }))}
              {...register('defaultBranchId')}
            />
          </FormField>
          <Controller
            control={control}
            name="departmentIds"
            render={({ field }) => (
              <CheckboxList
                className="sm:col-span-2"
                legend={t('users.departments')}
                hint={depts?.items?.length ? t('users.departmentsHint') : t('users.noDepartments')}
                error={msg(errors.departmentIds)}
                value={field.value}
                onChange={field.onChange}
                options={(depts?.items ?? []).map((d) => ({
                  value: d.id,
                  label: `${d.name} (${d.code})`,
                }))}
              />
            )}
          />
          {isNew && (
            <fieldset className="flex flex-col gap-2 rounded-card border border-line p-3 sm:col-span-2">
              <legend className="px-1 text-sm font-semibold text-ink">
                {t('users.onboarding')}
              </legend>
              {['TEMP_PASSWORD', 'INVITE'].map((m) => (
                <label key={m} className="flex min-h-tap cursor-pointer items-start gap-3">
                  <input
                    type="radio"
                    value={m}
                    className="mt-1 size-4 accent-primary"
                    {...register('onboarding.mode')}
                  />
                  <span>
                    <span className="block text-base text-ink">{t(`users.mode.${m}`)}</span>
                    <span className="block text-sm text-muted">{t(`users.modeHint.${m}`)}</span>
                  </span>
                </label>
              ))}
              {mode === 'TEMP_PASSWORD' && (
                <div className="flex flex-col gap-2">
                  <FormField
                    label={t('users.tempPassword')}
                    error={msg(errors.onboarding?.temporaryPassword)}
                    required
                    labelAction={
                      <button
                        type="button"
                        className="cursor-pointer text-sm text-info underline underline-offset-2"
                        onClick={() =>
                          setValue('onboarding.temporaryPassword', generatePassword(), {
                            shouldValidate: true,
                          })
                        }
                      >
                        {t('users.generate')}
                      </button>
                    }
                  >
                    <Input mono autoComplete="off" {...register('onboarding.temporaryPassword')} />
                  </FormField>
                  <PasswordRules value={temp} />
                  <p className="text-sm text-muted">{t('users.tempHint')}</p>
                </div>
              )}
            </fieldset>
          )}
          <FormField
            label={t('approvalNotice.reason')}
            hint={t('approvalNotice.reasonHint')}
            optional
            className="sm:col-span-2"
          >
            <Textarea rows={2} {...register('reason')} />
          </FormField>
        </fieldset>
      </form>
    </Sheet>
  );
}
