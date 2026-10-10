import { useParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import { addOpdStrings } from '@hms/i18n/opd';
import { addPatientsStrings } from '@hms/i18n/patients';
import { addDxkitStrings } from '@hms/i18n/dxkit';
import { Loading, Page, PageHeader } from '@hms/ui';
import { PreviewBanner } from '../../../components/PreviewBanner.jsx';
import { useStrings } from '../../../lib/useStrings.js';
import { QueryView } from '../../dx-kit/QueryView.jsx';
import { useConsultationQuery, useOpdVisitQuery } from '../api.js';
import { DoctorQueue } from '../components/consult/DoctorQueue.jsx';
import { VisitConsult } from '../components/consult/VisitConsult.jsx';

/** Loads the visit and its consultation, then hands both to the consultation screen. */
function Visit({ id }) {
  const { t } = useTranslation();
  const visit = useOpdVisitQuery(id);
  const consultation = useConsultationQuery(id);
  return (
    <>
      <PageHeader
        breadcrumb={[
          { label: t('opd.crumbs.opd') },
          { label: t('opd.consult.crumb'), href: '/opd/visits/queue' },
          { label: visit.data?.token ?? '…' },
        ]}
        title={
          visit.data
            ? t('opd.consult.title', { name: visit.data.patient.name })
            : t('opd.consult.crumb')
        }
      />
      <QueryView query={visit} rows={6} errorTitle={t('opd.consult.loadFailed')}>
        {(v) =>
          consultation.data ? (
            <VisitConsult key={v.id} visit={v} consultation={consultation.data} />
          ) : (
            <QueryView query={consultation}>{() => <Loading />}</QueryView>
          )
        }
      </QueryView>
    </>
  );
}

/**
 * Consultation (board Consult, route /opd/visits/:id). `/opd/visits/queue` is the doctor's
 * queue (where the menu item opens); any other id is one visit's consultation.
 */
export default function ConsultPage() {
  useStrings(addPatientsStrings, addDxkitStrings, addOpdStrings);
  const { t } = useTranslation();
  const { id } = useParams();
  return (
    <Page>
      <PreviewBanner module="OPD" />
      {id === 'queue' ? (
        <>
          <PageHeader
            breadcrumb={[{ label: t('opd.crumbs.opd') }, { label: t('opd.consult.crumb') }]}
            title={t('opd.dq.title')}
            description={t('opd.dq.description')}
          />
          <DoctorQueue />
        </>
      ) : (
        <Visit id={id} />
      )}
    </Page>
  );
}
