import { useEffect, useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { Building, Plus } from 'lucide-react';
import { legalEntityInput } from '@hms/shared/schemas';
import { translateValidation } from '@hms/i18n';
import {
  Button,
  Card,
  DataTable,
  EmptyState,
  ErrorState,
  FormField,
  Input,
  Sheet,
  StatusBadge,
  useToast,
} from '@hms/ui';
import { apiError } from '../../../app/apiError.js';
import { applyFieldErrors } from '../../../lib/forms.js';
import { useCan } from '../../../lib/useCan.js';
import { ApiErrorNotice } from '../../../components/ApiErrorNotice.jsx';
import { FileField } from '../../files/FileField.jsx';
import { useEntitiesQuery, useSaveEntityMutation } from '../api.js';

const FIELDS = [
  'name',
  'registrationNo',
  'gstin',
  'pan',
  'address',
  'signatory',
  'logoFileId',
  'letterheadFileId',
];

const toForm = (e) => ({
  name: e?.name ?? '',
  registrationNo: e?.registrationNo ?? '',
  gstin: e?.gstin ?? '',
  pan: e?.pan ?? '',
  address: {
    line1: e?.address?.line1 ?? '',
    line2: e?.address?.line2 ?? '',
    city: e?.address?.city ?? '',
    state: e?.address?.state ?? '',
    pin: e?.address?.pin ?? '',
  },
  signatory: e?.signatory ?? '',
  logoFileId: e?.logoFileId ?? undefined,
  letterheadFileId: e?.letterheadFileId ?? undefined,
});

function EntitySheet({ entity, open, onOpenChange, onReload }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const can = useCan();
  const canEdit = can('settings:hospital:update');
  const [saveEntity] = useSaveEntityMutation();
  const [failure, setFailure] = useState(null);
  const {
    register,
    control,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(legalEntityInput), defaultValues: toForm(entity) });

  useEffect(() => {
    reset(toForm(entity), { keepDirtyValues: true });
  }, [entity, reset]);

  const onSubmit = async (values) => {
    setFailure(null);
    try {
      await saveEntity(
        entity ? { id: entity.id, ...values, version: entity.version } : values,
      ).unwrap();
      toast({ title: t('settings.entities.saved', { name: values.name }), tone: 'success' });
      onOpenChange(false);
    } catch (err) {
      setFailure(applyFieldErrors(err, setError, FIELDS));
    }
  };
  const msg = (e) => translateValidation(t, e?.message);
  const formId = 'entity-form';

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      size="lg"
      title={
        entity
          ? t('settings.entities.editTitle', { name: entity.name })
          : t('settings.entities.addTitle')
      }
      description={t('settings.entities.sheetHint')}
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          {canEdit && (
            <Button type="submit" form={formId} loading={isSubmitting}>
              {entity ? t('common.save') : t('settings.entities.add')}
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
          <FormField
            label={t('settings.entities.name')}
            error={msg(errors.name)}
            required
            className="sm:col-span-2"
          >
            <Input {...register('name')} />
          </FormField>
          <FormField
            label={t('settings.entities.registrationNo')}
            error={msg(errors.registrationNo)}
            optional
          >
            <Input mono {...register('registrationNo')} />
          </FormField>
          <FormField
            label={t('settings.entities.signatory')}
            error={msg(errors.signatory)}
            optional
          >
            <Input {...register('signatory')} />
          </FormField>
          <FormField
            label="GSTIN"
            hint={t('settings.entities.gstinHint')}
            error={msg(errors.gstin)}
            optional
          >
            <Input mono maxLength={15} className="uppercase" {...register('gstin')} />
          </FormField>
          <FormField label="PAN" error={msg(errors.pan)} optional>
            <Input mono maxLength={10} className="uppercase" {...register('pan')} />
          </FormField>
          <FormField
            label={t('address.line1')}
            error={msg(errors.address?.line1)}
            optional
            className="sm:col-span-2"
          >
            <Input autoComplete="address-line1" {...register('address.line1')} />
          </FormField>
          <FormField
            label={t('address.line2')}
            error={msg(errors.address?.line2)}
            optional
            className="sm:col-span-2"
          >
            <Input autoComplete="address-line2" {...register('address.line2')} />
          </FormField>
          <FormField label={t('address.city')} error={msg(errors.address?.city)} optional>
            <Input autoComplete="address-level2" {...register('address.city')} />
          </FormField>
          <FormField label={t('address.state')} error={msg(errors.address?.state)} optional>
            <Input autoComplete="address-level1" {...register('address.state')} />
          </FormField>
          <FormField label={t('address.pin')} error={msg(errors.address?.pin)} optional>
            <Input
              mono
              inputMode="numeric"
              maxLength={6}
              autoComplete="postal-code"
              {...register('address.pin')}
            />
          </FormField>
          <div className="sm:col-span-2">
            <Controller
              control={control}
              name="logoFileId"
              render={({ field }) => (
                <FileField
                  label={t('settings.entities.logo')}
                  purpose="hospital-logo"
                  value={field.value}
                  onChange={field.onChange}
                  disabled={!canEdit}
                />
              )}
            />
          </div>
          <div className="sm:col-span-2">
            <Controller
              control={control}
              name="letterheadFileId"
              render={({ field }) => (
                <FileField
                  label={t('settings.entities.letterhead')}
                  purpose="letterhead"
                  value={field.value}
                  onChange={field.onChange}
                  disabled={!canEdit}
                />
              )}
            />
          </div>
        </fieldset>
      </form>
    </Sheet>
  );
}

/** Legal entities that issue bills (name, GSTIN, PAN, address, logo and letterhead). */
export function EntitiesTab() {
  const { t } = useTranslation();
  const can = useCan();
  const { data = [], isLoading, isError, error, refetch } = useEntitiesQuery();
  const [editing, setEditing] = useState(null); // { id } | { id: null } for new
  const entity = editing?.id ? data.find((e) => e.id === editing.id) : null;

  const columns = useMemo(
    () => [
      {
        id: 'name',
        header: t('settings.entities.name'),
        cell: ({ row }) => <span className="font-semibold">{row.original.name}</span>,
      },
      {
        id: 'gstin',
        header: 'GSTIN',
        meta: { mono: true },
        cell: ({ row }) => row.original.gstin ?? '-',
      },
      {
        id: 'pan',
        header: 'PAN',
        meta: { mono: true },
        cell: ({ row }) => row.original.pan ?? '-',
      },
      {
        id: 'city',
        header: t('address.city'),
        cell: ({ row }) => row.original.address?.city ?? '-',
      },
      {
        id: 'branding',
        header: t('settings.entities.branding'),
        cell: ({ row }) =>
          row.original.logoFileId || row.original.letterheadFileId ? (
            <StatusBadge tone="success" label={t('settings.entities.brandingSet')} />
          ) : (
            <StatusBadge tone="neutral" label={t('settings.entities.brandingMissing')} />
          ),
      },
    ],
    [t],
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
    <Card
      title={t('settings.entities.title')}
      description={t('settings.entities.description')}
      padding={false}
      actions={
        can('settings:hospital:update') && (
          <Button
            icon={<Plus size={16} aria-hidden="true" />}
            onClick={() => setEditing({ id: null })}
          >
            {t('settings.entities.add')}
          </Button>
        )
      }
    >
      <DataTable
        className="[&>div]:rounded-none [&>div]:border-0"
        columns={columns}
        data={data}
        loading={isLoading}
        caption={t('settings.entities.title')}
        onRowClick={(row) => setEditing({ id: row.id })}
        empty={
          <EmptyState
            icon={Building}
            title={t('settings.entities.emptyTitle')}
            description={t('settings.entities.emptyBody')}
            bordered={false}
          />
        }
      />
      {editing && (
        <EntitySheet
          key={editing.id ?? 'new'}
          entity={entity}
          open
          onOpenChange={(o) => !o && setEditing(null)}
          onReload={refetch}
        />
      )}
    </Card>
  );
}
