import { StatusBadge, cn } from '@hms/ui';

/**
 * The work list on the left of a list-and-detail screen. Each row is a button (Tab and Enter
 * pick it); the open row is marked with aria-current and a tinted background, never colour
 * alone (a bar on the left as well).
 * items: [{ id, title, sub, mono, badge: { tone, label }, lead }]
 */
export function PickList({ items, selectedId, onPick, label, className }) {
  return (
    <ul aria-label={label} className={cn('flex flex-col gap-0.5', className)}>
      {items.map((it) => {
        const on = it.id === selectedId;
        return (
          <li key={it.id}>
            <button
              type="button"
              aria-current={on ? 'true' : undefined}
              onClick={() => onPick(it.id)}
              className={cn(
                'flex w-full cursor-pointer items-center gap-3 rounded-control border-l-4 px-3 py-2.5 text-left text-base transition-colors',
                on ? 'border-primary bg-info-bg' : 'border-transparent hover:bg-surface-2',
              )}
            >
              {it.lead && <span className="w-28 shrink-0 font-mono text-sm">{it.lead}</span>}
              <span className="min-w-0 flex-1">
                <strong className="block truncate font-semibold text-ink">{it.title}</strong>
                {it.sub && <span className="block truncate text-sm text-muted">{it.sub}</span>}
              </span>
              {it.badge && (
                <StatusBadge tone={it.badge.tone} label={it.badge.label} className="shrink-0" />
              )}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
