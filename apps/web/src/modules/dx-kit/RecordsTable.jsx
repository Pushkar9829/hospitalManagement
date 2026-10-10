import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { addDxkitStrings } from '@hms/i18n/dxkit';
import { DataTable, EmptyState, ErrorState } from '@hms/ui';
import { apiError } from '../../app/apiError.js';
import { useStrings } from '../../lib/useStrings.js';
import { useUrlState } from '../../lib/useUrlState.js';

/**
 * A server-paged list (`{ items, total, page, limit }`) in a DataTable: the page is kept in the
 * URL, loading shows skeleton rows, an error offers a retry, an empty list says what will appear.
 * `selected` (a Set of ids) with `onSelectedChange` adds a checkbox column for bulk actions.
 */
export function RecordsTable({
  useQuery,
  args = {},
  columns,
  caption,
  emptyTitle,
  emptyDescription,
  emptyIcon,
  errorTitle,
  onRowClick,
  selected,
  onSelectedChange,
  limit = 25,
  density,
  skip = false,
}) {
  useStrings(addDxkitStrings);
  const { t } = useTranslation();
  const [pageText, setPage] = useUrlState('page', '1');
  const page = Math.max(1, Number(pageText) || 1);
  const { data, isLoading, isFetching, isError, error, refetch } = useQuery(
    { ...args, page, limit },
    { skip },
  );
  const items = useMemo(() => data?.items ?? [], [data]);
  const selectable = Boolean(selected && onSelectedChange);
  const cols = useMemo(() => {
    if (!selectable) return columns;
    const allIds = items.filter((r) => r.selectable !== false).map((r) => r.id);
    const all = allIds.length > 0 && allIds.every((id) => selected.has(id));
    return [
      {
        id: '_select',
        header: () => (
          <input
            type="checkbox"
            aria-label={t('dxkit.selectAll')}
            className="size-[18px] cursor-pointer accent-primary"
            checked={all}
            onChange={() => onSelectedChange(new Set(all ? [] : allIds))}
          />
        ),
        meta: { className: 'w-10' },
        cell: ({ row }) =>
          row.original.selectable === false ? null : (
            <input
              type="checkbox"
              aria-label={t('dxkit.selectRow', { id: row.original.no ?? row.original.id })}
              className="size-[18px] cursor-pointer accent-primary"
              checked={selected.has(row.original.id)}
              onClick={(e) => e.stopPropagation()}
              onChange={() => {
                const next = new Set(selected);
                if (next.has(row.original.id)) next.delete(row.original.id);
                else next.add(row.original.id);
                onSelectedChange(next);
              }}
            />
          ),
      },
      ...columns,
    ];
  }, [selectable, columns, items, selected, onSelectedChange, t]);

  if (isError)
    return (
      <ErrorState
        title={errorTitle ?? t('dxkit.loadFailed')}
        requestId={apiError(error)?.requestId}
        onRetry={refetch}
      />
    );
  return (
    <DataTable
      columns={cols}
      data={items}
      total={data?.total}
      page={page}
      limit={limit}
      onPageChange={(p) => setPage(String(p))}
      loading={isLoading || (isFetching && !items.length)}
      caption={caption}
      onRowClick={onRowClick}
      density={density}
      empty={
        <EmptyState
          icon={emptyIcon}
          bordered={false}
          title={emptyTitle ?? t('dxkit.empty')}
          description={emptyDescription}
        />
      }
    />
  );
}
