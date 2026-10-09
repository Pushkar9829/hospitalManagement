import { apiError } from '../../app/apiError.js';

/**
 * Turns a sign-in API error into what the form shows: field errors (422 details) and one
 * form-level message. 401 never says whether the username exists.
 */
export function describeLoginError(err, t, { invalidKey = 'login.invalidCredentials' } = {}) {
  const e = apiError(err);
  if (!e) return null;
  const host = globalThis.location?.host ?? '';
  const support = e.requestId ? t('login.supportCode', { requestId: e.requestId }) : null;
  switch (e.code) {
    case 'VALIDATION_FAILED':
      return { fields: e.details, message: e.details.length ? null : e.message };
    case 'INVALID_CREDENTIALS':
    case 'UNAUTHENTICATED':
    case 'TOKEN_INVALID':
      return { message: t(invalidKey) };
    case 'ACCOUNT_LOCKED':
      // The server's message says for how many minutes.
      return { title: t('login.locked'), message: e.message };
    case 'RATE_LIMITED':
      return { message: t('login.rateLimited') };
    case 'TENANT_SUSPENDED':
      return { message: t('login.tenantSuspended') };
    case 'TENANT_NOT_FOUND':
      return { message: t('login.tenantNotFound', { host }) };
    default:
      return { message: t('login.failed'), detail: support };
  }
}
