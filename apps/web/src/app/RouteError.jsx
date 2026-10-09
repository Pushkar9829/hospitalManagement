import { useRouteError } from 'react-router';
import { ErrorState, Page } from '@hms/ui';

/** Last-resort boundary for a route that threw while rendering. */
export function RouteError() {
  const error = useRouteError();
  if (import.meta.env.DEV) console.error(error); // eslint-disable-line no-console
  return (
    <Page width="narrow">
      <ErrorState className="mt-8" onRetry={() => window.location.reload()} />
    </Page>
  );
}
