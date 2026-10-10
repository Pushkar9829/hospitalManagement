import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { History } from 'lucide-react';
import { EmptyState, ErrorState, Loading, StatusBadge, formatDateTime } from '@hms/ui';
import { apiError } from '../../../app/apiError.js';
import { useCan } from '../../../lib/useCan.js';
import { usePatientTimeline } from '../hooks.js';

const TONES = { REGISTERED: 'success', MERGED: 'warning', BILL: 'info' };

/** Registration, merges, bills and (as modules arrive) visits and reports, newest first, in IST. */
export function TimelineTab({ patientId }) {
  const { t, i18n } = useTranslation();
  const can = useCan();
  const locale = i18n.language === 'hi' ? 'hi-IN' : 'en-IN';
  const { data, isLoading, isError, error, refetch } = usePatientTimeline(patientId);
  if (isLoading) return <Loading rows={4} />;
  if (isError)
    return (
      <ErrorState
        title={t('patients.timeline.failed')}
        requestId={apiError(error)?.requestId}
        onRetry={refetch}
      />
    );
  if (!data?.length) return <EmptyState icon={History} title={t('patients.timeline.empty')} />;
  return (
    <ol className="flex flex-col" aria-label={t('patients.tabs.timeline')}>
      {data.map((e, i) => (
        <li
          key={`${e.type}-${e.at}-${i}`}
          className="flex gap-4 border-l-2 border-line pb-4 pl-4 last:pb-0"
        >
          <div className="flex min-w-0 flex-col gap-1">
            <p className="flex flex-wrap items-center gap-2 text-sm text-muted">
              <time dateTime={e.at}>{formatDateTime(e.at, locale)}</time>
              <StatusBadge
                tone={TONES[e.type] ?? 'neutral'}
                icon={false}
                label={t(`patients.timeline.types.${e.type}`, { defaultValue: e.type })}
              />
            </p>
            <p className="text-base text-ink">
              {e.type === 'BILL' && e.ref && can('billing:bill:read') ? (
                <Link to={`/billing/bills/${e.ref}`} className="underline underline-offset-2">
                  {e.title}
                </Link>
              ) : (
                e.title
              )}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}
