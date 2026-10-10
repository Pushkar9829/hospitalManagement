import { useMemo } from 'react';
import { PenLine } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '../lib/cn.js';
import { diffRows } from './diff.js';

function Value({ value }) {
  const { t } = useTranslation();
  if (value === undefined || value === null || value === '') {
    return (
      <span className="text-muted">
        <span aria-hidden="true">-</span>
        <span className="sr-only">{t('diff.empty')}</span>
      </span>
    );
  }
  if (typeof value === 'boolean') return t(value ? 'common.yes' : 'common.no');
  if (typeof value === 'object') {
    return (
      <pre className="max-w-full font-mono text-sm break-words whitespace-pre-wrap">
        {JSON.stringify(value, null, 2)}
      </pre>
    );
  }
  return <span className="break-words">{String(value)}</span>;
}

/**
 * Before/after table for approval requests and audit entries. Nested fields are shown as dot
 * paths, objects and lists as pretty-printed JSON. A changed value is marked three ways: tinted
 * cell, bold text and a pencil icon (with "changed" for screen readers), never by colour alone.
 * `labels` maps a field path to a readable name; unknown fields show their path. `omit` lists
 * paths to leave out (record ids, versions).
 */
export function DiffTable({
  before,
  after,
  labels = {},
  beforeLabel,
  afterLabel,
  caption,
  omit,
  onlyChanged = false,
  className,
}) {
  const { t } = useTranslation();
  const rows = useMemo(() => {
    const all = diffRows(before, after, { omit });
    return onlyChanged ? all.filter((r) => r.changed) : all;
  }, [before, after, omit, onlyChanged]);

  if (!rows.length) return <p className="text-base text-muted">{t('diff.none')}</p>;

  return (
    <div className={cn('overflow-x-auto rounded-card border border-line', className)}>
      <table className="w-full border-collapse text-left text-base">
        {caption && <caption className="sr-only">{caption}</caption>}
        <thead>
          <tr className="bg-surface-2 text-sm text-muted">
            <th scope="col" className="w-1/3 border-b border-line px-3 py-2 font-semibold">
              {t('diff.field')}
            </th>
            <th scope="col" className="border-b border-line px-3 py-2 font-semibold">
              {beforeLabel ?? t('diff.before')}
            </th>
            <th scope="col" className="border-b border-line px-3 py-2 font-semibold">
              {afterLabel ?? t('diff.after')}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key} className="border-b border-line align-top last:border-b-0">
              <th scope="row" className="px-3 py-2 font-normal break-words text-ink">
                {labels[r.key] ?? <code className="font-mono text-sm">{r.key}</code>}
              </th>
              <td className="px-3 py-2 text-ink">
                <Value value={r.before} />
              </td>
              <td className={cn('px-3 py-2 text-ink', r.changed && 'bg-warning-bg font-semibold')}>
                <span className="flex items-start gap-1.5">
                  {r.changed && (
                    <PenLine size={13} aria-hidden="true" className="mt-1 shrink-0 text-warning" />
                  )}
                  <span className="min-w-0">
                    <Value value={r.after} />
                    {r.changed && <span className="sr-only"> ({t('diff.changed')})</span>}
                  </span>
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
