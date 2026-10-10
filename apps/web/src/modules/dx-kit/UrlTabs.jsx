import { Tabs, TabsContent, TabsList, TabsTrigger, cn } from '@hms/ui';
import { useUrlState } from '../../lib/useUrlState.js';

/**
 * Section tabs kept in the URL (`?tab=`), so a reload or a shared link opens the same section.
 * `tabs`: [{ id, label, count?, body }] (falsy entries are skipped, e.g. a tab the role cannot
 * see). Changing tab clears the per-tab parameters (`page`, `id`, `q` and `reset`). Only the
 * active tab's body is mounted.
 */
export function UrlTabs({ tabs, label, param = 'tab', reset = [], className }) {
  const visible = tabs.filter(Boolean);
  const [tab, setTab] = useUrlState(param, visible[0]?.id ?? '');
  const current = visible.some((x) => x.id === tab) ? tab : visible[0]?.id;
  if (!visible.length) return null;
  return (
    <Tabs
      value={current}
      onValueChange={(v) => setTab(v, { reset: ['page', 'id', 'q', 'status', ...reset] })}
      className={className}
    >
      <TabsList aria-label={label}>
        {visible.map((x) => (
          <TabsTrigger key={x.id} value={x.id}>
            {x.label}
            {x.count != null && (
              <span
                className={cn(
                  'tabular inline-flex min-w-6 items-center justify-center rounded-chip px-1.5 text-xs font-semibold',
                  x.countTone === 'critical'
                    ? 'bg-critical-bg text-critical'
                    : 'bg-neutral-bg text-neutral',
                )}
              >
                {x.count}
              </span>
            )}
          </TabsTrigger>
        ))}
      </TabsList>
      {visible.map((x) => (
        <TabsContent key={x.id} value={x.id}>
          {current === x.id && x.body}
        </TabsContent>
      ))}
    </Tabs>
  );
}
