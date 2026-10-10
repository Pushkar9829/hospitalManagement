import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import { DEPARTMENT_TYPES, departmentInput, objectId } from '@hms/shared/schemas';
import { translateValidation } from '@hms/i18n';
import {
  Banner,
  Button,
  Checkbox,
  ConfirmDialog,
  FormField,
  Input,
  Select,
  Sheet,
  Textarea,
  usePageAction,
} from '@hms/ui';
import { apiError } from '../../../app/apiError.js';
import { applyFieldErrors } from '../../../lib/forms.js';
import { useCan } from '../../../lib/useCan.js';
import { ApiErrorNotice } from '../../../components/ApiErrorNotice.jsx';
import { PendingApprovalNotice } from '../../../components/PendingApprovalNotice.jsx';
import { Status } from '../../../components/Status.jsx';
import {
  useBranchesQuery,
  useCloseDepartmentMutation,
  useCreateDepartmentMutation,
  useDepartmentsQuery,
  useStaffOptionsQuery,
  useSubmitDepartmentMutation,
  useUpdateDepartmentMutation,
} from '../api.js';
import { OpdTimingsEditor } from './OpdTimingsEditor.jsx';

const optionalId = z.union([objectId, z.literal('')]).optional();
/** The form: empty selects mean "none", plus a note for the approver. */
const schema = departmentInput.extend({
  parentId: optionalId,
  hodUserId: optionalId,
  reason: z.string().trim().max(500).optional(),
});

const FIELDS = [
  'code',
  'name',
  'type',
  'parentId',
  'hodUserId',
  'location',
  'services',
  'costCentre',
  'opdTimings',
  'reason',
];

const SERVICES = ['opd', 'ipd', 'procedures', 'diagnostics'];

const toDepartmentForm = (d, defaultBranchId) => ({
  code: d?.code ?? '',
  name: d?.name ?? '',
  type: d?.type ?? 'CLINICAL',
  parentId: d?.parentId ?? '',
  hodUserId: d?.hodUserId ?? '',
  location: {
    branchId: d?.location?.branchId ?? defaultBranchId ?? '',
    building: d?.location?.building ?? '',
    floor: d?.location?.floor ?? '',
    rooms: d?.location?.rooms ?? '',
  },
  services: {
    opd: d?.services?.opd ?? false,
    ipd: d?.services?.ipd ?? false,
    procedures: d?.services?.procedures ?? false,
    diagnostics: d?.services?.diagnostics ?? false,
  },
  costCentre: d?.costCentre ?? '',
  opdTimings: (d?.opdTimings ?? []).map(({ day, from, to }) => ({ day, from, to })),
  reason: '',
});

/** Form values → API body: drops the "none" selects and the approver note. */
function toBody({ reason: _r, parentId, hodUserId, ...v }) {
  return { ...v, ...(parentId ? { parentId } : {}), ...(hodUserId ? { hodUserId } : {}) };
}

/**
 * Register or edit a department (spec 5.2). New departments go to the Super Admin (202); a
 * draft can be resubmitted after a rejection; an active one can be closed with a reason (409
 * lists what still uses it). The code is fixed once approved.
 */
