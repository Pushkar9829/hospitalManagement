import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { GitBranch, Plus } from 'lucide-react';
import { z } from 'zod';
import { branchInput, objectId } from '@hms/shared/schemas';
import { translateValidation } from '@hms/i18n';
import {
  Button,
  Card,
  ConfirmDialog,
  DataTable,
  EmptyState,
  ErrorState,
  FormField,
  Input,
  Select,
  Sheet,
  Textarea,
  useToast,
} from '@hms/ui';
import { apiError } from '../../../app/apiError.js';
import { applyFieldErrors } from '../../../lib/forms.js';
import { useCan } from '../../../lib/useCan.js';
import { ApiErrorNotice } from '../../../components/ApiErrorNotice.jsx';
import { PendingApprovalNotice } from '../../../components/PendingApprovalNotice.jsx';
import { Status } from '../../../components/Status.jsx';
import {
  useBranchesQuery,
  useCloseBranchMutation,
  useEntitiesQuery,
  useSaveBranchMutation,
} from '../api.js';

const FIELDS = ['name', 'code', 'entityId', 'address', 'gstin', 'phone', 'email', 'reason'];

const toForm = (b = {}) => ({
  name: b.name ?? '',
  code: b.code ?? '',
  entityId: b.entityId ?? '',
  address: {
    line1: b.address?.line1 ?? '',
    line2: b.address?.line2 ?? '',
    city: b.address?.city ?? '',
    state: b.address?.state ?? '',
    pin: b.address?.pin ?? '',
  },
  gstin: b.gstin ?? '',
  phone: b.phone ?? '',
  email: b.email ?? '',
  reason: '',
});

/** The form: an empty entity select means "none"; a note for the approver on create. */
const schema = branchInput.extend({
  entityId: z.union([objectId, z.literal('')]).optional(),
  reason: z.string().trim().max(500).optional(),
});

