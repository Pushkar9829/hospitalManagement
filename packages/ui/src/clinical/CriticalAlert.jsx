import { useState } from 'react';
import { CircleCheck, OctagonAlert } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '../lib/cn.js';
import { formatTime } from '../lib/format.js';
import { Button } from '../primitives/Button.jsx';

/**
 * Act-now alert (critical result, sound-alike drug …). It has no close button: it stays until a
 * person acknowledges it, then shows who acknowledged it and when.
 *
 * Controlled with `acknowledged={{ by, at }}`, or let `onAcknowledge()` resolve to `{ by, at }`.
 */
export function CriticalAlert({
  title,
  patient,
  raisedAt,
  acknowledged: acknowledgedProp,
  onAcknowledge,
  className,
  children,
}) {
  const { t } = useTranslation();
  const [own, setOwn] = useState(null);
  const [busy, setBusy] = useState(false);
  const acknowledged = acknowledgedProp ?? own;

  const acknowledge = async () => {
    setBusy(true);
    try {
      const result = await onAcknowledge?.();
      if (result?.by) setOwn({ by: result.by, at: result.at ?? new Date() });
    } finally {
      setBusy(false);
    }
  };

  if (acknowledged) {
    return (
      <div
        role="status"
        className={cn(
          'flex items-start gap-3 rounded-card border border-line bg-surface px-4 py-3',
          className,
        )}
      >
        <CircleCheck aria-hidden="true" size={20} className="mt-px shrink-0 text-success" />
        <div className="min-w-0">
          <p className="font-semibold text-ink">
            {title}
            {patient && <span className="font-normal text-muted"> · {patient}</span>}
          </p>
          <p className="text-sm text-muted">
            {t('alert.acknowledged', {
              name: acknowledged.by,
              time: formatTime(acknowledged.at),
            })}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      role="alert"
      className={cn(
        'flex flex-wrap items-start gap-3 rounded-card border-2 border-critical bg-critical-bg px-4 py-3 text-critical',
        className,
      )}
    >
      <OctagonAlert aria-hidden="true" size={22} className="mt-px shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="font-semibold">
          <span className="mr-2 inline-block rounded-chip bg-danger px-2 text-sm text-on-primary">
            {t('alert.critical')}
          </span>
          {title}
          {patient && <span> · {patient}</span>}
        </p>
        {children && <div className="mt-1 text-base">{children}</div>}
        {raisedAt && (
          <p className="mt-1 text-sm">{t('alert.raised', { time: formatTime(raisedAt) })}</p>
        )}
      </div>
      <Button variant="danger" size="md" loading={busy} onClick={acknowledge}>
        {busy ? t('alert.acknowledging') : t('alert.acknowledge')}
      </Button>
    </div>
  );
}
