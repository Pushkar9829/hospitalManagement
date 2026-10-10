import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { Lock } from 'lucide-react';
import { numberSeriesInput } from '@hms/shared/schemas';
import { translateValidation } from '@hms/i18n';
import { Banner, Button, Card, ErrorState, Input, Loading, Select, cn, useToast } from '@hms/ui';
import { apiError } from '../../../app/apiError.js';
import { applyFieldErrors } from '../../../lib/forms.js';
import { useCan } from '../../../lib/useCan.js';
import { ApiErrorNotice } from '../../../components/ApiErrorNotice.jsx';
import { useNumberSeriesQuery, useUpdateNumberSeriesMutation } from '../api.js';
import { exampleNumber } from '../numbering.js';

function SeriesRow({ series, canEdit }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [update] = useUpdateNumberSeriesMutation();
  const [failure, setFailure] = useState(null);
  const values = { prefix: series.prefix, reset: series.reset, width: series.width };
  const {
    register,
    handleSubmit,
    reset,
    watch,
    setError,
    formState: { errors, isDirty, isSubmitting },
  } = useForm({ resolver: zodResolver(numberSeriesInput), defaultValues: values });
  useEffect(() => {
    reset({ prefix: series.prefix, reset: series.reset, width: series.width });
  }, [series.prefix, series.reset, series.width, reset]);

  const live = watch();
  const example = exampleNumber(live);
  const uhid = series.series === 'UHID';
  const formId = `series-${series.series}`;
  const label = t(`settings.series.names.${series.series}`, { defaultValue: series.label });
  const rowError =
    translateValidation(t, errors.prefix?.message) ??
    (errors.width && t('settings.series.widthError')) ??
    translateValidation(t, errors.reset?.message);

  const onSubmit = async (v) => {
    setFailure(null);
    try {
      await update({ series: series.series, ...v }).unwrap();
      toast({ title: t('settings.series.saved', { name: label }), tone: 'success' });
    } catch (err) {
      setFailure(applyFieldErrors(err, setError, ['prefix', 'reset', 'width']));
    }
  };

  return (
    <tr className="border-b border-line align-top last:border-b-0">
      <th scope="row" className="px-3 py-2.5 text-left font-normal">
        <span className="block font-semibold text-ink">{label}</span>
        <span className="block text-sm text-muted">
          {series.perBranch ? t('settings.series.perBranch') : t('settings.series.hospitalWide')}
        </span>
      </th>
      <td className="px-3 py-2">
        <Input
          form={formId}
          mono
          maxLength={5}
          aria-label={t('settings.series.prefixFor', { name: label })}
          aria-invalid={errors.prefix ? true : undefined}
          className="w-24 uppercase"
          disabled={!canEdit}
          {...register('prefix')}
        />
      </td>
      <td className="px-3 py-2">
        {uhid ? (
          <span className="inline-flex min-h-tap items-center gap-1.5 text-sm text-muted">
            <Lock size={14} aria-hidden="true" />
            {t('settings.series.neverLocked')}
            <input type="hidden" form={formId} {...register('reset')} />
          </span>
        ) : (
          <Select
            form={formId}
            aria-label={t('settings.series.resetFor', { name: label })}
            className="w-52"
            disabled={!canEdit}
            options={['YEARLY', 'MONTHLY', 'NEVER'].map((r) => ({
              value: r,
              label: t(`settings.series.reset.${r}`),
            }))}
            {...register('reset')}
          />
        )}
      </td>
      <td className="px-3 py-2">
        <Input
          form={formId}
          type="number"
          min={3}
          max={9}
          aria-label={t('settings.series.widthFor', { name: label })}
          aria-invalid={errors.width ? true : undefined}
          className="w-20"
          disabled={!canEdit}
          {...register('width', { valueAsNumber: true })}
        />
      </td>
      <td className="px-3 py-2">
        <output
          form={formId}
          aria-live="polite"
          className={cn(
            'inline-flex min-h-tap items-center font-mono text-sm whitespace-nowrap',
            isDirty ? 'text-ink' : 'text-muted',
          )}
        >
          {example ?? '—'}
        </output>
        {(rowError || failure) && (
          <div className="mt-1 max-w-xs text-sm text-critical" role="alert">
            {rowError ?? <ApiErrorNotice error={failure} />}
          </div>
        )}
      </td>
      <td className="px-3 py-2 text-right">
        {canEdit && (
          <form id={formId} onSubmit={handleSubmit(onSubmit)} noValidate>
            <Button
              type="submit"
              size="sm"
              variant="secondary"
              disabled={!isDirty}
              loading={isSubmitting}
            >
              {t('common.save')}
              <span className="sr-only"> {label}</span>
            </Button>
          </form>
        )}
      </td>
    </tr>
  );
}

/** Document number series: prefix, reset period and width, with a live example. */
export function NumberSeriesTab() {
  const { t } = useTranslation();
  const can = useCan();
  const canEdit = can('settings:hospital:update');
  const { data, isLoading, isError, error, refetch } = useNumberSeriesQuery();
  if (isLoading) return <Loading rows={6} />;
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
      title={t('settings.series.title')}
      description={t('settings.series.description')}
      padding={false}
    >
      {!canEdit && (
        <Banner tone="info" className="m-4">
          {t('settings.readOnly')}
        </Banner>
      )}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left text-base">
          <caption className="sr-only">{t('settings.series.title')}</caption>
          <thead>
            <tr className="bg-surface-2 text-sm text-muted">
              <th scope="col" className="border-b border-line px-3 py-2 font-semibold">
                {t('settings.series.series')}
              </th>
              <th scope="col" className="border-b border-line px-3 py-2 font-semibold">
                {t('settings.series.prefix')}
              </th>
              <th scope="col" className="border-b border-line px-3 py-2 font-semibold">
                {t('settings.series.resets')}
              </th>
              <th scope="col" className="border-b border-line px-3 py-2 font-semibold">
                {t('settings.series.width')}
              </th>
              <th scope="col" className="border-b border-line px-3 py-2 font-semibold">
                {t('settings.series.example')}
              </th>
              <th scope="col" className="border-b border-line px-3 py-2">
                <span className="sr-only">{t('common.actions')}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {data.map((s) => (
              <SeriesRow key={s.series} series={s} canEdit={canEdit} />
            ))}
          </tbody>
        </table>
      </div>
      <p className="border-t border-line px-4 py-3 text-sm text-muted">
        {t('settings.series.footnote')}
      </p>
    </Card>
  );
}
