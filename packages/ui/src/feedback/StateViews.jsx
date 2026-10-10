import { Cable, Clock, FileQuestion, Lock, PackagePlus, RefreshCw, WifiOff } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '../lib/cn.js';
import { Button } from '../primitives/Button.jsx';
import { Dialog } from '../primitives/Dialog.jsx';
import { Skeleton } from '../data/Skeleton.jsx';
import { EmptyState } from '../data/EmptyState.jsx';
import { Banner } from './Banner.jsx';

/*
 * The screen states every page must handle (design board "States"), plus 409 conflict, device
 * not connected and 404. Each takes the specific object or permission so the message is useful.
 */

function StatePanel({ icon: Icon, title, children, actions, className, headingLevel = 2 }) {
  const H = `h${headingLevel}`;
  return (
    <section
      className={cn(
        'mx-auto flex w-full max-w-lg flex-col items-center gap-2 rounded-card border border-line bg-surface px-6 py-8 text-center shadow-card',
        className,
      )}
    >
      {Icon && <Icon aria-hidden="true" size={32} strokeWidth={1.5} className="mb-1 text-muted" />}
      <H className="text-lg font-semibold text-ink">{title}</H>
      <div className="max-w-prose text-base text-muted">{children}</div>
      {actions && <div className="mt-3 flex flex-wrap justify-center gap-2">{actions}</div>}
    </section>
  );
}

/** 1 · Empty. Say what will appear and offer the next action. */
export const Empty = EmptyState;

/** 2 · Loading: skeleton blocks in the real layout, not a full-page spinner. */
export function Loading({ rows = 3, label, className }) {
  const { t } = useTranslation();
  return (
    <div role="status" aria-live="polite" className={cn('flex flex-col gap-3', className)}>
      <span className="sr-only">{label ?? t('states.loading')}</span>
      <Skeleton className="h-3 w-1/2" />
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-10 w-full" />
      ))}
    </div>
  );
}

/** 3 · Error (500 / network). Always shows the requestId; unsaved input is kept. */
export function ErrorState({ title, message, requestId, onRetry, retrying = false, className }) {
  const { t } = useTranslation();
  return (
    <div className={cn('flex flex-col items-start gap-3', className)}>
      <div
        role="alert"
        className="w-full rounded-card bg-critical-bg px-4 py-3 text-base text-critical"
      >
        <p className="font-semibold">{title ?? t('states.errorTitle')}</p>
        <p>
          {message ?? t('states.errorBody')}
          {requestId && (
            <>
              {' '}
              {t('states.errorCode')} <code className="font-mono">{requestId}</code>
            </>
          )}
        </p>
      </div>
      {onRetry && (
        <Button
          variant="secondary"
          onClick={onRetry}
          loading={retrying}
          icon={<RefreshCw size={16} aria-hidden="true" />}
        >
          {t('common.tryAgain')}
        </Button>
      )}
    </div>
  );
}

/** 4 · No permission (403). Names the missing permission. */
export function Forbidden403({ screen, permission, onBack, backLabel, className }) {
  const { t } = useTranslation();
  return (
    <StatePanel
      icon={Lock}
      className={className}
      title={t('states.forbiddenTitle', { screen })}
      actions={
        onBack && (
          <Button variant="secondary" onClick={onBack}>
            {backLabel ?? t('common.backToHome')}
          </Button>
        )
      }
    >
      {permission ? (
        <p>
          {t('states.forbiddenBody', { permission: '\u0000' })
            .split('\u0000')
            .flatMap((part, i) =>
              i === 0
                ? [part]
                : [
                    <code key={i} className="font-mono text-ink">
                      {permission}
                    </code>,
                    part,
                  ],
            )}
        </p>
      ) : (
        <p>{t('states.forbiddenBodyGeneric')}</p>
      )}
    </StatePanel>
  );
}

/** 5 · Module not subscribed (402). Only Super Admins see "Add module". */
export function NotSubscribed402({ module, canAdd = false, onAdd, onBack, className }) {
  const { t } = useTranslation();
  return (
    <StatePanel
      icon={PackagePlus}
      className={className}
      title={t('states.notSubscribedTitle', { module })}
      actions={
        <>
          {canAdd && onAdd && <Button onClick={onAdd}>{t('states.addModule')}</Button>}
          {onBack && (
            <Button variant="secondary" onClick={onBack}>
              {canAdd ? t('common.notNow') : t('common.backToHome')}
            </Button>
          )}
        </>
      }
    >
      <p>{canAdd ? t('states.notSubscribedAdmin') : t('states.notSubscribedStaff')}</p>
    </StatePanel>
  );
}

