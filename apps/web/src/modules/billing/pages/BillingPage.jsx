import { useTranslation } from 'react-i18next';
import { addAdminStrings } from '@hms/i18n/admin';
import { addBillingStrings } from '@hms/i18n/billing';
import { addPatientsStrings } from '@hms/i18n/patients';
import { Page, PageHeader, Tabs, TabsContent, TabsList, TabsTrigger } from '@hms/ui';
import { useCan } from '../../../lib/useCan.js';
import { useStrings } from '../../../lib/useStrings.js';
import { useUrlState } from '../../../lib/useUrlState.js';
import { BillsTab } from '../components/BillsTab.jsx';
import { DepositsTab } from '../components/DepositsTab.jsx';
import { NewBillTab } from '../components/NewBillTab.jsx';
import { RefundsTab } from '../components/RefundsTab.jsx';
import { ShiftBanner } from '../components/ShiftBanner.jsx';

/**
 * Billing counter (design board "Billing", docs/modules/BILLING.md): the shift banner, then tabs
 * kept in the URL: a new OPD or miscellaneous bill, the bills list, deposits and refunds.
 */
export default function BillingPage() {
  useStrings(addAdminStrings, addPatientsStrings, addBillingStrings);
  const { t } = useTranslation();
  const can = useCan();
  const tabs = [
    can('billing:bill:create') && { id: 'new', label: t('billing.tabs.new'), body: <NewBillTab /> },
    { id: 'bills', label: t('billing.tabs.bills'), body: <BillsTab /> },
    can('billing:deposit:read') && {
      id: 'deposits',
      label: t('billing.tabs.deposits'),
      body: <DepositsTab />,
    },
    can('billing:refund:read') && {
      id: 'refunds',
      label: t('billing.tabs.refunds'),
      body: <RefundsTab />,
    },
  ].filter(Boolean);
  const [tab, setTab] = useUrlState('tab', tabs[0].id);
  const current = tabs.some((x) => x.id === tab) ? tab : tabs[0].id;
  return (
    <Page>
      <PageHeader title={t('billing.title')} description={t('billing.description')} />
      <ShiftBanner />
      <Tabs
        value={current}
        onValueChange={(v) => setTab(v, { reset: ['page', 'q', 'status', 'from', 'to'] })}
      >
        <TabsList aria-label={t('billing.tabs.label')}>
          {tabs.map((x) => (
            <TabsTrigger key={x.id} value={x.id}>
              {x.label}
            </TabsTrigger>
          ))}
        </TabsList>
        {tabs.map((x) => (
          <TabsContent key={x.id} value={x.id}>
            {current === x.id && x.body}
          </TabsContent>
        ))}
      </Tabs>
    </Page>
  );
}
