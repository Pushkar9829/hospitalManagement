import { useTranslation } from 'react-i18next';
import { addDxkitStrings } from '@hms/i18n/dxkit';
import { EmptyState, ErrorState, Loading } from '@hms/ui';
import { apiError } from '../../app/apiError.js';
import { useStrings } from '../../lib/useStrings.js';

/**
 * Loading, error and empty states for one query result. `children(data)` renders the content.
 * `isEmpty(data)` decides when to show `empty` (a title string or an element).
 */
export function QueryView({ query, children, errorTitle, empty, isEmpty, emptyIcon, rows = 3 }) {
  useStrings(addDxkitStrings);
  const { t } = useTranslation();
  const { data, isLoading, isError, error, refetch, isFetching } = query;
  // A query that has not run yet (skipped while its input loads) has no data either.
  if (isLoading || (data === undefined && !isError)) return <Loading rows={rows} />;
  if (isError)
    return (
      <ErrorState
        title={errorTitle ?? t('dxkit.loadFailed')}
        message={apiError(error)?.message || undefined}
        requestId={apiError(error)?.requestId}
        onRetry={refetch}
        retrying={isFetching}
      />
    );
  if (empty && isEmpty?.(data))
    return typeof empty === 'string' ? <EmptyState icon={emptyIcon} title={empty} /> : empty;
  return children(data);
}
