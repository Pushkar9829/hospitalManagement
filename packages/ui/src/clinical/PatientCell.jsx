import { useTranslation } from 'react-i18next';
import { cn } from '../lib/cn.js';

/**
 * Patient in a table cell: full name (never abbreviated) and, below, UHID with age and sex, so
 * two patients with similar names can be told apart.
 */
export function PatientCell({ name, uhid, age, sex, className }) {
  const { t } = useTranslation();
  const ageSex = [
    typeof age === 'number' ? t('patient.age', { value: age }) : age,
    sex ? t(`patient.sexShort.${sex}`, { defaultValue: sex }) : null,
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <div className={cn('min-w-0', className)}>
      <div className="truncate font-medium text-ink">{name}</div>
      <div className="truncate text-sm text-muted">
        {uhid && <span className="font-mono">{uhid}</span>}
        {uhid && ageSex && ' · '}
        {ageSex}
      </div>
    </div>
  );
}
