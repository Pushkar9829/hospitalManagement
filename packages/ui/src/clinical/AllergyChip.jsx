import { OctagonAlert } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '../lib/cn.js';

/** One allergy, in the critical tone with an icon: "Allergy: Penicillin". */
export function AllergyChip({ name, className }) {
  const { t } = useTranslation();
  return (
    <span
      data-tone="critical"
      className={cn(
        'inline-flex items-center gap-1 rounded-chip bg-critical-bg px-2 py-0.5 text-sm font-semibold text-critical',
        className,
      )}
    >
      <OctagonAlert aria-hidden="true" size={13} strokeWidth={2.5} />
      {t('patient.allergy', { name })}
    </span>
  );
}
