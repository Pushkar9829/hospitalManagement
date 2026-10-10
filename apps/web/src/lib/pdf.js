import { useCallback } from 'react';
import { useStore } from 'react-redux';
import { baseQueryWithReauth } from '../app/baseApi.js';

/**
 * Fetches a PDF from the API as a Blob through the app's base query, so it carries the branch
 * header and refreshes an expired session like any other call. The Blob never enters the Redux
 * store. Resolves { blob } or { error } (an RTK Query error, for ApiErrorNotice).
 *
 *   const fetchPdf = usePdfFetch();
 *   const { blob, error } = await fetchPdf('/billing/bills/42/pdf', { reason: 'Patient copy lost' });
 */
export function usePdfFetch() {
  const store = useStore();
  return useCallback(
    async (url, params) => {
      const controller = new AbortController();
      const api = {
        signal: controller.signal,
        abort: () => controller.abort(),
        dispatch: store.dispatch,
        getState: store.getState,
        extra: undefined,
        endpoint: 'pdf',
        type: 'query',
      };
      const result = await baseQueryWithReauth(
        {
          url,
          params,
          headers: { Accept: 'application/pdf' },
          responseHandler: (res) => (res.ok ? res.blob() : res.json().catch(() => null)),
        },
        api,
        {},
      );
      return result.error ? { error: result.error } : { blob: result.data };
    },
    [store],
  );
}

/** A file name for a document number: OP/26-27/000154 -> OP-26-27-000154.pdf */
export const pdfName = (number) => `${String(number ?? 'document').replace(/[^\w-]+/g, '-')}.pdf`;
