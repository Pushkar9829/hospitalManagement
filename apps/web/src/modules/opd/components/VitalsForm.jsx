import { useTranslation } from 'react-i18next';
import { FormField, Input, StatusBadge, cn } from '@hms/ui';
import { bmiBand, bmiOf, bpFlag } from '../opd.js';
import { PRIORITIES } from '../vitals.js';

const BAND_TONE = { UNDER: 'warning', NORMAL: 'success', OVER: 'warning', OBESE: 'critical' };
const PRIORITY_CLS = {
  GREEN: 'border-success bg-success-bg text-success',
  AMBER: 'border-warning bg-warning-bg text-warning',
  RED: 'border-critical bg-critical-bg text-critical',
};

/**
 * The triage reading (board OpdTriage): BP with a High/Low flag, pulse, temperature, SpO2,
 * weight and height with BMI worked out as you type, sugar, complaint, pain score and the
 * priority (red needs a reason, which is audited).
 */
export function VitalsFields({ form, withComplaint = true, withPriority = true, compact = false }) {
  const { t } = useTranslation();
  const {
    register,
    watch,
    setValue,
    formState: { errors },
  } = form;
  const err = (n) => errors[n]?.message;
  const bp = watch('bp');
  const flag = bpFlag(bp);
  const bmi = bmiOf(watch('weightKg'), watch('heightCm'));
  const band = bmiBand(bmi);
  const priority = watch('priority');
  const field = (name, key, extra = {}) => (
    <FormField label={t(`opd.vitals.${key}`)} error={err(name)} optional={extra.optional}>
      <Input
        {...register(name)}
        inputMode={extra.text ? undefined : 'decimal'}
        autoComplete="off"
        className="tabular"
      />
    </FormField>
  );
  return (
    <div className="flex flex-col gap-4">
      <div
        className={cn(
          'grid grid-cols-2 gap-3',
          compact ? 'md:grid-cols-5' : 'md:grid-cols-3 xl:grid-cols-4',
        )}
      >
        <div className="flex flex-col gap-1">
          {field('bp', 'bp', { text: true })}
          {flag && (
            <StatusBadge
              tone={flag === 'HIGH' ? 'critical' : 'warning'}
              label={t(`opd.vitals.bpFlag.${flag}`)}
              className="self-start"
            />
          )}
        </div>
        {field('pulse', 'pulse')}
        {field('tempF', 'temp')}
        {field('spo2', 'spo2')}
        {field('weightKg', 'weight')}
        {!compact && field('heightCm', 'height')}
        {!compact && (
          <div className="flex flex-col gap-1">
            <span className="text-sm font-semibold text-ink">{t('opd.vitals.bmi')}</span>
            <span className="flex min-h-10 items-center gap-2 text-base" aria-live="polite">
              <strong className="tabular">{bmi ?? '-'}</strong>
              {band && (
                <StatusBadge tone={BAND_TONE[band]} label={t(`opd.vitals.bmiBand.${band}`)} />
              )}
            </span>
          </div>
        )}
        {!compact && field('sugar', 'sugar', { optional: true })}
      </div>
      {withComplaint && (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_12rem]">
          <FormField label={t('opd.vitals.complaint')} error={err('complaint')} required>
            <Input {...register('complaint')} autoComplete="off" />
          </FormField>
          {field('painScore', 'pain')}
        </div>
      )}
      {withPriority && (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm font-semibold text-ink">
            {t('opd.vitals.priority')}
          </legend>
          <div className="flex flex-wrap gap-2" role="radiogroup">
            {PRIORITIES.map((p) => (
              <button
                key={p}
                type="button"
                role="radio"
                aria-checked={priority === p}
                onClick={() => setValue('priority', p, { shouldValidate: false })}
                className={cn(
                  'min-h-10 rounded-control border-2 px-4 text-base font-semibold',
                  priority === p ? PRIORITY_CLS[p] : 'border-line-strong bg-surface text-ink',
                )}
              >
                {t(`opd.priority.${p}`)}
              </button>
            ))}
          </div>
          {priority === 'RED' && (
            <>
              <p role="note" className="rounded-control bg-critical-bg px-3 py-2 text-critical">
                <strong>{t('opd.vitals.redFlag')}</strong> {t('opd.vitals.redFlagBody')}
              </p>
              <FormField label={t('opd.vitals.reason')} error={err('priorityReason')} required>
                <Input {...register('priorityReason')} autoComplete="off" />
              </FormField>
            </>
          )}
        </fieldset>
      )}
    </div>
  );
}
