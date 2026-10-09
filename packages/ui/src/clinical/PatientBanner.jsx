import { useTranslation } from 'react-i18next';
import { cn } from '../lib/cn.js';
import { initials } from '../lib/format.js';
import { StatusBadge } from '../feedback/StatusBadge.jsx';
import { AllergyChip } from './AllergyChip.jsx';

function ageText(t, age) {
  if (age == null || age === '') return null;
  return typeof age === 'number' ? t('patient.age', { value: age }) : age;
}

/**
 * Patient identity, mandatory on every patient-context screen (UI/UX review): full name, age,
 * sex, UHID, IP number, bed, allergies, flags, consultant and weight.
 *
 * `allergies`: array of names; `[]` with `noKnownAllergies` shows "No known allergies";
 * `null`/omitted shows "Allergies not recorded" so a missing history is never read as "none".
 * `age`: years as a number, or a display string for infants ("3 M", "12 D").
 */
export function PatientBanner({
  name,
  age,
  sex,
  uhid,
  ipNo,
  bed,
  allergies,
  noKnownAllergies = false,
  flags = [],
  consultant,
  weightKg,
  className,
}) {
  const { t } = useTranslation();
  const sexLabel = sex ? t(`patient.sex.${sex}`, { defaultValue: sex }) : null;
  const ids = [
    uhid && { label: t('patient.uhid'), value: uhid, visible: false },
    ipNo && { label: t('patient.ipNo'), value: ipNo, visible: false },
    bed && { label: t('patient.bed'), value: bed, visible: true },
  ].filter(Boolean);
  const hasAllergies = Array.isArray(allergies) && allergies.length > 0;
  return (
    <section
      aria-label={t('patient.banner', { name })}
      className={cn(
        'flex flex-wrap items-center gap-x-6 gap-y-3 rounded-card border border-line bg-surface-2 px-4 py-3',
        className,
      )}
    >
      <div className="flex min-w-0 items-center gap-3">
        <span
          aria-hidden="true"
          className="inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-neutral-bg text-md font-semibold text-neutral"
        >
          {initials(name)}
        </span>
        <div className="min-w-0">
          <p className="text-lg text-ink">
            <strong className="font-semibold">{name}</strong>
            {[ageText(t, age), sexLabel].filter(Boolean).map((s) => (
              <span key={s} className="text-muted">
                {' · '}
                {s}
              </span>
            ))}
          </p>
          {ids.length > 0 && (
            <p className="flex flex-wrap gap-x-3 font-mono text-sm text-muted">
              {ids.map((x) => (
                <span key={x.label}>
                  <span className={x.visible ? undefined : 'sr-only'}>{x.label} </span>
                  <span className="text-ink">{x.value}</span>
                </span>
              ))}
            </p>
          )}
        </div>
      </div>
      <ul className="ml-auto flex flex-wrap items-center gap-2" aria-label={t('patient.allergies')}>
        {hasAllergies &&
          allergies.map((a) => (
            <li key={a}>
              <AllergyChip name={a} />
            </li>
          ))}
        {!hasAllergies && noKnownAllergies && (
          <li>
            <StatusBadge tone="success" label={t('patient.noKnownAllergies')} />
          </li>
        )}
        {!hasAllergies && !noKnownAllergies && (
          <li>
            <StatusBadge tone="warning" label={t('patient.allergiesNotRecorded')} />
          </li>
        )}
        {flags.map((f) => (
          <li key={f.label}>
            <StatusBadge tone={f.tone ?? 'warning'} label={f.label} />
          </li>
        ))}
        {consultant && (
          <li>
            <StatusBadge tone="info" label={consultant} icon={false} />
          </li>
        )}
        {weightKg != null && (
          <li>
            <StatusBadge
              tone="neutral"
              label={`${t('patient.weight')} ${t('patient.weightKg', { value: weightKg })}`}
            />
          </li>
        )}
      </ul>
    </section>
  );
}
