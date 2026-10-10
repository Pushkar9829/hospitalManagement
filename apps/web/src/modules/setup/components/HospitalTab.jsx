import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { hospitalSettingsInput } from '@hms/shared/schemas';
import { LANGUAGES } from '@hms/shared';
import { translateValidation } from '@hms/i18n';
import {
  Banner,
  Button,
  Card,
  ErrorState,
  FormField,
  Input,
  Loading,
  Select,
  usePageAction,
  useToast,
} from '@hms/ui';
import { apiError } from '../../../app/apiError.js';
import { applyFieldErrors } from '../../../lib/forms.js';
import { useCan } from '../../../lib/useCan.js';
import { ApiErrorNotice } from '../../../components/ApiErrorNotice.jsx';
import { CheckboxList } from '../../../components/CheckboxList.jsx';
import { useHospitalSettingsQuery, useUpdateHospitalSettingsMutation } from '../api.js';

const FIELDS = [
  'displayName',
  'financialYearStartMonth',
  'dateFormat',
  'languages',
  'idleTimeoutMin',
  'communication.smsSenderId',
  'communication.emailFrom',
  'communication.whatsappNumber',
];

const toForm = (d) => ({
  displayName: d.displayName ?? '',
  financialYearStartMonth: d.financialYearStartMonth ?? 4,
  timezone: 'Asia/Kolkata',
  dateFormat: d.dateFormat ?? 'DD/MM/YYYY',
  languages: d.languages ?? ['en'],
  idleTimeoutMin: d.idleTimeoutMin ?? 15,
  communication: {
    smsSenderId: d.communication?.smsSenderId ?? '',
    emailFrom: d.communication?.emailFrom ?? '',
    whatsappNumber: d.communication?.whatsappNumber ?? '',
  },
});

/**
 * Hospital profile (spec 5.1): display name, financial year, date format, languages, idle
 * sign-out and communication senders. Saves with the version it read; on 409 "Reload" takes the
 * latest values for every field the user has not touched and keeps their edits (merge).
 */
