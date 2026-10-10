import { useTranslation } from 'react-i18next';
import { cn } from '@hms/ui';

/** Usage against the plan's limits (users, branches, beds): bar, numbers and words, never colour alone. */
export function UsageBars({ usage = {}, limits = {} }) {
  const { t } = useTranslation();
  const keys = ['users', 'branches', 'beds'].filter((k) => limits[k] != null);
  return (
    <ul className="flex flex-col gap-4">
      {keys.map((k) => {
        const used = usage[k] ?? 0;
        const limit = limits[k];
        const pct = limit ? Math.min(100, Math.round((used / limit) * 100)) : 0;
        const tone = pct >= 100 ? 'bg-critical' : pct >= 80 ? 'bg-warning' : 'bg-primary';
        const label = t(`subscription.usage.${k}`);
        return (
          <li key={k} className="flex flex-col gap-1.5">
            <div className="flex items-baseline justify-between gap-3 text-base">
              <span id={`usage-${k}`} className="font-medium text-ink">
                {label}
              </span>
              <span className="tabular text-sm text-muted">
                {t('subscription.usage.of', { used, limit })}
                {pct >= 100
                  ? ` · ${t('subscription.usage.full')}`
                  : pct >= 80
                    ? ` · ${t('subscription.usage.near')}`
                    : ''}
              </span>
            </div>
            <div
              role="progressbar"
              aria-labelledby={`usage-${k}`}
              aria-valuemin={0}
              aria-valuemax={limit}
              aria-valuenow={used}
              aria-valuetext={t('subscription.usage.of', { used, limit })}
              className="h-2.5 overflow-hidden rounded-full bg-neutral-bg"
            >
              <div className={cn('h-full rounded-full', tone)} style={{ width: `${pct}%` }} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
