import { flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '../lib/cn.js';
import { Skeleton } from './Skeleton.jsx';
import { Pagination } from './Pagination.jsx';
import { nextSort, parseSort } from './sort.js';

const density = {
  comfortable: 'px-3 py-3',
  compact: 'px-3 py-1.5',
};

/**
 * Server-driven table (TanStack Table): the API pages and sorts (`?page=&limit=&sort=-field`),
 * the table only shows a page and reports clicks.
 *
 * Columns are TanStack column defs. Opt in to sorting with `enableSorting: true`; set
 * `meta: { align: 'right', mono: true, className }` for alignment, IDs and numbers.
 * Rows open with a click or with Enter when `onRowClick` is set.
 */
export function DataTable({
  columns,
  data = [],
  total,
  page = 1,
  limit = 25,
  onPageChange,
  sort,
  onSortChange,
  loading = false,
  empty,
  onRowClick,
  density: densityKey = 'comfortable',
  caption,
  getRowId,
  maxHeight,
  className,
}) {
  const { t } = useTranslation();
  const sorting = parseSort(sort);
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualSorting: true,
    manualPagination: true,
    state: { sorting: sorting ? [sorting] : [] },
    getRowId: getRowId ?? ((row, i) => String(row.id ?? row._id ?? i)),
  });
  const cellPad = density[densityKey] ?? density.comfortable;
  const headerGroups = table.getHeaderGroups();
  const colCount = table.getVisibleLeafColumns().length;
  const rows = table.getRowModel().rows;
  const showEmpty = !loading && rows.length === 0;
  const skeletonRows = Math.min(limit, 6);

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <div
        className="overflow-auto rounded-card border border-line bg-surface"
        style={maxHeight ? { maxHeight } : undefined}
      >
        <table
          className="w-full border-collapse text-left text-base"
          aria-busy={loading || undefined}
        >
          {caption && <caption className="sr-only">{caption}</caption>}
          <thead>
            {headerGroups.map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((header) => {
                  const def = header.column.columnDef;
                  const sortable = def.enableSorting === true && Boolean(onSortChange);
                  const active = sorting?.id === header.column.id ? sorting : null;
                  const label = header.isPlaceholder
                    ? null
                    : flexRender(def.header, header.getContext());
                  const title = typeof def.header === 'string' ? def.header : header.column.id;
                  return (
                    <th
                      key={header.id}
                      scope="col"
                      aria-sort={
                        active
                          ? active.desc
                            ? 'descending'
                            : 'ascending'
                          : sortable
                            ? 'none'
                            : undefined
                      }
                      style={def.size && def.size !== 150 ? { width: def.size } : undefined}
                      className={cn(
                        'sticky top-0 z-[1] border-b border-line bg-surface-2 text-sm font-semibold whitespace-nowrap text-muted',
                        sortable ? 'p-0' : cellPad,
                        def.meta?.align === 'right' && 'text-right',
                      )}
                    >
                      {sortable ? (
                        <button
                          type="button"
                          onClick={() => onSortChange(nextSort(sort, header.column.id))}
                          aria-label={t('table.sortBy', { column: title })}
                          className={cn(
                            'inline-flex w-full cursor-pointer items-center gap-1.5 hover:text-ink',
                            cellPad,
                            def.meta?.align === 'right' && 'justify-end',
                            active && 'text-ink',
                          )}
                        >
                          {label}
                          {active ? (
                            active.desc ? (
                              <ArrowDown size={14} aria-hidden="true" />
                            ) : (
                              <ArrowUp size={14} aria-hidden="true" />
                            )
                          ) : (
                            <ArrowUpDown size={14} aria-hidden="true" className="opacity-50" />
                          )}
                        </button>
                      ) : (
                        label
                      )}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {loading &&
              Array.from({ length: skeletonRows }, (_, r) => (
                <tr key={`sk${r}`} className="border-b border-line last:border-b-0">
                  {Array.from({ length: colCount }, (_, c) => (
                    <td key={c} className={cellPad}>
                      <Skeleton className="h-4 w-full max-w-40" />
                    </td>
                  ))}
                </tr>
              ))}
            {!loading &&
              rows.map((row) => (
                <tr
                  key={row.id}
                  tabIndex={onRowClick ? 0 : undefined}
                  onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                  onKeyDown={
                    onRowClick
                      ? (e) => {
                          if (e.key === 'Enter' && e.target === e.currentTarget) {
                            e.preventDefault();
                            onRowClick(row.original);
                          }
                        }
                      : undefined
                  }
                  className={cn(
                    'border-b border-line last:border-b-0',
                    onRowClick &&
                      'cursor-pointer hover:bg-surface-2 focus-visible:bg-surface-2 focus-visible:-outline-offset-2',
                  )}
                >
                  {row.getVisibleCells().map((cell) => {
                    const meta = cell.column.columnDef.meta;
                    return (
                      <td
                        key={cell.id}
                        className={cn(
                          cellPad,
                          'align-middle text-ink',
                          meta?.align === 'right' && 'tabular text-right',
                          meta?.mono && 'font-mono text-sm',
                          meta?.className,
                        )}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    );
                  })}
                </tr>
              ))}
            {showEmpty && (
              <tr>
                <td colSpan={colCount} className="p-4">
                  {empty}
                </td>
              </tr>
            )}
          </tbody>
        </table>
        {loading && <span className="sr-only">{t('table.loadingRows')}</span>}
      </div>
      {onPageChange && total != null && total > 0 && (
        <Pagination page={page} limit={limit} total={total} onPageChange={onPageChange} />
      )}
    </div>
  );
}
