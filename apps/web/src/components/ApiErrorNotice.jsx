import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { ArrowRight } from 'lucide-react';
import { Banner, Conflict409, ErrorState } from '@hms/ui';
import { apiError } from '../app/apiError.js';

/** 409 codes that describe the record's state; the server message says what to do. */
const STATE_CODES = new Set([
  'APPROVAL_CLOSED',
  'APPROVAL_ALREADY_PENDING',
  'INVALID_STATE',
  'SUPER_ADMIN_LIMIT',
  'LAST_SUPER_ADMIN',
  'SYSTEM_ROLE',
  'IDEMPOTENCY_IN_PROGRESS',
]);

/** "Move these first" style 409s, with one detail per blocker. */
const BLOCKER_CODES = new Set(['DEPARTMENT_IN_USE', 'BRANCH_IN_USE', 'ROLE_IN_USE']);

/**
 * The right notice for a failed write: 409 conflict (reload and merge), 402 plan limit (link to
 * Subscription), blockers as a list, 403 with the reason, other 409s and 422s with the server's
 * message, and anything else as an error with its support code. Pass a raw RTK Query error or
 * the output of apiError()/applyFieldErrors().
 */
export function ApiErrorNotice({ error, onReload, title, className }) {
  const { t } = useTranslation();
  const e = error && 'code' in error && 'details' in error ? error : apiError(error);
  if (!e) return null;
  const details = e.details?.filter((d) => d?.message) ?? [];
  const list = details.length > 0 && (
    <ul className="mt-1 list-disc pl-5">
      {details.map((d, i) => (
        <li key={`${d.path}-${i}`}>{d.message}</li>
      ))}
    </ul>
  );

  if (e.code === 'VERSION_CONFLICT')
    return <Conflict409 className={className} onReload={onReload} />;
  if (e.code === 'LIMIT_REACHED') {
    return (
      <Banner
        tone="warning"
        role="alert"
        title={t('errors.limitTitle')}
        className={className}
        action={
          <Link
            to="/settings/subscription"
            className="inline-flex min-h-8 items-center gap-1 text-sm font-semibold underline underline-offset-2"
          >
            {t('errors.limitAction')}
            <ArrowRight size={14} aria-hidden="true" />
          </Link>
        }
      >
        {e.message}
      </Banner>
    );
  }
  if (BLOCKER_CODES.has(e.code)) {
    return (
      <Banner tone="warning" role="alert" title={t('errors.blockedTitle')} className={className}>
        <span className="block">{e.message}</span>
        {list}
      </Banner>
    );
  }
  if (e.status === 403) {
    return (
      <Banner tone="critical" role="alert" title={t('errors.forbiddenTitle')} className={className}>
        {e.message || t('states.forbiddenBodyGeneric')}
      </Banner>
    );
  }
  if (STATE_CODES.has(e.code) || e.status === 409 || e.status === 410) {
    return (
      <Banner tone="warning" role="alert" title={title} className={className}>
        {e.message}
        {list}
      </Banner>
    );
  }
  if (e.status === 422 || e.code === 'VALIDATION_FAILED' || e.code === 'IMPORT_HAS_ERRORS') {
    return (
      <Banner
        tone="critical"
        role="alert"
        title={title ?? t('errors.checkForm')}
        className={className}
      >
        {e.message && <span className="block">{e.message}</span>}
        {list}
      </Banner>
    );
  }
  if (e.code === 'NETWORK') {
    return (
      <ErrorState
        className={className}
        title={title ?? t('errors.saveFailed')}
        message={t('errors.network')}
      />
    );
  }
  return (
    <ErrorState
      className={className}
      title={title ?? t('errors.saveFailed')}
      message={e.message || t('states.errorBody')}
      requestId={e.requestId}
    />
  );
}
