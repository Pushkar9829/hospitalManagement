/**
 * Normalises an RTK Query error into { status, code, message, details, requestId }.
 * API errors are `{ error: { code, message, details?, requestId } }`; network errors get the code
 * NETWORK.
 */
export function apiError(err) {
  if (!err) return null;
  const status = err.status ?? err.originalStatus;
  const body = err.data?.error;
  if (body) {
    return {
      status,
      code: body.code ?? 'UNKNOWN',
      message: body.message ?? '',
      details: Array.isArray(body.details) ? body.details : [],
      requestId: body.requestId ?? null,
    };
  }
  if (status === 'FETCH_ERROR' || status === 'TIMEOUT_ERROR') {
    return { status, code: 'NETWORK', message: '', details: [], requestId: null };
  }
  return {
    status,
    code: typeof status === 'number' ? `HTTP_${status}` : 'UNKNOWN',
    message: '',
    details: [],
    requestId: null,
  };
}
