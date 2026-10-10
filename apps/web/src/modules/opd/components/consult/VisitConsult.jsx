import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, Printer, Send } from 'lucide-react';
import {
  Banner,
  Button,
  Card,
  FormField,
  PatientBanner,
  StatusBadge,
  Textarea,
  useToast,
} from '@hms/ui';
import { ApiErrorNotice } from '../../../../components/ApiErrorNotice.jsx';
import { apiError } from '../../../../app/apiError.js';
import { useCan } from '../../../../lib/useCan.js';
import { UrlTabs } from '../../../dx-kit/UrlTabs.jsx';
import { fmtDate, fmtDateTime, fmtTime, localeOf } from '../../../dx-kit/format.js';
import {
  useAddAddendumMutation,
  useCallVisitMutation,
  useCompleteVisitMutation,
  useOpdQueueQuery,
  useSaveConsultationMutation,
  useShareVisitMutation,
} from '../../api.js';
import { PRIORITY_TONE, bpFlag, ymdInstant } from '../../opd.js';
import { NotesTab } from './NotesTab.jsx';
import { OrdersTab } from './OrdersTab.jsx';
import { RxPrintDialog } from './RxPrint.jsx';
import { RxTab } from './RxTab.jsx';
import { CertificatesTab, SpecialtyTab } from './SpecialtyTab.jsx';

/** The draft fields the doctor edits; everything else on the consultation is the server's. */
const DRAFT_KEYS = [
  'complaints',
  'history',
  'examination',
  'diagnoses',
  'noDiagnosisReason',
  'rx',
  'orders',
  'advice',
  'followUp',
  'printLanguage',
  'specialty',
  'specialtyData',
];
const pick = (c) => Object.fromEntries(DRAFT_KEYS.map((k) => [k, c?.[k]]));

/** Vitals from triage as chips; a high BP is red with its word, never colour alone. */
function VitalsChips({ vitals }) {
  const { t } = useTranslation();
  if (!vitals)
    return <StatusBadge tone="warning" label={t('opd.consult.noVitals')} className="self-start" />;
  const chips = [
    vitals.bp && {
      label: `${t('opd.print.bp')} ${vitals.bp}${bpFlag(vitals.bp) ? ` · ${t(`opd.vitals.bpFlag.${bpFlag(vitals.bp)}`)}` : ''}`,
      tone: bpFlag(vitals.bp) === 'HIGH' ? 'critical' : 'neutral',
    },
    vitals.pulse && { label: `${t('opd.print.pulse')} ${vitals.pulse}`, tone: 'neutral' },
    vitals.tempF && { label: `${t('opd.consult.temp')} ${vitals.tempF} °F`, tone: 'neutral' },
    vitals.spo2 && {
      label: `SpO2 ${vitals.spo2}%`,
      tone: vitals.spo2 < 94 ? 'critical' : 'neutral',
    },
    vitals.bmi && { label: `${t('opd.consult.bmi')} ${vitals.bmi}`, tone: 'neutral' },
    vitals.painScore != null && {
      label: t('opd.consult.pain', { n: vitals.painScore }),
      tone: 'neutral',
    },
    vitals.priority && {
      label: t(`opd.priority.${vitals.priority}`),
      tone: PRIORITY_TONE[vitals.priority],
    },
  ].filter(Boolean);
  return (
    <ul className="flex flex-wrap gap-2" aria-label={t('opd.consult.vitals')}>
      {chips.map((c) => (
        <li key={c.label}>
          <StatusBadge tone={c.tone} label={c.label} icon={c.tone !== 'neutral'} />
        </li>
      ))}
    </ul>
  );
}

