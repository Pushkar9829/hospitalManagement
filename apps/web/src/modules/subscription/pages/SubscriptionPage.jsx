import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CalendarClock, CreditCard } from 'lucide-react';
import { addAdminStrings } from '@hms/i18n/admin';
import { addSubscriptionStrings } from '@hms/i18n/subscription';
import {
  Banner,
  Button,
  Card,
  ErrorState,
  Loading,
  Page,
  PageHeader,
  StatusBadge,
  formatLongDate,
} from '@hms/ui';
import { apiError } from '../../../app/apiError.js';
import { useCan } from '../../../lib/useCan.js';
import { inr } from '../../../lib/money.js';
import { useStrings } from '../../../lib/useStrings.js';
import { useSubscriptionQuery } from '../api.js';
import { ConvertSheet } from '../components/ConvertSheet.jsx';
import { InvoicesCard } from '../components/InvoicesCard.jsx';
import { ModulesCard } from '../components/ModulesCard.jsx';
import { StatusBanner } from '../components/StatusBanner.jsx';
import { UsageBars } from '../components/UsageBars.jsx';

const STATUS_TONES = {
  TRIAL: 'info',
  ACTIVE: 'success',
  PAST_DUE: 'warning',
  READ_ONLY: 'critical',
  SUSPENDED: 'critical',
};

/**
 * Hospital subscription (design board "Subscription", spec 2.4, 3.4, 3.5): the state banner
 * (trial days left, payment due, read-only, suspended), plan and period, usage against limits,
 * modules with a live priced preview of a change, trial conversion and platform invoices.
 */
export default function SubscriptionPage() {
  useStrings(addAdminStrings, addSubscriptionStrings);
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'hi' ? 'hi-IN' : 'en-IN';
  const can = useCan();
  const canChange = can('settings:subscription:update');
  const { data: sub, isLoading, isError, error, refetch } = useSubscriptionQuery();
  const [converting, setConverting] = useState(false);
  const [invoice, setInvoice] = useState(null);
  const toInvoices = () =>
    document.getElementById('invoices')?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  if (isLoading)
    return (
      <Page>
        <Loading rows={6} />
      </Page>
    );
  if (isError)
    return (
      <Page width="medium">
        <ErrorState
          className="mt-8"
          title={t('subscription.failed')}
          requestId={apiError(error)?.requestId}
          onRetry={refetch}
        />
      </Page>
    );

  const period = sub.currentPeriod?.start
    ? t('subscription.plan.period', {
        start: formatLongDate(sub.currentPeriod.start, locale),
        end: formatLongDate(sub.currentPeriod.end, locale),
      })
    : t('subscription.plan.noPeriod');

  return (
    <Page>
      <PageHeader title={t('subscription.title')} description={t('subscription.description')} />
      <StatusBanner
        sub={sub}
        onChoosePlan={canChange && !sub.converted ? () => setConverting(true) : undefined}
        onInvoices={toInvoices}
      />
      {invoice && (
        <Banner
          tone="info"
          role="status"
          title={t('subscription.invoiceIssued', { number: invoice.number })}
          action={
            <Button size="sm" variant="secondary" onClick={toInvoices}>
              {t('subscription.banner.viewInvoice')}
            </Button>
          }
        >
          {t('subscription.invoiceIssuedBody', {
            amount: inr(invoice.total),
            date: invoice.dueAt ? formatLongDate(invoice.dueAt, locale) : '-',
          })}
        </Banner>
      )}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card
          title={t('subscription.plan.title')}
          headingLevel={2}
          actions={
            canChange &&
            !sub.converted && (
              <Button
                size="sm"
                icon={<CreditCard size={14} aria-hidden="true" />}
                onClick={() => setConverting(true)}
              >
                {t('subscription.convert.action')}
              </Button>
            )
          }
        >
          <div className="flex flex-col gap-3">
            <p className="flex flex-wrap items-center gap-2 text-xl font-semibold text-ink">
              {sub.planName}
              <StatusBadge
                tone={STATUS_TONES[sub.status] ?? 'neutral'}
                label={t(`subscription.status.${sub.status}`, { defaultValue: sub.status })}
              />
            </p>
            <p className="text-base text-muted">
              {t(`subscription.cycles.${sub.cycle}`, { defaultValue: sub.cycle })}
              {' · '}
              {sub.converted ? t('subscription.plan.paid') : t('subscription.plan.notConverted')}
            </p>
            <p className="flex items-center gap-2 text-base text-ink">
              <CalendarClock size={16} aria-hidden="true" className="text-muted" />
              {period}
            </p>
            {sub.pending?.length > 0 && (
              <div>
                <p className="text-sm font-semibold text-ink">{t('subscription.plan.pending')}</p>
                <ul className="list-disc pl-5 text-sm text-ink">
                  {sub.pending.map((p) => (
                    <li key={`${p.op}-${p.module}`}>
                      {t('subscription.plan.pendingRemove', {
                        module: p.module,
                        date: p.at ? formatLongDate(p.at, locale) : '-',
                        by: p.by ?? '',
                      })}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </Card>
        <Card title={t('subscription.usage.title')} headingLevel={2}>
          <UsageBars usage={sub.usage} limits={sub.limits} />
        </Card>
      </div>
      <ModulesCard sub={sub} canChange={canChange} onInvoice={setInvoice} />
      <InvoicesCard id="invoices" invoices={sub.invoices} />
      {converting && <ConvertSheet sub={sub} onOpenChange={setConverting} onInvoice={setInvoice} />}
    </Page>
  );
}
