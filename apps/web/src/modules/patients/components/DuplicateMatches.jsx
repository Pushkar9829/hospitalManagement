import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { ExternalLink, UserCheck } from 'lucide-react';
import { Banner, Button, PatientCell, StatusBadge } from '@hms/ui';

/**
 * 409 POSSIBLE_DUPLICATE (spec 5.4): the likely matches with their scores. The desk opens the
 * existing record, or confirms the patient is a different person and registers anyway (the
 * API is asked again with confirmNotDuplicate; nothing merges silently).
 */
export function DuplicateMatches({ matches, onConfirm, confirming = false }) {
  const { t } = useTranslation();
  return (
    <Banner
      tone="warning"
      role="alert"
      title={t('patients.duplicates.title', { count: matches.length })}
    >
      <p className="mb-3">{t('patients.duplicates.body')}</p>
      <ul className="flex flex-col gap-2" aria-label={t('patients.duplicates.list')}>
        {matches.map((m) => (
          <li
            key={m.id ?? m.uhid}
            className="flex flex-wrap items-center gap-3 rounded-control border border-line bg-surface px-3 py-2 text-ink"
          >
            <PatientCell
              name={m.name}
              uhid={m.uhid}
              age={m.age}
              sex={m.gender}
              className="min-w-40 flex-1"
            />
            <span className="font-mono text-sm">{m.mobile}</span>
            <StatusBadge
              tone={m.score >= 0.9 ? 'critical' : 'warning'}
              label={t('patients.duplicates.score', { score: Math.round((m.score ?? 0) * 100) })}
            />
            {m.id && (
              <Link
                to={`/patients/${m.id}`}
                className="inline-flex min-h-tap items-center gap-1.5 rounded-control px-2 text-sm font-semibold text-info underline underline-offset-2"
              >
                <ExternalLink size={14} aria-hidden="true" />
                {t('patients.duplicates.open', { uhid: m.uhid })}
              </Link>
            )}
          </li>
        ))}
      </ul>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Button
          variant="secondary"
          loading={confirming}
          icon={<UserCheck size={16} aria-hidden="true" />}
          onClick={onConfirm}
        >
          {t('patients.duplicates.confirm')}
        </Button>
        <span className="text-sm">{t('patients.duplicates.confirmHint')}</span>
      </div>
    </Banner>
  );
}
