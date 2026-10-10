import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { addOpdStrings } from '@hms/i18n/opd';
import { addPatientsStrings } from '@hms/i18n/patients';
import { addDxkitStrings } from '@hms/i18n/dxkit';
import {
  Button,
  Card,
  Checkbox,
  ConfirmDialog,
  EmptyState,
  Page,
  PageHeader,
  PatientBanner,
  useToast,
} from '@hms/ui';
import { PreviewBanner } from '../../../components/PreviewBanner.jsx';
import { ApiErrorNotice } from '../../../components/ApiErrorNotice.jsx';
import { applyFieldErrors } from '../../../lib/forms.js';
import { useCan } from '../../../lib/useCan.js';
import { useStrings } from '../../../lib/useStrings.js';
import { useUrlState } from '../../../lib/useUrlState.js';
import { FormDialog } from '../../dx-kit/FormDialog.jsx';
import { QueryView } from '../../dx-kit/QueryView.jsx';
import { fmtTime, localeOf } from '../../dx-kit/format.js';
import {
  useOpdQueueQuery,
  useOpdVisitQuery,
  useRecordProcedureMutation,
  useSaveVitalsMutation,
  useSkipTriageMutation,
  useStartTriageMutation,
} from '../api.js';
import { QueueList } from '../components/QueueList.jsx';
import { VitalsFields } from '../components/VitalsForm.jsx';
import { useVitalsForm, vitalsDefaults } from '../vitals.js';

const PROCEDURES = ['INJECTION_IM', 'DRESSING', 'NEBULISATION', 'ECG'];

const procedureSchema = (t) =>
  z.object({
    type: z.enum(PROCEDURES),
    detail: z.string().trim().min(2, t('opd.triage.errors.detail')),
    notes: z.string().max(300).optional(),
  });

/** One visit's triage: identity, the vitals form and the three actions. */
function TriageCard({ visit, onDone }) {
  const { t, i18n } = useTranslation();
  const { toast } = useToast();
  const can = useCan();
  const form = useVitalsForm({ defaults: vitalsDefaults(visit.vitals, visit.complaint) });
  const [allergiesOk, setAllergiesOk] = useState(Boolean(visit.vitals?.allergiesConfirmed));
  const [failure, setFailure] = useState(null);
  const [dialog, setDialog] = useState(null);
  const [save] = useSaveVitalsMutation();
  const [skip] = useSkipTriageMutation();
  const [procedure] = useRecordProcedureMutation();
  const startedAt = useRef(new Date());
  const allergies = visit.patient.allergies ?? [];
  const canWrite = can('opd:vitals:create');

  const submit = form.handleSubmit(async (values) => {
    setFailure(null);
    try {
      await save({ id: visit.id, ...values, allergiesConfirmed: allergiesOk }).unwrap();
      toast({
        tone: values.priority === 'RED' ? 'warning' : 'success',
        title: t('opd.triage.sent', { name: visit.patient.name, doctor: visit.doctor?.name }),
        description: values.priority === 'RED' ? t('opd.triage.doctorAlerted') : undefined,
      });
      onDone();
    } catch (e) {
      setFailure(applyFieldErrors(e, form.setError, ['priorityReason', 'bp', 'complaint']));
    }
  });

  return (
    <Card
      title={`${visit.token ?? ''} · ${visit.patient.name}`}
      description={[
        visit.doctor?.name,
        visit.patient.age,
        allergies.length
          ? t('opd.triage.allergyConfirm', { allergies: allergies.join(', ') })
          : null,
      ]
        .filter(Boolean)
        .join(' · ')}
      actions={
        <span className="text-sm text-muted">
          {t('opd.triage.started', { time: fmtTime(startedAt.current, localeOf(i18n)) })}
        </span>
      }
    >
      <form onSubmit={submit} noValidate className="flex flex-col gap-4">
        <PatientBanner
          name={visit.patient.name}
          age={visit.patient.age}
          sex={visit.patient.gender}
          uhid={visit.patient.uhid}
          allergies={visit.patient.allergies}
          noKnownAllergies={visit.patient.noKnownAllergies}
          consultant={visit.doctor?.name}
        />
        <ApiErrorNotice error={failure} />
        <VitalsFields form={form} />
        {allergies.length > 0 && (
          <Checkbox
            label={t('opd.triage.allergyChecked', { allergies: allergies.join(', ') })}
            checked={allergiesOk}
            onChange={(e) => setAllergiesOk(e.target.checked)}
          />
        )}
        {canWrite && (
          <div className="flex flex-wrap gap-2 border-t border-line pt-4">
            <Button type="submit" loading={form.formState.isSubmitting}>
              {t('opd.triage.save')}
            </Button>
            <Button variant="secondary" onClick={() => setDialog('skip')}>
              {t('opd.triage.skip')}
            </Button>
            <Button variant="secondary" onClick={() => setDialog('procedure')}>
              {t('opd.triage.procedure')}
            </Button>
          </div>
        )}
      </form>
      <ConfirmDialog
        open={dialog === 'skip'}
        onOpenChange={(o) => setDialog(o ? 'skip' : null)}
        title={t('opd.triage.skipTitle', { name: visit.patient.name })}
        description={t('opd.triage.skipHint')}
        confirmLabel={t('opd.triage.skip')}
        cancelLabel={t('opd.appt.keep')}
        reasonLabel={t('opd.appt.reason')}
        destructive={false}
        onConfirm={async (reason) => {
          await skip({ id: visit.id, reason }).unwrap();
          toast({ tone: 'success', title: t('opd.triage.skipped', { name: visit.patient.name }) });
          onDone();
        }}
      />
      <FormDialog
        open={dialog === 'procedure'}
        onOpenChange={(o) => setDialog(o ? 'procedure' : null)}
        title={t('opd.triage.procedure')}
        description={t('opd.triage.procedureHint')}
        schema={procedureSchema(t)}
        defaultValues={{ type: 'INJECTION_IM', detail: '', notes: '' }}
        fields={[
          {
            name: 'type',
            label: t('opd.triage.procType'),
            type: 'select',
            options: PROCEDURES.map((p) => ({ value: p, label: t(`opd.triage.procs.${p}`) })),
          },
          {
            name: 'detail',
            label: t('opd.triage.procDetail'),
            placeholder: t('opd.triage.procDetailHint'),
            required: true,
          },
          { name: 'notes', label: t('opd.triage.procNotes'), type: 'textarea', optional: true },
        ]}
        submitLabel={t('opd.triage.record')}
        onSubmit={(v) => procedure({ id: visit.id, ...v }).unwrap()}
        onDone={(_r, v) =>
          toast({
            tone: 'success',
            title: t('opd.triage.recorded', { what: t(`opd.triage.procs.${v.type}`) }),
            description: t('opd.triage.billed'),
          })
        }
      />
    </Card>
  );
}

