import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { MASTERS } from '@hms/shared/schemas';
import { translateValidation } from '@hms/i18n';
import { Banner, Button, FormField, Input, Select, Sheet, Textarea } from '@hms/ui';
import { applyFieldErrors } from '../../../lib/forms.js';
import { inr, rupeesText } from '../../../lib/money.js';
import { useCan } from '../../../lib/useCan.js';
import { ApiErrorNotice } from '../../../components/ApiErrorNotice.jsx';
import { Status } from '../../../components/Status.jsx';
import { useSaveMasterMutation } from '../api.js';
import { ratesText, useServiceRefs } from '../services.js';
import { cleanResolver, useMasterLabels } from '../masters.js';

const schema = MASTERS.services.input;
const FIELDS = ['code', 'name', 'category', 'departmentCode', 'taxCode', 'revenueHead', 'rates'];
const CATEGORIES = schema.shape.category.options;

const toForm = (s, refs) => ({
  code: s?.code ?? '',
  name: s?.name ?? '',
  category: s?.category ?? 'CONSULTATION',
  departmentCode: s?.departmentId ? (refs.deptCode.get(s.departmentId) ?? '') : '',
  taxCode: s?.taxCodeId ? (refs.taxCode.get(s.taxCodeId) ?? '') : '',
  revenueHead: s?.revenueHead ?? '',
  rates: Object.fromEntries(
    refs.activeLists.map((l) => [
      l.code,
      rupeesText(s?.rates?.find((r) => r.priceListId === l.id)?.amount),
    ]),
  ),
  reason: '',
});

/**
 * Service and tariff form (hand-tuned): one rate in rupees per active price list. A new service
 * and any rate change wait for Super Admin approval (202); until then the current rates stay and
 * the new ones show as waiting.
 */
export function ServiceSheet({ record, open, onOpenChange, onDone, onReload }) {
  const { t } = useTranslation();
  const can = useCan();
  const labels = useMasterLabels('services');
  const canWrite = record ? can('settings:master:update') : can('settings:master:create');
  const refs = useServiceRefs();
  const [save] = useSaveMasterMutation();
  const [failure, setFailure] = useState(null);
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: async (values, ctx, opts) => {
      const { reason, ...rest } = values;
      const res = await cleanResolver(schema)(rest, ctx, opts);
      return res.errors && Object.keys(res.errors).length
        ? res
        : { values: { ...res.values, reason }, errors: {} };
    },
    defaultValues: toForm(record, refs),
  });

  useEffect(() => {
    reset(toForm(record, refs), { keepDirtyValues: true });
  }, [record, refs, reset]);

  const onSubmit = async ({ reason, ...values }) => {
    setFailure(null);
    const note = reason?.trim();
    try {
      const res = await save({
        type: 'services',
        ...(record ? { id: record.id, version: record.version } : {}),
        ...values,
        ...(note ? { reason: note } : {}),
      }).unwrap();
      onDone({ name: values.name, approvalId: res?.approvalId ?? null, created: !record });
      onOpenChange(false);
    } catch (err) {
      setFailure(applyFieldErrors(err, setError, FIELDS));
    }
  };
  const msg = (e) => translateValidation(t, e?.message);
  const formId = 'service-form';
  const ratesError = msg(errors.rates?.root ?? errors.rates);

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      size="lg"
      title={
        record ? t('masters.editTitle', { name: record.name }) : t('masters.services.addTitle')
      }
      description={t('masters.services.approvalHint')}
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          {canWrite && (
            <Button type="submit" form={formId} loading={isSubmitting}>
              {record ? t('common.save') : t('masters.services.submit')}
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
        {record && (
          <div className="flex flex-wrap items-center gap-2">
            <Status kind="service" code={record.status} />
          </div>
        )}
        {record?.pendingRates?.length > 0 && (
          <Banner tone="warning" title={t('masters.services.pendingTitle')}>
            {ratesText(record.pendingRates, refs.listCode)}
          </Banner>
        )}
        <ApiErrorNotice
          error={failure}
          onReload={async () => {
            setFailure(null);
            await onReload();
          }}
        />
        <fieldset disabled={!canWrite} className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField
            label={labels.field('code')}
            hint={record ? t('masters.codeLocked') : t('masters.codeHint')}
            error={msg(errors.code)}
            required
          >
            <Input
              mono
              className="uppercase"
              maxLength={16}
              readOnly={Boolean(record)}
              {...register('code')}
            />
          </FormField>
          <FormField label={labels.field('name')} error={msg(errors.name)} required>
            <Input {...register('name')} />
          </FormField>
          <FormField label={labels.field('category')} error={msg(errors.category)} required>
            <Select
              options={CATEGORIES.map((c) => ({ value: c, label: labels.option(c) }))}
              {...register('category')}
            />
          </FormField>
          <FormField
            label={labels.field('departmentCode')}
            error={msg(errors.departmentCode)}
            optional
          >
            <Select
              placeholder={t('masters.services.noDepartment')}
              options={refs.departments.map((d) => ({
                value: d.code,
                label: `${d.name} (${d.code})`,
              }))}
              {...register('departmentCode')}
            />
          </FormField>
          <FormField label={labels.field('taxCode')} error={msg(errors.taxCode)} required>
            <Select
              placeholder={t('masters.services.chooseTax')}
              options={refs.taxes.map((x) => ({ value: x.code, label: `${x.name} (${x.code})` }))}
              {...register('taxCode')}
            />
          </FormField>
          <FormField label={labels.field('revenueHead')} error={msg(errors.revenueHead)} optional>
            <Input {...register('revenueHead')} />
          </FormField>
          <fieldset className="sm:col-span-2" aria-describedby="rates-hint">
            <legend className="text-sm font-semibold text-ink">
              {t('masters.services.rates')}
              <span className="text-critical" aria-hidden="true">
                {' '}
                *
              </span>
            </legend>
            <p id="rates-hint" className="text-sm text-muted">
              {t('masters.services.ratesHint')}
            </p>
            <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {refs.activeLists.map((l) => {
                const current = record?.rates?.find((r) => r.priceListId === l.id);
                return (
                  <FormField
                    key={l.id}
                    label={`${l.name} (${l.code})`}
                    hint={
                      current
                        ? t('masters.services.currentRate', { amount: inr(current.amount) })
                        : undefined
                    }
                    error={msg(errors.rates?.[l.code])}
                  >
                    <div className="relative">
                      <span
                        aria-hidden="true"
                        className="absolute top-1/2 left-3 -translate-y-1/2 text-muted"
                      >
                        ₹
                      </span>
                      <Input
                        inputMode="decimal"
                        className="tabular pl-7 text-right"
                        {...register(`rates.${l.code}`)}
                      />
                    </div>
                  </FormField>
                );
              })}
            </div>
            {ratesError && (
              <p role="alert" className="mt-1 text-sm text-critical">
                {ratesError}
              </p>
            )}
          </fieldset>
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
