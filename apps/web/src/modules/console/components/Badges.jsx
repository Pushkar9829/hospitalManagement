import { useTranslation } from 'react-i18next';
import { StatusBadge } from '@hms/ui';
import { HEALTH_TONES, INVOICE_TONES, TENANT_TONES } from '../format.js';

/** A tenant's state: colour plus text. */
export function TenantStatusBadge({ status }) {
  const { t } = useTranslation();
  return (
    <StatusBadge
      tone={TENANT_TONES[status] ?? 'neutral'}
      label={t(`console.status.${status}`, { defaultValue: status })}
    />
  );
}

export function HealthBadge({ health }) {
  const { t } = useTranslation();
  if (!health) return <span className="text-muted">-</span>;
  return (
    <StatusBadge
      tone={HEALTH_TONES[health] ?? 'neutral'}
      icon={false}
      label={t(`console.health.${health}`, { defaultValue: health })}
    />
  );
}

export function InvoiceStatusBadge({ status }) {
  const { t } = useTranslation();
  return (
    <StatusBadge
      tone={INVOICE_TONES[status] ?? 'neutral'}
      label={t(`console.invoice.status.${status}`, { defaultValue: status })}
    />
  );
}