/** Previous visits, results and check-ups, newest first. */
function HistoryRail({ visit }) {
  const { t, i18n } = useTranslation();
  const locale = localeOf(i18n);
  return (
    <Card title={t('opd.consult.historyTitle')} className="self-start">
      {visit.history.length === 0 ? (
        <p className="text-base text-muted">{t('opd.consult.noHistory')}</p>
      ) : (
        <ol className="flex flex-col gap-3">
          {visit.history.map((h) => (
            <li key={h.id} className="border-l-2 border-line pl-3">
              <p className="text-sm text-muted">{fmtDate(h.date, locale)}</p>
              <p className="font-semibold text-ink">
                {t(`opd.consult.kinds.${h.kind}`)} · {h.title}
              </p>
              <p className="text-base text-ink">{h.note}</p>
            </li>
          ))}
        </ol>
      )}
      {visit.vitalsTrend?.length > 0 && (
        <div className="mt-4 border-t border-line pt-3">
          <p className="mb-2 text-sm font-semibold">{t('opd.consult.trend')}</p>
          <table className="w-full text-sm">
            <caption className="sr-only">{t('opd.consult.trend')}</caption>
            <tbody>
              {visit.vitalsTrend.map((v) => (
                <tr key={v.date}>
                  <td className="py-0.5 text-muted">{fmtDate(v.date, locale)}</td>
                  <td className="tabular py-0.5">{v.bp}</td>
                  <td className="tabular py-0.5 text-right">{v.weightKg} kg</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

/**
 * The doctor's consultation for one visit (board Consult): patient banner with triage vitals,
 * history on the left, and tabs for notes and diagnosis, prescription, orders, specialty forms
 * and certificates. The draft auto-saves (PUT /opd/visits/{id}/consultation); completing signs
 * it (rule R14: later changes are addenda), books the follow-up and offers the Rx print.
 */
export function VisitConsult({ visit, consultation }) {
  const { t, i18n } = useTranslation();
  const { toast } = useToast();
  const navigate = useNavigate();
  const can = useCan();
  const locale = localeOf(i18n);
  const signed = consultation.status === 'SIGNED';
  const readOnly = signed || !can('opd:consultation:write');
  const [draft, setDraft] = useState(() => pick(consultation));
  const [dirty, setDirty] = useState(false);
  const [saveState, setSaveState] = useState(null);
  const [savedAt, setSavedAt] = useState(consultation.savedAt);
  const [printing, setPrinting] = useState(false);
  const [done, setDone] = useState(null);
  const [failure, setFailure] = useState(null);
  const [needDx, setNeedDx] = useState(false);
  const [addendum, setAddendum] = useState('');
  const [save] = useSaveConsultationMutation();
  const [complete, { isLoading: completing }] = useCompleteVisitMutation();
  const [share, { isLoading: sharing }] = useShareVisitMutation();
  const [addAddendum, { isLoading: adding }] = useAddAddendumMutation();
  const [call, { isLoading: calling }] = useCallVisitMutation();
  const queue = useOpdQueueQuery({ doctorId: visit.doctor?.id, stage: 'doctor' });
  const next = queue.data?.items.find((q) => q.visitId !== visit.id && q.stage === 'TRIAGED');

  const change = (patch) => {
    setDraft((d) => ({ ...d, ...patch }));
    setDirty(true);
  };

  // Auto-save 1.2 s after the last change.
  useEffect(() => {
    if (!dirty || readOnly) return undefined;
    const timer = setTimeout(async () => {
      setSaveState('saving');
      try {
        const res = await save({ id: visit.id, ...draft }).unwrap();
        setSavedAt(res.savedAt);
        setSaveState('saved');
        setDirty(false);
      } catch {
        setSaveState('error');
      }
    }, 1200);
    return () => clearTimeout(timer);
  }, [draft, dirty, readOnly, save, visit.id]);

  const diagnosisMissing =
    !draft.diagnoses?.length && !String(draft.noDiagnosisReason ?? '').trim();

  const finish = async () => {
    setFailure(null);
    setNeedDx(diagnosisMissing);
    if (diagnosisMissing) return;
    try {
      const res = await complete({ id: visit.id, ...draft }).unwrap();
      setDirty(false);
      setDone(res);
      setPrinting(true);
      toast({ tone: 'success', title: t('opd.consult.completed', { name: visit.patient.name }) });
    } catch (e) {
      setFailure(e);
      if (apiError(e)?.code === 'NO_DIAGNOSIS') setNeedDx(true);
    }
  };

  const callNext = async () => {
    await call({ id: next.visitId }).unwrap();
    navigate(`/opd/visits/${next.visitId}`);
  };

  const tabProps = { draft, change, readOnly };
  const savedText =
    saveState === 'saving'
      ? t('opd.consult.saving')
      : saveState === 'error'
        ? t('opd.consult.saveFailed')
        : savedAt
          ? t('opd.consult.autoSaved', { time: fmtTime(savedAt, locale) })
          : t('opd.consult.notSaved');

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <PatientBanner
          name={visit.patient.name}
          age={visit.patient.age}
          sex={visit.patient.gender}
          uhid={visit.patient.uhid}
          allergies={visit.patient.allergies}
          noKnownAllergies={visit.patient.noKnownAllergies}
          weightKg={visit.vitals?.weightKg}
          flags={visit.patient.abhaLinked ? [{ label: t('opd.consult.abha'), tone: 'info' }] : []}
        />
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <p className="text-base text-muted">
            <span className="font-mono text-ink">{visit.token}</span> ·{' '}
            {t(`opd.visitType.${visit.visitType}`)} · {visit.doctor?.name} ·{' '}
            <span className="font-mono">{visit.visitNo}</span>
          </p>
          <VitalsChips vitals={visit.vitals} />
        </div>
        {visit.triageSkipped && (
          <Banner tone="warning" title={t('opd.consult.triageSkipped')}>
            {visit.triageSkipped.reason}
          </Banner>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[18rem_1fr]">
        <HistoryRail visit={visit} />
        <Card padding={false}>
          <div className="flex flex-col gap-4 p-4">
            {signed && (
              <Banner tone="success" title={t('opd.consult.signed')}>
                {t('opd.consult.signedBody', {
                  by: consultation.signedBy,
                  at: fmtDateTime(consultation.signedAt, locale),
                })}
              </Banner>
            )}
            {done && (
              <Banner
                tone="success"
                title={t('opd.consult.doneTitle')}
                action={
                  next && (
                    <Button size="sm" loading={calling} onClick={callNext}>
                      {t('opd.consult.next', { token: next.token })}
                    </Button>
                  )
                }
              >
                {done.followUp
                  ? t('opd.consult.followBooked', {
                      date: fmtDate(ymdInstant(done.followUp.date), locale),
                      time: done.followUp.time,
                    })
                  : t('opd.consult.noFollow')}
              </Banner>
            )}
            <ApiErrorNotice error={failure} />
            {needDx && diagnosisMissing && (
              <Banner tone="critical" role="alert">
                {t('opd.consult.needDiagnosis')}
              </Banner>
            )}
            <div className="flex flex-wrap items-start justify-between gap-2">
              <UrlTabs
                className="min-w-0 flex-1"
                label={t('opd.consult.tabsLabel')}
                tabs={[
                  {
                    id: 'notes',
                    label: t('opd.consult.tabs.notes'),
                    countTone: 'critical',
                    count: needDx && diagnosisMissing ? '!' : undefined,
                    body: (
                      <NotesTab
                        {...tabProps}
                        diagnosisError={
                          needDx && diagnosisMissing ? t('opd.consult.needDiagnosis') : null
                        }
                      />
                    ),
                  },
                  {
                    id: 'rx',
                    label: t('opd.consult.tabs.rx'),
                    count: draft.rx?.length || undefined,
                    body: (
                      <RxTab
                        {...tabProps}
                        checks={consultation.checks}
                        department={visit.doctor?.department}
                      />
                    ),
                  },
                  {
                    id: 'orders',
                    label: t('opd.consult.tabs.orders'),
                    count: draft.orders?.length || undefined,
                    body: <OrdersTab {...tabProps} visit={visit} />,
                  },
                  {
                    id: 'specialty',
                    label: t('opd.consult.tabs.specialty'),
                    body: <SpecialtyTab {...tabProps} />,
                  },
                  {
                    id: 'certificates',
                    label: t('opd.consult.tabs.certificates'),
                    body: (
                      <CertificatesTab
                        visit={visit}
                        consultation={consultation}
                        readOnly={!can('opd:consultation:write')}
                      />
                    ),
                  },
                ]}
              />
              {!readOnly && (
                <span className="pt-2 text-sm text-muted" aria-live="polite">
                  {savedText}
                </span>
              )}
            </div>
            {signed && (
              <section aria-label={t('opd.consult.addenda')} className="flex flex-col gap-2">
                <h3 className="text-md font-semibold">{t('opd.consult.addenda')}</h3>
                {(consultation.addenda ?? []).map((a) => (
                  <p key={a.id} className="rounded-control bg-surface-2 px-3 py-2 text-base">
                    {a.text}
                    <span className="block text-sm text-muted">
                      {a.by} · {fmtDateTime(a.at, locale)}
                    </span>
                  </p>
                ))}
                {can('opd:consultation:write') && (
                  <>
                    <FormField
                      label={t('opd.consult.addendum')}
                      hint={t('opd.consult.addendumHint')}
                    >
                      <Textarea
                        rows={2}
                        value={addendum}
                        onChange={(e) => setAddendum(e.target.value)}
                      />
                    </FormField>
                    <Button
                      variant="secondary"
                      className="self-start"
                      loading={adding}
                      disabled={addendum.trim().length < 3}
                      onClick={async () => {
                        await addAddendum({ id: visit.id, text: addendum.trim() }).unwrap();
                        setAddendum('');
                        toast({ tone: 'success', title: t('opd.consult.addendumAdded') });
                      }}
                    >
                      {t('opd.consult.addAddendum')}
                    </Button>
                  </>
                )}
              </section>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2 border-t border-line px-4 py-3">
            {!readOnly && (
              <Button
                icon={<CheckCircle2 size={16} aria-hidden="true" />}
                loading={completing}
                onClick={finish}
              >
                {t('opd.consult.complete')}
              </Button>
            )}
            <Button
              variant="secondary"
              icon={<Printer size={16} aria-hidden="true" />}
              onClick={() => setPrinting(true)}
            >
              {t('opd.consult.printPreview')}
            </Button>
            <Button
              variant="secondary"
              icon={<Send size={16} aria-hidden="true" />}
              loading={sharing}
              onClick={async () => {
                const r = await share({ id: visit.id, channel: 'WHATSAPP' }).unwrap();
                toast({ tone: 'success', title: t('opd.consult.shared', { mobile: r.sentTo }) });
              }}
            >
              {t('opd.consult.whatsapp')}
            </Button>
            {next && (
              <Button variant="ghost" loading={calling} onClick={callNext}>
                {t('opd.consult.next', { token: next.token })}
              </Button>
            )}
            <Link
              to="/opd/visits/queue"
              className="ml-auto inline-flex min-h-10 items-center rounded-control px-3 font-semibold text-info hover:bg-info-bg"
            >
              {t('opd.consult.backToQueue')}
            </Link>
          </div>
        </Card>
      </div>
      <RxPrintDialog
        open={printing}
        onOpenChange={setPrinting}
        visit={visit}
        consultation={{ ...consultation, ...draft, ...(done?.consultation ?? {}) }}
      />
    </div>
  );
}
