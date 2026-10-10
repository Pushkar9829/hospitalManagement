import { useTranslation } from 'react-i18next';
import { Banner, Button, formatLongDate } from '@hms/ui';
import { daysLeft } from '../../../lib/dates.js';

/**
 * The hospital's subscription state (spec 2.4): trial with the days left, payment due
 * (PAST_DUE: full access for 7 days), read-only, suspended. ACTIVE shows nothing.
 */
export function StatusBanner({ sub, onChoosePlan, onInvoices }) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'hi' ? 'hi-IN' : 'en-IN';
  const unpaid = sub.invoices?.find((i) => i.status === 'ISSUED');
  const payAction = unpaid && onInvoices && (
    <Button size="sm" variant="secondary" onClick={onInvoices}>
      {t('subscription.banner.viewInvoice')}
    </Button>
  );
  switch (sub.status) {
    case 'TRIAL': {
      const days = daysLeft(sub.trialEndsAt);
      return (
        <Banner
          tone="info"
          role="status"
          title={t('subscription.banner.trialTitle', { count: days ?? 0 })}
          action={
            !sub.converted &&
            onChoosePlan && (
              <Button size="sm" onClick={onChoosePlan}>
                {t('subscription.convert.action')}
              </Button>
            )
          }
        >
          {sub.trialEndsAt
            ? t('subscription.banner.trialBody', { date: formatLongDate(sub.trialEndsAt, locale) })
            : t('subscription.banner.trialBodyNoDate')}
        </Banner>
      );
    }
    case 'PAST_DUE':
      return (
        <Banner
          tone="warning"
          role="alert"
          title={t('subscription.banner.pastDueTitle')}
          action={payAction}
        >
          {t('subscription.banner.pastDueBody', { invoice: unpaid?.number ?? '' })}
        </Banner>
      );
    case 'READ_ONLY':
      return (
        <Banner
          tone="critical"
          role="alert"
          title={t('subscription.banner.readOnlyTitle')}
          action={
            payAction ??
            (!sub.converted && onChoosePlan && (
              <Button size="sm" onClick={onChoosePlan}>
                {t('subscription.convert.action')}
              </Button>
            ))
          }
        >
          {sub.statusReason ? `${sub.statusReason}. ` : ''}
          {t('subscription.banner.readOnlyBody')}
        </Banner>
      );
    case 'SUSPENDED':
      return (
        <Banner
          tone="critical"
          role="alert"
          title={t('subscription.banner.suspendedTitle')}
          action={payAction}
        >
          {sub.statusReason ? `${sub.statusReason}. ` : ''}
          {t('subscription.banner.suspendedBody')}
        </Banner>
      );
    default:
      return null;
  }
}