export function DepartmentSheet({
  department,
  open,
  onOpenChange,
  onResult,
  onReload,
  defaultBranchId,
}) {
  const { t } = useTranslation();
  const can = useCan();
  const isNew = !department;
  const status = department?.status;
  const canWrite = isNew ? can('settings:department:create') : can('settings:department:update');
  const editable = canWrite && status !== 'INACTIVE';
  const { data: branches = [] } = useBranchesQuery();
  const { data: parents } = useDepartmentsQuery({ status: 'ACTIVE', limit: 100 });
  const { data: staff, isError: noStaff } = useStaffOptionsQuery(undefined, {
    skip: !can('settings:user:read'),
  });
  const [create] = useCreateDepartmentMutation();
  const [update] = useUpdateDepartmentMutation();
  const [submitAgain, { isLoading: submitting }] = useSubmitDepartmentMutation();
  const [closeDept] = useCloseDepartmentMutation();
  const [failure, setFailure] = useState(null);
  const [closing, setClosing] = useState(false);

  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: toDepartmentForm(department, defaultBranchId),
  });
  const {
    register,
    control,
    handleSubmit,
    reset,
    watch,
    setError,
    formState: { errors, isSubmitting, isDirty },
  } = form;

  useEffect(() => {
    reset(toDepartmentForm(department, defaultBranchId), { keepDirtyValues: true });
  }, [department, defaultBranchId, reset]);

  const onSubmit = async (values) => {
    setFailure(null);
    try {
      if (isNew) {
        const reason = values.reason?.trim();
        const res = await create({ ...toBody(values), ...(reason ? { reason } : {}) }).unwrap();
        onResult({
          kind: 'created',
          name: values.name,
          code: values.code,
          approvalId: res?.approvalId,
        });
        onOpenChange(false);
      } else {
        await update({
          id: department.id,
          ...toBody(values),
          version: department.version,
        }).unwrap();
        onResult({ kind: 'saved', name: values.name });
        reset(values);
      }
    } catch (err) {
      setFailure(applyFieldErrors(err, setError, FIELDS));
    }
  };
  const submit = handleSubmit(onSubmit);
  usePageAction('save', submit, { enabled: open && editable });

  const resubmit = async () => {
    setFailure(null);
    try {
      const res = await submitAgain({ id: department.id, version: department.version }).unwrap();
      onResult({ kind: 'submitted', name: department.name, approvalId: res?.approvalId });
      onOpenChange(false);
    } catch (err) {
      setFailure(apiError(err));
    }
  };

  const confirmClose = async (reason) => {
    setFailure(null);
    try {
      const res = await closeDept({
        id: department.id,
        version: department.version,
        reason,
      }).unwrap();
      onResult({ kind: 'closing', name: department.name, approvalId: res?.approvalId });
      onOpenChange(false);
    } catch (err) {
      setFailure(apiError(err));
    }
  };

  const msg = (e) => translateValidation(t, e?.message);
  const opd = watch('services.opd');
  const parentOptions = (parents?.items ?? [])
    .filter((d) => d.id !== department?.id)
    .map((d) => ({ value: d.id, label: `${d.name} (${d.code})` }));
  const branchOptions = branches
    .filter((b) => b.status === 'ACTIVE' || b.id === department?.location?.branchId)
    .map((b) => ({ value: b.id, label: b.name }));
  const formId = 'department-form';
  const waiting = status === 'PENDING_APPROVAL' || status === 'CLOSING';

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      size="lg"
      title={
        isNew
          ? t('departments.registerTitle')
          : t('departments.editTitle', { name: department.name })
      }
      description={isNew ? t('departments.registerHint') : undefined}
      footer={
        <>
          {!isNew && status === 'ACTIVE' && can('settings:department:update') && (
            <Button variant="danger" className="mr-auto" onClick={() => setClosing(true)}>
              {t('departments.close')}
            </Button>
          )}
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          {!isNew && status === 'DRAFT' && can('settings:department:create') && (
            <Button variant="secondary" onClick={resubmit} loading={submitting} disabled={isDirty}>
              {t('departments.resubmit')}
            </Button>
          )}
          {editable && (
            <Button
              type="submit"
              form={formId}
              loading={isSubmitting}
              disabled={!isNew && !isDirty}
            >
              {isNew ? t('departments.submitForApproval') : t('settings.saveChanges')}
            </Button>
          )}
        </>
      }
    >
      <form id={formId} onSubmit={submit} noValidate className="flex flex-col gap-4">
        {!isNew && (
          <div className="flex flex-wrap items-center gap-2">
            <Status kind="department" code={status} />
            {status === 'DRAFT' && isDirty && (
              <span className="text-sm text-muted">{t('departments.saveBeforeSubmit')}</span>
            )}
          </div>
        )}
        {waiting && (
          <PendingApprovalNotice approvalId={department.approvalId}>
            {status === 'CLOSING'
              ? t('departments.closingWaiting')
              : t('departments.createWaiting')}
          </PendingApprovalNotice>
        )}
        {status === 'INACTIVE' && <Banner tone="neutral">{t('departments.inactive')}</Banner>}
        <ApiErrorNotice
          error={failure}
          onReload={async () => {
            setFailure(null);
            await onReload?.();
          }}
        />
        <fieldset disabled={!editable} className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField
            label={t('departments.code')}
            hint={
              isNew || status === 'DRAFT' ? t('departments.codeHint') : t('departments.codeLocked')
            }
            error={msg(errors.code)}
            required
          >
            <Input
              mono
              maxLength={8}
              className="uppercase"
              readOnly={!isNew && status !== 'DRAFT'}
              {...register('code')}
            />
          </FormField>
          <FormField label={t('departments.name')} error={msg(errors.name)} required>
            <Input {...register('name')} />
          </FormField>
          <FormField label={t('departments.type')} error={msg(errors.type)} required>
            <Select
              options={Object.keys(DEPARTMENT_TYPES).map((k) => ({
                value: k,
                label: t(`departments.types.${k}`),
              }))}
              {...register('type')}
            />
          </FormField>
          <FormField label={t('departments.parent')} error={msg(errors.parentId)} optional>
            <Select
              placeholder={t('departments.parentNone')}
              options={parentOptions}
              {...register('parentId')}
            />
          </FormField>
          {can('settings:user:read') && !noStaff && (
            <FormField
              label={t('departments.hod')}
              error={msg(errors.hodUserId)}
              optional
              className="sm:col-span-2"
            >
              <Select
                placeholder={t('departments.hodNone')}
                options={(staff?.items ?? []).map((u) => ({
                  value: u.id,
                  label: u.designation ? `${u.name} · ${u.designation}` : u.name,
                }))}
                {...register('hodUserId')}
              />
            </FormField>
          )}
          <FormField
            label={t('departments.branch')}
            error={msg(errors.location?.branchId)}
            required
          >
            <Select
              placeholder={t('departments.chooseBranch')}
              options={branchOptions}
              {...register('location.branchId')}
            />
          </FormField>
          <FormField
            label={t('departments.building')}
            error={msg(errors.location?.building)}
            optional
          >
            <Input {...register('location.building')} />
          </FormField>
          <FormField label={t('departments.floor')} error={msg(errors.location?.floor)} optional>
            <Input {...register('location.floor')} />
          </FormField>
          <FormField label={t('departments.rooms')} error={msg(errors.location?.rooms)} optional>
            <Input {...register('location.rooms')} />
          </FormField>
          <fieldset className="sm:col-span-2">
            <legend className="text-sm font-semibold text-ink">{t('departments.services')}</legend>
            <div className="grid grid-cols-2 gap-x-4 sm:grid-cols-4">
              {SERVICES.map((s) => (
                <Checkbox
                  key={s}
                  label={t(`departments.serviceNames.${s}`)}
                  {...register(`services.${s}`)}
                />
              ))}
            </div>
          </fieldset>
          <FormField label={t('departments.costCentre')} error={msg(errors.costCentre)} optional>
            <Input mono {...register('costCentre')} />
          </FormField>
          <fieldset className="min-w-0 sm:col-span-2">
            <legend className="text-sm font-semibold text-ink">{t('departments.timings')}</legend>
            {opd ? (
              <Controller
                control={control}
                name="opdTimings"
                render={({ field }) => (
                  <OpdTimingsEditor
                    value={field.value}
                    onChange={field.onChange}
                    errors={errors.opdTimings}
                    disabled={!editable}
                  />
                )}
              />
            ) : (
              <p className="text-sm text-muted">{t('departments.timingsNeedOpd')}</p>
            )}
          </fieldset>
          {isNew && (
            <FormField
              label={t('approvalNotice.reason')}
              hint={t('approvalNotice.reasonHint')}
              error={msg(errors.reason)}
              optional
              className="sm:col-span-2"
            >
              <Textarea rows={2} {...register('reason')} />
            </FormField>
          )}
        </fieldset>
        {isNew && <Banner tone="warning">{t('departments.approvalNote')}</Banner>}
      </form>
      <ConfirmDialog
        open={closing}
        onOpenChange={setClosing}
        title={t('departments.closeTitle', { name: department?.name ?? '' })}
        description={t('departments.closeBody')}
        confirmLabel={t('departments.closeConfirm')}
        onConfirm={confirmClose}
      />
    </Sheet>
  );
}