/** 6 · Subscription banners: payment failed, read-only. Sits above the page header. */
export function SubscriptionBanner({ variant = 'paymentFailed', days = 7, onFix, className }) {
  const { t } = useTranslation();
  if (variant === 'readOnly') {
    return (
      <Banner tone="critical" title={t('states.readOnlyTitle')} className={className}>
        {t('states.readOnlyBody')}
      </Banner>
    );
  }
  return (
    <Banner tone="warning" title={t('states.paymentFailedTitle')} className={className}>
      {t('states.paymentFailedBody', { count: days })}{' '}
      {onFix && (
        <button
          type="button"
          onClick={onFix}
          className="cursor-pointer font-semibold underline underline-offset-2"
        >
          {t('states.fixNow')}
        </button>
      )}
    </Banner>
  );
}

/** 8 · Waiting for approval (202). Says where the request is waiting. */
export function PendingApproval202({ approver, title, className, children }) {
  const { t } = useTranslation();
  return (
    <Banner
      tone="warning"
      icon={Clock}
      role="status"
      title={title ?? t('states.pendingTitle')}
      className={className}
    >
      {children ??
        (approver ? t('states.pendingBody', { approver }) : t('states.pendingBodyGeneric'))}
    </Banner>
  );
}

function SessionExpiredBody({ message, onSignIn }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col items-start gap-4">
      {message && <p className="text-base text-ink">{message}</p>}
      <p className="text-base text-muted">{t('states.sessionExpiredBody')}</p>
      <Button onClick={onSignIn}>{t('states.signInAgain')}</Button>
    </div>
  );
}

/**
 * 10 · Session expired. As a dialog (`dialog`), it covers the page without unmounting it, so the
 * form underneath and its draft stay intact. `message` is the server's own explanation, when it
 * gave one (e.g. "You were signed out after 15 minutes without activity").
 */
export function SessionExpired({ minutes, message, onSignIn, dialog = false, className }) {
  const { t } = useTranslation();
  const title = minutes
    ? t('states.sessionExpiredTitle', { minutes })
    : t('states.sessionExpiredTitleGeneric');
  if (dialog) {
    return (
      <Dialog open onOpenChange={() => {}} title={title} hideClose size="sm" role="alertdialog">
        <SessionExpiredBody message={message} onSignIn={onSignIn} />
      </Dialog>
    );
  }
  return (
    <section
      className={cn(
        'w-full max-w-lg rounded-card border border-line bg-surface px-6 py-5 shadow-card',
        className,
      )}
    >
      <h2 className="mb-2 text-lg font-semibold text-ink">{title}</h2>
      <SessionExpiredBody message={message} onSignIn={onSignIn} />
    </section>
  );
}

/** 11 · Offline or slow network. */
export function Offline({ className, children }) {
  const { t } = useTranslation();
  return (
    <Banner
      tone="neutral"
      icon={WifiOff}
      role="status"
      title={t('states.offlineTitle')}
      className={className}
    >
      {children ?? t('states.offlineBody')}
    </Banner>
  );
}

/** 409 · Someone else changed the record. Reload keeps the user's draft. */
export function Conflict409({ by, at, onReload, className }) {
  const { t } = useTranslation();
  return (
    <Banner
      tone="warning"
      role="alert"
      title={t('states.conflictTitle')}
      className={className}
      action={
        onReload && (
          <Button
            size="sm"
            variant="secondary"
            onClick={onReload}
            icon={<RefreshCw size={14} aria-hidden="true" />}
          >
            {t('common.reload')}
          </Button>
        )
      }
    >
      <span className="block">{t('states.conflictBody')}</span>
      {by && at && <span className="block">{t('states.conflictBy', { name: by, time: at })}</span>}
    </Banner>
  );
}

/** A scanner, printer, analyser or other device the screen needs is not reachable. */
export function DeviceNotConnected({ device, onRetry, help, className }) {
  const { t } = useTranslation();
  return (
    <StatePanel
      icon={Cable}
      className={className}
      title={t('states.deviceTitle', { device })}
      actions={
        onRetry && (
          <Button
            variant="secondary"
            onClick={onRetry}
            icon={<RefreshCw size={16} aria-hidden="true" />}
          >
            {t('common.tryAgain')}
          </Button>
        )
      }
    >
      <p>{help ?? t('states.deviceBody')}</p>
    </StatePanel>
  );
}

/** 404 · Unknown route. */
export function NotFound404({ onHome, className }) {
  const { t } = useTranslation();
  return (
    <StatePanel
      icon={FileQuestion}
      headingLevel={1}
      className={className}
      title={t('states.notFoundTitle')}
      actions={onHome && <Button onClick={onHome}>{t('common.backToHome')}</Button>}
    >
      <p>{t('states.notFoundBody')}</p>
    </StatePanel>
  );
}
