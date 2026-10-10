import { cn } from '@hms/ui';

/**
 * Horizontal bars with the value written at the end (no chart library): one row per item,
 * the longest bar is the largest value. items: [{ label, value, text }].
 */
export function BarList({ items, label, tone = 'primary', className }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <ul aria-label={label} className={cn('flex flex-col gap-3', className)}>
      {items.map((i) => (
        <li key={i.label} className="flex flex-col gap-1">
          <div className="flex items-baseline justify-between gap-3 text-base">
            <span className="text-ink">{i.label}</span>
            <span className="tabular font-semibold text-ink">{i.text ?? i.value}</span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-chip bg-neutral-bg" aria-hidden="true">
            <div
              className={cn('h-full rounded-chip', tone === 'accent' ? 'bg-accent' : 'bg-primary')}
              style={{ width: `${Math.max(2, Math.round((i.value / max) * 100))}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
