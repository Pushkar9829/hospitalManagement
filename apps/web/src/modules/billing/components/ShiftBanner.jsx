import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { ArrowRight } from 'lucide-react';
import { Banner, formatTime } from '@hms/ui';
import { useCan } from '../../../lib/useCan.js';
import { inr } from '../../../lib/money.js';
import { useCurrentShiftQuery } from '../api.js';

/** My counter shift (rule R10): open shift with the cash expected, or a prompt to open one. */
export function ShiftBanner({ className }) {
  const { t, i18n } = useTranslation();
  const can = useCan();
  const locale = i18n.language === 'hi' ? 'hi-IN' : 'en-IN';
  const visible = can('billing:shift:read');
  const { data: shift, isLoading, isError } = useCurrentShiftQuery(undefined, { skip: !visible });
  if (!visible || isLoading || isError) return null;
  const link = (label) => (
    <Link
      to="/billing/shift"
      className="inline-flex min-h-8 items-center gap-1 text-sm font-semibold underline underline-offset-2"
    >
      {label}
      <ArrowRight size={14} aria-hidden="true" />
    </Link>
  );
  if (!shift) {
    return (
      <Banner
        tone="warning"
        role="status"
        title={t('billing.shift.noneTitle')}
        className={className}
        action={can('billing:shift:open') && link(t('billing.shift.open'))}
      >
        {t('billing.shift.noneBody')}
      </Banner>
    );
  }
  return (
    <Banner tone="info" role="status" className={className} action={link(t('billing.shift.view'))}>
      <strong className="font-semibold">
        {t('billing.shift.openAt', {
          counter: shift.counter,
          time: formatTime(shift.openedAt, locale),
        })}
      </strong>{' '}
      {t('billing.shift.expectedCash', { amount: inr(shift.expected?.CASH ?? shift.openingCash) })}
    </Banner>
  );
}
