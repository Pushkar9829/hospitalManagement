import { useTranslation } from 'react-i18next';
import { addOpdStrings } from '@hms/i18n/opd';
import { addPatientsStrings } from '@hms/i18n/patients';
import { addDxkitStrings } from '@hms/i18n/dxkit';
import { Page, PageHeader } from '@hms/ui';
import { PreviewBanner } from '../../../components/PreviewBanner.jsx';
import { useStrings } from '../../../lib/useStrings.js';
import { UrlTabs } from '../../dx-kit/UrlTabs.jsx';
import { CalendarTab } from '../components/CalendarTab.jsx';
import {
  CheckupsTab,
  DoctorSchedulesTab,
  PlansTab,
  ResourcesTab,
  TeleTab,
} from '../components/AppointmentTabs.jsx';

/**
 * OPD appointments (board "Opd", route /opd): the appointment calendar with the slot grid, the
 * doctor's queue and quick booking, then doctor schedules, health check-ups, tele-consultations,
 * treatment plans and bookable resources. The tab is kept in the URL.
 */
export default function OpdPage() {
  useStrings(addPatientsStrings, addDxkitStrings, addOpdStrings);
  const { t } = useTranslation();
  return (
    <Page>
      <PreviewBanner module="OPD" />
      <PageHeader
        breadcrumb={[{ label: t('opd.crumbs.patients') }, { label: t('opd.crumbs.appointments') }]}
        title={t('opd.title')}
        description={t('opd.description')}
      />
      <UrlTabs
        label={t('opd.tabs.label')}
        reset={['date', 'dept', 'doctor', 'appt']}
        tabs={[
          { id: 'calendar', label: t('opd.tabs.calendar'), body: <CalendarTab /> },
          { id: 'schedules', label: t('opd.tabs.schedules'), body: <DoctorSchedulesTab /> },
          { id: 'checkups', label: t('opd.tabs.checkups'), body: <CheckupsTab /> },
          { id: 'tele', label: t('opd.tabs.tele'), body: <TeleTab /> },
          { id: 'plans', label: t('opd.tabs.plans'), body: <PlansTab /> },
          { id: 'resources', label: t('opd.tabs.resources'), body: <ResourcesTab /> },
        ]}
      />
    </Page>
  );
}