/**
 * OPD triage (board OpdTriage, route /opd/triage): the nurse's queue of checked-in patients
 * waiting for vitals (GET /opd/queue?stage=triage); picking one starts triage, saving the
 * vitals sends the patient to the doctor's queue (POST /opd/visits/{id}/vitals). A red flag
 * moves the patient to the top and alerts the doctor.
 */
export default function OpdTriagePage() {
  useStrings(addPatientsStrings, addDxkitStrings, addOpdStrings);
  const { t } = useTranslation();
  const can = useCan();
  const [selected, setSelected] = useUrlState('id', '');
  const queue = useOpdQueueQuery({ stage: 'triage' }, { pollingInterval: 30_000 });
  const items = queue.data?.items ?? [];
  const current = items.find((q) => q.visitId === selected) ?? items[0] ?? null;
  const visitId = current?.visitId ?? '';
  const visit = useOpdVisitQuery(visitId, { skip: !visitId });
  const [startTriage] = useStartTriageMutation();

  useEffect(() => {
    if (current?.stage === 'WAITING' && can('opd:vitals:create')) startTriage({ id: visitId });
    // Start triage once per picked patient.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visitId]);

  return (
    <Page>
      <PreviewBanner module="OPD" />
      <PageHeader
        breadcrumb={[{ label: t('opd.crumbs.opd') }, { label: t('opd.triage.crumb') }]}
        title={t('opd.triage.title')}
        description={t('opd.triage.description')}
      />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[22rem_1fr]">
        <Card
          title={t('opd.triage.queueTitle')}
          actions={
            <span className="text-sm text-muted">
              {t('opd.triage.waiting', { count: items.length })}
            </span>
          }
        >
          <QueryView
            query={queue}
            empty={
              <EmptyState
                bordered={false}
                title={t('opd.triage.empty')}
                description={t('opd.triage.emptyHint')}
              />
            }
            isEmpty={(d) => !d.items.length}
          >
            {(data) => (
              <QueueList
                items={data.items}
                selectedId={visitId}
                onPick={(q) => setSelected(q.visitId)}
                label={t('opd.triage.queueTitle')}
                showDoctor
              />
            )}
          </QueryView>
        </Card>
        {current ? (
          <QueryView query={visit} rows={6}>
            {(v) => (
              <TriageCard
                key={v.id}
                visit={v}
                onDone={() => {
                  const next = items.find((q) => q.visitId !== v.id);
                  setSelected(next?.visitId ?? '');
                }}
              />
            )}
          </QueryView>
        ) : (
          <EmptyState title={t('opd.triage.pick')} description={t('opd.triage.emptyHint')} />
        )}
      </div>
    </Page>
  );
}
