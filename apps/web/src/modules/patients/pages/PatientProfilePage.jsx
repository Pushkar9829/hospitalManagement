import { useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import { GitMerge, Pencil, ReceiptIndianRupee } from 'lucide-react';
import { addAdminStrings } from '@hms/i18n/admin';
import { addBillingStrings } from '@hms/i18n/billing';
import { addPatientsStrings } from '@hms/i18n/patients';
import {
  Button,
  ErrorState,
  Loading,
  NotFound404,
  Page,
  PageHeader,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  useToast,
} from '@hms/ui';
import { apiError } from '../../../app/apiError.js';
import { PendingApprovalNotice } from '../../../components/PendingApprovalNotice.jsx';
import { useCan } from '../../../lib/useCan.js';
import { useStrings } from '../../../lib/useStrings.js';
import { useUrlState } from '../../../lib/useUrlState.js';
import { BillsTable } from '../../billing/components/BillsTable.jsx';
import { DetailsTab } from '../components/DetailsTab.jsx';
import { DocumentsTab } from '../components/DocumentsTab.jsx';
import { EditPatientSheet } from '../components/EditPatientSheet.jsx';
import { MergeDialog } from '../components/MergeDialog.jsx';
import { PatientHeader } from '../components/PatientHeader.jsx';
import { TimelineTab } from '../components/TimelineTab.jsx';
import { isObjectId, usePatient } from '../hooks.js';

function BillsTab({ patientId }) {
  const [page, setPage] = useState(1);
  return (
    <BillsTable params={{ patientId }} page={page} onPageChange={setPage} limit={10} hidePatient />
  );
}

/**
 * Patient profile (design board "PatientProfile"): banner with UHID, age label and flags;
 * tabs (kept in the URL) for the timeline, details, documents and bills; edit with the version
 * read (409 reload-and-merge); a merge request through approvals (202).
 */
export default function PatientProfilePage() {
  useStrings(addAdminStrings, addPatientsStrings, addBillingStrings);
  const { id } = useParams();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const can = useCan();
  const [tab, setTab] = useUrlState('tab', 'timeline');
  const [editing, setEditing] = useUrlState('edit', '');
  const [merging, setMerging] = useState(false);
  const [notice, setNotice] = useState(null);
  const { data: p, isLoading, isError, error, refetch } = usePatient(id);

  if (!isObjectId(id)) return <Navigate to="/patients" replace />;
  if (isLoading)
    return (
      <Page>
        <Loading rows={5} />
      </Page>
    );
  if (isError) {
    const e = apiError(error);
    return (
      <Page width="medium">
        {e?.status === 404 ? (
          <NotFound404 className="mt-8" onHome={() => navigate('/patients')} />
        ) : (
          <ErrorState
            title={t('patients.profile.failed')}
            requestId={e?.requestId}
            onRetry={refetch}
          />
        )}
      </Page>
    );
  }

  const active = p.status === 'ACTIVE';
  const tabs = [
    { id: 'timeline', label: t('patients.tabs.timeline'), body: <TimelineTab patientId={p.id} /> },
    { id: 'details', label: t('patients.tabs.details'), body: <DetailsTab patient={p} /> },
    {
      id: 'documents',
      label: t('patients.tabs.documents'),
      body: <DocumentsTab patient={p} onReload={refetch} />,
    },
    ...(can('billing:bill:read')
      ? [{ id: 'bills', label: t('patients.tabs.bills'), body: <BillsTab patientId={p.id} /> }]
      : []),
  ];
  const current = tabs.some((x) => x.id === tab) ? tab : 'timeline';

  return (
    <Page>
      <PageHeader
        title={p.name.full}
        breadcrumb={[{ label: t('patients.search.title'), href: '/patients' }, { label: p.uhid }]}
        actions={
          active && (
            <>
              {can('patients:merge:request') && (
                <Button
                  variant="secondary"
                  icon={<GitMerge size={16} aria-hidden="true" />}
                  onClick={() => setMerging(true)}
                >
                  {t('patients.merge.action')}
                </Button>
              )}
              {can('billing:bill:create') && (
                <Button
                  variant="secondary"
                  icon={<ReceiptIndianRupee size={16} aria-hidden="true" />}
                  onClick={() => navigate(`/billing?tab=new&patient=${p.id}`)}
                >
                  {t('patients.profile.newBill')}
                </Button>
              )}
              {can('patients:patient:update') && (
                <Button
                  icon={<Pencil size={16} aria-hidden="true" />}
                  onClick={() => setEditing('1')}
                >
                  {t('common.edit')}
                </Button>
              )}
            </>
          )
        }
      />
      <PatientHeader patient={p} />
      {notice && (
        <PendingApprovalNotice approvalId={notice.approvalId}>
          {t('patients.merge.sent', { from: notice.merged.uhid, to: notice.survivor.uhid })}{' '}
          {t('approvalNotice.body', { approver: t('patients.merge.approver') })}
        </PendingApprovalNotice>
      )}
      <Tabs value={current} onValueChange={setTab}>
        <TabsList aria-label={t('patients.tabs.label')}>
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
      {editing && active && (
        <EditPatientSheet
          patient={p}
          open
          onOpenChange={(o) => !o && setEditing('')}
          onReload={refetch}
        />
      )}
      {merging && (
        <MergeDialog
          patient={p}
          open
          onOpenChange={setMerging}
          onDone={(r) => {
            if (r.approvalId) setNotice(r);
            else {
              toast({
                title: t('patients.merge.done', { from: r.merged.uhid, to: r.survivor.uhid }),
                tone: 'success',
              });
              refetch();
            }
          }}
        />
      )}
    </Page>
  );
}