export function HospitalTab() {
  const { t, i18n } = useTranslation();
  const { toast } = useToast();
  const can = useCan();
  const canEdit = can('settings:hospital:update');
  const { data, isLoading, isError, error: loadError, refetch } = useHospitalSettingsQuery();
  const [save] = useUpdateHospitalSettingsMutation();
  const [failure, setFailure] = useState(null);
  const form = useForm({
    resolver: zodResolver(hospitalSettingsInput),
    defaultValues: toForm({}),
  });
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting, isDirty },
  } = form;

  useEffect(() => {
    if (data) reset(toForm(data), { keepDirtyValues: true });
  }, [data, reset]);

  const onSubmit = async (values) => {
    setFailure(null);
    try {
      const saved = await save({ ...values, version: data.version }).unwrap();
      reset(toForm(saved));
      toast({ title: t('settings.saved'), tone: 'success' });
    } catch (err) {
      setFailure(applyFieldErrors(err, setError, FIELDS));
    }
  };
  const submit = handleSubmit(onSubmit);
  usePageAction('save', submit, { enabled: canEdit });

  if (isLoading) return <Loading rows={5} />;
  if (isError)
    return (
      <ErrorState
        title={t('settings.loadFailed')}
        requestId={apiError(loadError)?.requestId}
        onRetry={refetch}
      />
    );

  const msg = (e) => translateValidation(t, e?.message);
  const locale = i18n.language === 'hi' ? 'hi-IN' : 'en-IN';
  const months = Array.from({ length: 12 }, (_, i) => ({
    value: i + 1,
    label: new Intl.DateTimeFormat(locale, { month: 'long', timeZone: 'UTC' }).format(
      new Date(Date.UTC(2026, i, 1)),
    ),
  }));

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      {!canEdit && <Banner tone="info">{t('settings.readOnly')}</Banner>}
      <ApiErrorNotice
        error={failure}
        onReload={async () => {
          setFailure(null);
          await refetch();
        }}
      />
      <fieldset
        disabled={!canEdit}
        className="grid min-w-0 grid-cols-1 gap-4 xl:grid-cols-[2fr_1fr]"
      >
        <Card title={t('settings.hospital.profile')}>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <FormField
              label={t('settings.hospital.displayName')}
              hint={t('settings.hospital.displayNameHint')}
              error={msg(errors.displayName)}
              required
              className="md:col-span-2"
            >
              <Input autoComplete="organization" {...register('displayName')} />
            </FormField>
            <FormField
              label={t('settings.hospital.fyStart')}
              hint={t('settings.hospital.fyStartHint')}
              error={msg(errors.financialYearStartMonth)}
              required
            >
              <Select
                options={months}
                {...register('financialYearStartMonth', { setValueAs: Number })}
              />
            </FormField>
            <FormField
              label={t('settings.hospital.timezone')}
              hint={t('settings.hospital.timezoneHint')}
            >
              <Input value="Asia/Kolkata · INR (₹)" readOnly />
            </FormField>
            <FormField
              label={t('settings.hospital.dateFormat')}
              error={msg(errors.dateFormat)}
              required
            >
              <Select
                options={[
                  { value: 'DD/MM/YYYY', label: '10/10/2026 (DD/MM/YYYY)' },
                  { value: 'DD-MMM-YYYY', label: '10-Oct-2026 (DD-MMM-YYYY)' },
                ]}
                {...register('dateFormat')}
              />
            </FormField>
            <Controller
              control={form.control}
              name="languages"
              render={({ field }) => (
                <CheckboxList
                  className="md:col-span-2"
                  legend={t('settings.hospital.languages')}
                  hint={t('settings.hospital.languagesHint')}
                  error={errors.languages && t('settings.hospital.languagesError')}
                  required
                  columns={3}
                  value={field.value}
                  onChange={field.onChange}
                  options={Object.entries(LANGUAGES).map(([code, label]) => ({
                    value: code,
                    label: <span lang={code}>{label}</span>,
                  }))}
                />
              )}
            />
          </div>
        </Card>
        <div className="flex min-w-0 flex-col gap-4">
          <Card title={t('settings.hospital.security')}>
            <FormField
              label={t('settings.hospital.idleTimeout')}
              hint={t('settings.hospital.idleTimeoutHint')}
              error={errors.idleTimeoutMin && t('settings.hospital.idleTimeoutError')}
              required
            >
              <Input
                type="number"
                inputMode="numeric"
                min={5}
                max={60}
                className="max-w-32"
                {...register('idleTimeoutMin', { valueAsNumber: true })}
              />
            </FormField>
          </Card>
          <Card title={t('settings.hospital.communication')}>
            <div className="flex flex-col gap-4">
              <FormField
                label={t('settings.hospital.smsSenderId')}
                hint={t('settings.hospital.smsSenderIdHint')}
                error={msg(errors.communication?.smsSenderId)}
                optional
              >
                <Input mono maxLength={6} {...register('communication.smsSenderId')} />
              </FormField>
              <FormField
                label={t('settings.hospital.emailFrom')}
                error={msg(errors.communication?.emailFrom)}
                optional
              >
                <Input type="email" {...register('communication.emailFrom')} />
              </FormField>
              <FormField
                label={t('settings.hospital.whatsapp')}
                error={msg(errors.communication?.whatsappNumber)}
                optional
              >
                <Input type="tel" inputMode="tel" {...register('communication.whatsappNumber')} />
              </FormField>
            </div>
          </Card>
        </div>
      </fieldset>
      {canEdit && (
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" loading={isSubmitting} disabled={!isDirty}>
            {t('settings.saveChanges')}
          </Button>
          <span className="text-sm text-muted">
            {isDirty ? t('settings.unsaved') : t('settings.allSaved')}
          </span>
        </div>
      )}
    </form>
  );
}
