import { useTranslation } from 'react-i18next';
import { MASTERS, MASTER_TYPES } from '@hms/shared/schemas';
import { Page, PageHeader, Tabs, TabsContent, TabsList, TabsTrigger } from '@hms/ui';
import { useUrlState } from '../../../lib/useUrlState.js';
import { DepartmentsTab } from '../components/DepartmentsTab.jsx';
import { MasterTab } from '../components/MasterTab.jsx';
import { useAdminStrings } from '../../../lib/useAdminStrings.js';

/** Masters in the order an admin sets them up: tariffs depend on price lists and tax codes. */
const ORDER = [
  'services',
  'price-lists',
  'tax-codes',
  'payment-modes',
  'referral-sources',
  'units',
  'designations',
  'holidays',
];

/**
 * Departments and masters (design board "Departments", spec 5.2). One tab for departments and
 * one per master type; the tab is kept in the URL (?tab=).
 */
export default function MastersPage() {
  useAdminStrings();
  const { t } = useTranslation();
  const types = [
    ...ORDER.filter((x) => MASTER_TYPES.includes(x)),
    ...MASTER_TYPES.filter((x) => !ORDER.includes(x)),
  ];
  const [tab, setTab] = useUrlState('tab', 'departments');
  const active = tab === 'departments' || types.includes(tab) ? tab : 'departments';

  return (
    <Page>
      <PageHeader title={t('masters.title')} description={t('masters.description')} />
      <Tabs value={active} onValueChange={(v) => setTab(v, { reset: ['dept'] })}>
        <TabsList aria-label={t('masters.tabsLabel')}>
          <TabsTrigger value="departments">{t('departments.title')}</TabsTrigger>
          {types.map((type) => (
            <TabsTrigger key={type} value={type}>
              {t(`masters.types.${type}`, { defaultValue: MASTERS[type].label })}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="departments">
          {active === 'departments' && <DepartmentsTab />}
        </TabsContent>
        {types.map((type) => (
          <TabsContent key={type} value={type}>
            {active === type && <MasterTab key={type} type={type} />}
          </TabsContent>
        ))}
      </Tabs>
    </Page>
  );
}
