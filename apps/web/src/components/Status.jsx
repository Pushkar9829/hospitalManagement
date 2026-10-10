import { useTranslation } from 'react-i18next';
import { DEPARTMENT_STATUS } from '@hms/shared/schemas';
import { StatusBadge } from '@hms/ui';

const fromCatalogue = (cat) => Object.fromEntries(Object.entries(cat).map(([k, v]) => [k, v.tone]));

/** Status -> badge tone, per kind of record. Labels come from i18n (`status.<CODE>`). */
const STATUS_TONES = {
  department: fromCatalogue(DEPARTMENT_STATUS),
  branch: {
    ACTIVE: 'success',
    PENDING_APPROVAL: 'warning',
    CLOSING: 'warning',
    INACTIVE: 'neutral',
    REJECTED: 'critical',
  },
  service: {
    ACTIVE: 'success',
    PENDING_APPROVAL: 'warning',
    REJECTED: 'critical',
    INACTIVE: 'neutral',
  },
  approval: {
    PENDING: 'warning',
    APPROVED: 'success',
    APPLIED: 'success',
    REJECTED: 'critical',
    WITHDRAWN: 'neutral',
    EXPIRED: 'neutral',
  },
  user: {
    PENDING_APPROVAL: 'warning',
    ACTIVE: 'success',
    INVITED: 'info',
    LOCKED: 'warning',
    DISABLED: 'neutral',
  },
  role: {
    ACTIVE: 'success',
    PENDING_APPROVAL: 'warning',
    REJECTED: 'critical',
    INACTIVE: 'neutral',
  },
  active: { ACTIVE: 'success', INACTIVE: 'neutral' },
};

/** Status chip with colour, label and (for warnings) an icon: never colour alone. */
export function Status({ kind, code, className }) {
  const { t } = useTranslation();
  const tone = STATUS_TONES[kind]?.[code] ?? 'neutral';
  return (
    <StatusBadge
      tone={tone}
      label={t(`status.${code}`, { defaultValue: code })}
      className={className}
    />
  );
}
