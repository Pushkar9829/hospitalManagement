import { useTranslation } from 'react-i18next';
import { Page, PageHeader, Tabs, TabsContent, TabsList, TabsTrigger } from '@hms/ui';
import { useCan } from '../../../lib/useCan.js';
import { useUrlState } from '../../../lib/useUrlState.js';
import { HospitalTab } from '../components/HospitalTab.jsx';
import { EntitiesTab } from '../components/EntitiesTab.jsx';
import { BranchesTab } from '../components/BranchesTab.jsx';
import { NumberSeriesTab } from '../components/NumberSeriesTab.jsx';
import { ApprovalRulesTab } from '../components/ApprovalRulesTab.jsx';
import { useAdminStrings } from '../../../lib/useAdminStrings.js';

/**
 * Hospital settings (design board "Settings", spec 5.1). The tab is kept in the URL (?tab=), so
 * a reload or a shared link opens the same tab. Approval rules are for Super Admins (others with
 * read access see them read-only).
 */
export default function SettingsPage() {
  useAdminStrings();
  const { t } = useTranslation();
  const can = useCan();
  const tabs = [
    { id: 'hospital', label: t('settings.tabs.hospital'), Component: HospitalTab },
    { id: 'entities', label: t('settings.tabs.entities'), Component: EntitiesTab },
    { id: 'branches', label: t('settings.tabs.branches'), Component: BranchesTab },
    { id: 'numbering', label: t('settings.tabs.numbering'), Component: NumberSeriesTab },
    ...(can('settings:approval:read')
      ? [{ id: 'approval-rules', label: t('settings.tabs.rules'), Component: ApprovalRulesTab }]
      : []),
  ];
  const [tab, setTab] = useUrlState('tab', 'hospital');
  const active = tabs.some((x) => x.id === tab) ? tab : 'hospital';

  return (
    <Page>
      <PageHeader title={t('settings.title')} description={t('settings.description')} />
      <Tabs value={active} onValueChange={(v) => setTab(v)}>
        <TabsList aria-label={t('settings.tabsLabel')}>
          {tabs.map((x) => (
            <TabsTrigger key={x.id} value={x.id}>
              {x.label}
            </TabsTrigger>
          ))}
        </TabsList>
        {tabs.map(({ id, Component }) => (
          <TabsContent key={id} value={id}>
            {active === id && <Component />}
          </TabsContent>
        ))}
      </Tabs>
    </Page>
  );
}
