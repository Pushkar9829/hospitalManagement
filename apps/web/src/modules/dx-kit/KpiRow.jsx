import { StatTile, cn } from '@hms/ui';

/** A row of stat tiles: [{ label, value, sub, tone }]. Wraps to two columns on a tablet. */
export function KpiRow({ items = [], loading = false, className }) {
  const count = loading && !items.length ? 4 : items.length;
  const list = items.length ? items : Array.from({ length: count }, (_, i) => ({ label: '', i }));
  return (
    <div className={cn('grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5', className)}>
      {list.map((k, i) => (
        <StatTile
          key={k.label || i}
          label={k.label}
          value={k.value}
          sub={k.sub}
          subTone={k.tone}
          loading={loading}
        />
      ))}
    </div>
  );
}