function BranchSheet({ branch, open, onOpenChange, onDone, onReload }) {
  const { t } = useTranslation();
  const can = useCan();
  const canEdit = branch ? can('settings:branch:update') : can('settings:branch:create');
  const { data: entities = [] } = useEntitiesQuery();
  const [saveBranch] = useSaveBranchMutation();
  const [failure, setFailure] = useState(null);
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(schema), defaultValues: toForm(branch) });

  useEffect(() => {
    reset(toForm(branch), { keepDirtyValues: true });
  }, [branch, reset]);

  const onSubmit = async ({ reason, entityId, ...values }) => {
    setFailure(null);
    const body = { ...values, ...(entityId ? { entityId } : {}) };
    try {
      const res = await saveBranch(
        branch
          ? { id: branch.id, ...body, version: branch.version }
          : { ...body, ...(reason?.trim() ? { reason: reason.trim() } : {}) },
      ).unwrap();
      onDone({ name: values.name, approvalId: res?.approvalId ?? null, created: !branch });
      onOpenChange(false);
    } catch (err) {
      setFailure(applyFieldErrors(err, setError, FIELDS));
    }
  };
  const msg = (e) => translateValidation(t, e?.message);
  const formId = 'branch-form';
  const codeLocked = branch?.status === 'ACTIVE';

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      size="lg"
      title={
        branch
          ? t('settings.branches.editTitle', { name: branch.name })
          : t('settings.branches.addTitle')
      }
      description={branch ? undefined : t('settings.branches.addHint')}
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          {canEdit && (
            <Button type="submit" form={formId} loading={isSubmitting}>
              {branch ? t('common.save') : t('settings.branches.submit')}
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
        <ApiErrorNotice
          error={failure}
          onReload={async () => {
            setFailure(null);
            await onReload();
          }}
        />
        <fieldset disabled={!canEdit} className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField label={t('settings.branches.name')} error={msg(errors.name)} required>
            <Input {...register('name')} />
          </FormField>
          <FormField
            label={t('settings.branches.code')}
            hint={codeLocked ? t('settings.branches.codeLocked') : t('settings.branches.codeHint')}
            error={msg(errors.code)}
            required
          >
            <Input
              mono
              maxLength={8}
              className="uppercase"
              readOnly={codeLocked}
              {...register('code')}
            />
          </FormField>
          <FormField
            label={t('settings.branches.entity')}
            hint={entities.length ? undefined : t('settings.branches.noEntities')}
            error={msg(errors.entityId)}
            optional
            className="sm:col-span-2"
          >
            <Select
              placeholder={t('settings.branches.entityNone')}
              options={entities.map((e) => ({ value: e.id, label: e.name }))}
              {...register('entityId')}
            />
          </FormField>
          <FormField
            label={t('address.line1')}
            error={msg(errors.address?.line1)}
            optional
            className="sm:col-span-2"
          >
            <Input {...register('address.line1')} />
          </FormField>
          <FormField label={t('address.city')} error={msg(errors.address?.city)} optional>
            <Input {...register('address.city')} />
          </FormField>
          <FormField label={t('address.state')} error={msg(errors.address?.state)} optional>
            <Input {...register('address.state')} />
          </FormField>
          <FormField label={t('address.pin')} error={msg(errors.address?.pin)} optional>
            <Input mono inputMode="numeric" maxLength={6} {...register('address.pin')} />
          </FormField>
          <FormField label="GSTIN" error={msg(errors.gstin)} optional>
            <Input mono maxLength={15} className="uppercase" {...register('gstin')} />
          </FormField>
          <FormField label={t('settings.branches.phone')} error={msg(errors.phone)} optional>
            <Input type="tel" {...register('phone')} />
          </FormField>
          <FormField label={t('settings.branches.email')} error={msg(errors.email)} optional>
            <Input type="email" {...register('email')} />
          </FormField>
          {!branch && (
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
      </form>
    </Sheet>
  );
}

/** Branches with status; open (202, within the plan limit: 402), edit and close (with reason). */
export function BranchesTab() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const can = useCan();
  const { data = [], isLoading, isError, error, refetch } = useBranchesQuery();
  const [closeBranch] = useCloseBranchMutation();
  const [editing, setEditing] = useState(null);
  const [closing, setClosing] = useState(null);
  const [notice, setNotice] = useState(null); // { approvalId, text }
  const [failure, setFailure] = useState(null);
  const branch = editing?.id ? data.find((b) => b.id === editing.id) : null;

  const onDone = ({ name, approvalId, created }) => {
    setFailure(null);
    if (approvalId)
      setNotice({ approvalId, text: t('settings.branches.sentForApproval', { name }) });
    else
      toast({
        title: t(created ? 'settings.branches.opened' : 'settings.branches.saved', { name }),
        tone: 'success',
      });
  };

  const confirmClose = async (reason) => {
    const b = closing;
    setFailure(null);
    try {
      const res = await closeBranch({ id: b.id, version: b.version, reason }).unwrap();
      if (res?.approvalId)
        setNotice({
          approvalId: res.approvalId,
          text: t('settings.branches.closeSent', { name: b.name }),
        });
      else toast({ title: t('settings.branches.closed', { name: b.name }), tone: 'success' });
    } catch (err) {
      setFailure(apiError(err));
    }
  };

  const columns = useMemo(
    () => [
      {
        id: 'code',
        header: t('settings.branches.code'),
        meta: { mono: true },
        cell: ({ row }) => row.original.code,
      },
      {
        id: 'name',
        header: t('settings.branches.name'),
        cell: ({ row }) => <span className="font-semibold">{row.original.name}</span>,
      },
      {
        id: 'city',
        header: t('address.city'),
        cell: ({ row }) => row.original.address?.city ?? '-',
      },
      {
        id: 'gstin',
        header: 'GSTIN',
        meta: { mono: true },
        cell: ({ row }) => row.original.gstin ?? '-',
      },
      {
        id: 'phone',
        header: t('settings.branches.phone'),
        cell: ({ row }) => row.original.phone ?? '-',
      },
      {
        id: 'status',
        header: t('common.status'),
        cell: ({ row }) => <Status kind="branch" code={row.original.status} />,
      },
      {
        id: 'actions',
        header: <span className="sr-only">{t('common.actions')}</span>,
        meta: { align: 'right' },
        cell: ({ row }) => (
          <div className="flex justify-end gap-1">
            <Button
              size="sm"
              variant="ghost"
              onClick={(e) => (e.stopPropagation(), setEditing({ id: row.original.id }))}
            >
              {can('settings:branch:update') ? t('common.edit') : t('common.view')}
              <span className="sr-only"> {row.original.name}</span>
            </Button>
            {row.original.status === 'ACTIVE' && can('settings:branch:update') && (
              <Button
                size="sm"
                variant="ghost"
                className="text-critical"
                onClick={(e) => (e.stopPropagation(), setClosing(row.original))}
              >
                {t('settings.branches.close')}
                <span className="sr-only"> {row.original.name}</span>
              </Button>
            )}
          </div>
        ),
      },
    ],
    [t, can],
  );

  if (isError)
    return (
      <ErrorState
        title={t('settings.loadFailed')}
        requestId={apiError(error)?.requestId}
        onRetry={refetch}
      />
    );

  return (
    <div className="flex flex-col gap-4">
      {notice && (
        <PendingApprovalNotice approvalId={notice.approvalId}>
          {notice.text} {t('approvalNotice.body', { approver: t('approvalNotice.superAdmin') })}
        </PendingApprovalNotice>
      )}
      <ApiErrorNotice error={failure} onReload={() => (setFailure(null), refetch())} />
      <Card
        title={t('settings.branches.title')}
        description={t('settings.branches.description')}
        padding={false}
        actions={
          can('settings:branch:create') && (
            <Button
              icon={<Plus size={16} aria-hidden="true" />}
              onClick={() => setEditing({ id: null })}
            >
              {t('settings.branches.add')}
            </Button>
          )
        }
      >
        <DataTable
          className="[&>div]:rounded-none [&>div]:border-0"
          columns={columns}
          data={data}
          loading={isLoading}
          caption={t('settings.branches.title')}
          onRowClick={(row) => setEditing({ id: row.id })}
          empty={
            <EmptyState
              icon={GitBranch}
              title={t('settings.branches.emptyTitle')}
              bordered={false}
            />
          }
        />
      </Card>
      {editing && (
        <BranchSheet
          key={editing.id ?? 'new'}
          branch={branch}
          open
          onOpenChange={(o) => !o && setEditing(null)}
          onDone={onDone}
          onReload={refetch}
        />
      )}
      <ConfirmDialog
        open={Boolean(closing)}
        onOpenChange={(o) => !o && setClosing(null)}
        title={t('settings.branches.closeTitle', { name: closing?.name ?? '' })}
        description={t('settings.branches.closeBody')}
        confirmLabel={t('settings.branches.closeConfirm')}
        onConfirm={confirmClose}
      />
    </div>
  );
}
