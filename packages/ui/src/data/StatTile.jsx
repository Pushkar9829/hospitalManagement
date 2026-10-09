import { cn } from '../lib/cn.js';

const trendTone = {
  success: 'text-success',
  warning: 'text-warning',
  critical: 'text-critical',
  neutral: 'text-muted',
  info: 'text-info',
};

/** One number with its label and context ("of 120 beds", "Up 12% vs last Thursday"). */
export function StatTile({ label, value, sub, subTone = 'neutral', loading = false, className }) {
  return (
    <div
      className={cn(
        'rounded-card border border-line bg-surface px-4 py-3.5 shadow-card',
        className,
      )}
      aria-busy={loading || undefined}
    >
      <p className="text-sm text-muted">{label}</p>
      {loading ? (
        <div
          aria-hidden="true"
          className="mt-2 h-8 w-20 animate-shimmer rounded-control bg-skeleton"
        />
      ) : (
        <p className="tabular mt-1 text-2xl font-semibold text-ink">{value}</p>
      )}
      {sub && (
        <p className={cn('mt-0.5 text-sm', trendTone[subTone] ?? trendTone.neutral)}>{sub}</p>
      )}
    </div>
  );
}
