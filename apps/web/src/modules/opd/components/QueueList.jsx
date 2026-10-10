import { useTranslation } from 'react-i18next';
import { StatusBadge, cn } from '@hms/ui';
import { fmtMinutes } from '../../dx-kit/format.js';
import { PRIORITY_TONE, STAGE_TONE } from '../opd.js';

/**
 * A doctor's or a station's queue: token, patient, visit type, wait and stage. With `onPick`
 * every row is a button (Tab and Enter), the open one marked with aria-current and a bar on the
 * left, never colour alone.
 */
export function QueueList({ items, selectedId, onPick, label, showDoctor = false }) {
  const { t } = useTranslation();
  return (
    <ul aria-label={label} className="flex flex-col gap-0.5">
      {items.map((q) => {
        const id = q.visitId ?? q.appointmentId;
        const on = id === selectedId;
        const sub = [
          showDoctor ? q.doctor?.name : t(`opd.visitType.${q.visitType}`),
          q.waitedMin != null
            ? t('opd.queue.waited', { time: fmtMinutes(q.waitedMin, t) })
            : q.slotTime
              ? t('opd.queue.slotAt', { time: q.slotTime })
              : null,
        ]
          .filter(Boolean)
          .join(' · ');
        const body = (
          <>
            <span className="w-14 shrink-0 font-mono text-sm font-semibold text-ink">
              {q.token ?? '-'}
            </span>
            <span className="min-w-0 flex-1">
              <strong className="block truncate font-semibold text-ink">{q.patient.name}</strong>
              <span className="block truncate text-sm text-muted">{sub}</span>
            </span>
            <span className="flex shrink-0 flex-col items-end gap-1">
              <StatusBadge
                tone={STAGE_TONE[q.stage] ?? 'neutral'}
                label={t(`opd.stage.${q.stage}`)}
              />
              {q.priority === 'RED' && (
                <StatusBadge tone={PRIORITY_TONE.RED} label={t('opd.priority.RED')} />
              )}
              {q.late && <StatusBadge tone="warning" label={t('opd.queue.late')} />}
            </span>
          </>
        );
        return (
          <li key={id}>
            {onPick ? (
              <button
                type="button"
                aria-current={on ? 'true' : undefined}
                onClick={() => onPick(q)}
                className={cn(
                  'flex w-full cursor-pointer items-center gap-3 rounded-control border-l-4 px-3 py-2 text-left text-base',
                  on ? 'border-primary bg-info-bg' : 'border-transparent hover:bg-surface-2',
                )}
              >
                {body}
              </button>
            ) : (
              <div className="flex items-center gap-3 border-l-4 border-transparent px-3 py-2 text-base">
                {body}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
