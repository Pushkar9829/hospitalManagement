import { useTranslation } from 'react-i18next';
import { ArrowRight, Check, Clock, OctagonAlert, UserRound } from 'lucide-react';
import { cn, formatDateTime, toneClass } from '@hms/ui';

/** One level's state: decided, the current one, or still to come (or never reached). */
function levelState(request, i) {
  const level = request.levels[i];
  if (level.decision === 'APPROVE') return 'approved';
  if (level.decision === 'REJECT') return 'rejected';
  if (request.status === 'PENDING' && i === request.levelIndex) return 'current';
  return request.status === 'PENDING' ? 'waiting' : 'skipped';
}

const LOOK = {
  approved: { tone: 'success', Icon: Check },
  rejected: { tone: 'critical', Icon: OctagonAlert },
  current: { tone: 'warning', Icon: Clock },
  waiting: { tone: 'neutral', Icon: Clock },
  skipped: { tone: 'neutral', Icon: null },
};

/**
 * Approval path (design board "Approvals"): Maker → L1 Billing Manager ✓ → L2 Super Admin
 * pending. Each step has colour, a text state and an icon; decisions list who, when and the
 * comment.
 */
export function ApprovalPath({ request }) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'hi' ? 'hi-IN' : 'en-IN';
  const decided = request.levels.map((l, i) => ({ ...l, i })).filter((l) => l.decision);
  return (
    <div className="flex flex-col gap-3">
      <ol aria-label={t('approvals.path')} className="flex flex-wrap items-center gap-x-2 gap-y-2">
        <li className="flex items-center gap-2">
          <span
            className={cn(
              'inline-flex items-center gap-1.5 rounded-chip px-2 py-0.5 text-sm font-semibold',
              toneClass('neutral'),
            )}
          >
            <UserRound size={13} aria-hidden="true" />
            {t('approvals.maker', { name: request.makerName })}
          </span>
        </li>
        {request.levels.map((l, i) => {
          const state = levelState(request, i);
          const { tone, Icon } = LOOK[state];
          return (
            <li
              key={`${l.permission}-${i}`}
              className="flex items-center gap-2"
              aria-current={state === 'current' ? 'step' : undefined}
            >
              <ArrowRight size={14} aria-hidden="true" className="text-muted" />
              <span
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-chip px-2 py-0.5 text-sm font-semibold',
                  toneClass(tone),
                )}
              >
                {Icon && <Icon size={13} strokeWidth={2.5} aria-hidden="true" />}
                {t('approvals.levelChip', {
                  n: i + 1,
                  label: l.label,
                  state: t(`approvals.levelState.${state}`),
                })}
              </span>
            </li>
          );
        })}
      </ol>
      {decided.length > 0 && (
        <ul className="flex flex-col gap-2">
          {decided.map((l) => (
            <li
              key={l.i}
              className="rounded-control border border-line bg-surface-2 px-3 py-2 text-sm"
            >
              <p className="text-ink">
                <span className="font-semibold">
                  {t(l.decision === 'APPROVE' ? 'approvals.approvedBy' : 'approvals.rejectedBy', {
                    n: l.i + 1,
                    name: l.decidedBy ?? '-',
                  })}
                </span>{' '}
                <span className="text-muted">{formatDateTime(l.at, locale)}</span>
              </p>
              {l.comment && <p className="mt-0.5 text-ink">“{l.comment}”</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
