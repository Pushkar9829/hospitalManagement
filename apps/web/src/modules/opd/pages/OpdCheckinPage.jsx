import { useState } from 'react';
import { Link } from 'react-router';
import { useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { QrCode, ScanLine, Search } from 'lucide-react';
import { addOpdStrings } from '@hms/i18n/opd';
import { addPatientsStrings } from '@hms/i18n/patients';
import { addDxkitStrings } from '@hms/i18n/dxkit';
import {
  Banner,
  Button,
  Card,
  Checkbox,
  EmptyState,
  Input,
  Page,
  PageHeader,
  PatientBanner,
  StatusBadge,
  useToast,
} from '@hms/ui';
import { PreviewBanner } from '../../../components/PreviewBanner.jsx';
import { ApiErrorNotice } from '../../../components/ApiErrorNotice.jsx';
import { selectSession } from '../../../app/session.js';
import { useCan } from '../../../lib/useCan.js';
import { useDebounced } from '../../../lib/useDebounced.js';
import { useStrings } from '../../../lib/useStrings.js';
import { useUrlState } from '../../../lib/useUrlState.js';
import { QueryView } from '../../dx-kit/QueryView.jsx';
import { useCheckInMutation, useOpdAppointmentsQuery } from '../api.js';
import { APPT_TONE, feeText, todayIST } from '../opd.js';
import { CancelDialog, RescheduleDialog } from '../components/AppointmentDialogs.jsx';
import { Detail } from '../components/AppointmentSheet.jsx';
import { AbhaDialog, ScanQrDialog } from '../components/ScanDialogs.jsx';

const FILTERS = {
  due: 'BOOKED,CONFIRMED',
  done: 'CHECKED_IN,IN_CONSULT',
  all: 'BOOKED,CONFIRMED,CHECKED_IN,IN_CONSULT,COMPLETED,NO_SHOW',
};

/** The main button names what happens next (board OpdCheckin). */
function actionLabel(t, a) {
  if (a.visitType === 'TELE') return t('opd.checkin.actionVideo');
  if (!a.fee.paid && a.fee.amount > 0) return t('opd.checkin.actionBilling');
  return t('opd.checkin.actionToken');
}

/**
 * OPD check-in (route /opd/check-in): today's arrivals on the left, the picked booking with
 * identity, ABHA, fee and consents in the middle, the token slip on the right. Checking in
 * issues the token (POST /opd/appointments/{id}/check-in) and says where the patient goes next:
 * triage, the billing counter (fee due, linked to the billing screen) or the video room.
 */
export default function OpdCheckinPage() {
  useStrings(addPatientsStrings, addDxkitStrings, addOpdStrings);
  const { t } = useTranslation();
  const { toast } = useToast();
  const can = useCan();
  const hospital = useSelector((s) => selectSession(s).data?.tenant?.name);
  const [q, setQ] = useUrlState('q', '');
  const [filter, setFilter] = useUrlState('show', 'due');
  const [selected, setSelected] = useUrlState('id', '');
  const [dialog, setDialog] = useState(null);
  const [confirmed, setConfirmed] = useState(true);
  const [consent, setConsent] = useState(true);
  const [results, setResults] = useState({});
  const [failure, setFailure] = useState(null);
  const term = useDebounced(q.trim(), 300);
  const [checkIn, { isLoading: checking }] = useCheckInMutation();
  const list = useOpdAppointmentsQuery({
    date: todayIST(),
    status: FILTERS[filter] ?? FILTERS.due,
    q: term,
  });
  const pending = useOpdAppointmentsQuery({ date: todayIST(), status: FILTERS.due });
  const items = list.data?.items ?? [];
  // A booking just checked in leaves the "to check in" list but stays open here.
  const cur =
    items.find((a) => a.id === selected) ?? results[selected]?.appointment ?? items[0] ?? null;
  const result = cur ? results[cur.id] : null;
  const isDone = cur && !['BOOKED', 'CONFIRMED'].includes(cur.status);

  const doCheckIn = async () => {
    setFailure(null);
    try {
      const res = await checkIn({
        id: cur.id,
        detailsConfirmed: confirmed,
        whatsappConsent: consent,
      }).unwrap();
      setResults((r) => ({ ...r, [cur.id]: res }));
      setSelected(cur.id);
      toast({
        tone: 'success',
        title: t('opd.checkin.done', { name: cur.patient.name, token: res.token.no }),
        description: t(`opd.checkin.next.${res.next}`),
      });
    } catch (e) {
      setFailure(e);
    }
  };

  return (
    <Page>
      <PreviewBanner module="OPD" />
      <PageHeader
        breadcrumb={[{ label: t('opd.crumbs.patients') }, { label: t('opd.checkin.crumb') }]}
        title={t('opd.checkin.title')}
        description={t('opd.checkin.description')}
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
          <div className="relative min-w-64 flex-1">
            <Search
              size={16}
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted"
            />
            <Input
              type="search"
              aria-label={t('opd.checkin.search')}
              placeholder={t('opd.checkin.search')}
              className="pl-9"
              value={q}
              onChange={(e) => setQ(e.target.value, { reset: ['id'] })}
            />
          </div>
          <Button
            variant="secondary"
            icon={<QrCode size={16} aria-hidden="true" />}
            onClick={() => setDialog('qr')}
          >
            {t('opd.checkin.scanQr')}
          </Button>
          <Button
            variant="secondary"
            icon={<ScanLine size={16} aria-hidden="true" />}
            onClick={() => setDialog('abha')}
          >
            {t('opd.checkin.abha')}
          </Button>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            to="/patients/new"
            className="inline-flex min-h-10 items-center rounded-control border border-line-strong bg-surface px-4 font-semibold text-ink hover:bg-surface-2"
          >
            {t('opd.checkin.newPatient')}
          </Link>
          <Link
            to="/opd?walkin=1"
            className="inline-flex min-h-10 items-center rounded-control border border-line-strong bg-surface px-4 font-semibold text-ink hover:bg-surface-2"
          >
            {t('opd.checkin.walkIn')}
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[20rem_1fr] xl:grid-cols-[20rem_1fr_17rem]">
        <Card
          title={t('opd.checkin.arrivals')}
          actions={
            <span className="text-sm text-muted">
              {t('opd.checkin.toCheckIn', { count: pending.data?.total ?? 0 })}
            </span>
          }
        >
          <div
            role="radiogroup"
            aria-label={t('opd.checkin.filter')}
            className="mb-3 flex flex-wrap gap-1"
          >
            {Object.keys(FILTERS).map((f) => (
              <button
                key={f}
                type="button"
                role="radio"
                aria-checked={filter === f}
                onClick={() => setFilter(f, { reset: ['id'] })}
                className={
                  filter === f
                    ? 'rounded-chip bg-primary px-3 py-1 text-sm font-semibold text-on-primary'
                    : 'rounded-chip bg-neutral-bg px-3 py-1 text-sm font-semibold text-neutral hover:bg-line'
                }
              >
                {t(`opd.checkin.filters.${f}`)}
              </button>
            ))}
          </div>
          <QueryView
            query={list}
            empty={
              <EmptyState
                bordered={false}
                title={term ? t('opd.checkin.noMatch', { q: term }) : t('opd.checkin.none')}
                description={t('opd.checkin.noneHint')}
              />
            }
            isEmpty={(d) => !d.items.length}
          >
            {(data) => (
              <ul aria-label={t('opd.checkin.arrivals')} className="flex flex-col gap-0.5">
                {data.items.map((a) => {
                  const on = a.id === cur?.id;
                  return (
                    <li key={a.id}>
                      <button
                        type="button"
                        aria-current={on ? 'true' : undefined}
                        onClick={() => {
                          setSelected(a.id);
                          setFailure(null);
                        }}
                        className={`flex w-full cursor-pointer items-center gap-3 rounded-control border-l-4 px-3 py-2 text-left ${
                          on ? 'border-primary bg-info-bg' : 'border-transparent hover:bg-surface-2'
                        }`}
                      >
                        <span className="w-12 shrink-0 font-mono text-sm font-semibold">
                          {a.time}
                        </span>
                        <span className="min-w-0 flex-1">
                          <strong className="block truncate font-semibold text-ink">
                            {a.patient.name}
                          </strong>
                          <span className="block truncate text-sm text-muted">
                            {a.doctor.name} · {t(`opd.visitType.${a.visitType}`)}
                          </span>
                        </span>
                        <StatusBadge
                          tone={APPT_TONE[a.status]}
                          label={
                            ['BOOKED', 'CONFIRMED'].includes(a.status)
                              ? t('opd.checkin.expected')
                              : t(`opd.apptStatus.${a.status}`)
                          }
                        />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </QueryView>
        </Card>

        {cur ? (
          <Card
            title={t('opd.checkin.cardTitle', { name: cur.patient.name })}
            description={`${cur.doctor.name} · ${cur.time} · ${t(`opd.visitType.${cur.visitType}`)}`}
            actions={
              <StatusBadge
                tone={APPT_TONE[cur.status]}
                label={isDone ? t(`opd.apptStatus.${cur.status}`) : t('opd.checkin.expected')}
              />
            }
          >
            <div className="flex flex-col gap-4">
              <PatientBanner
                name={cur.patient.name}
                age={cur.patient.age}
                sex={cur.patient.gender}
                uhid={cur.patient.uhid}
                allergies={cur.patient.allergies}
                noKnownAllergies={cur.patient.noKnownAllergies}
              />
              <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Detail label={t('opd.checkin.identity')}>
                  <span className="font-mono">{cur.patient.uhid}</span> · {cur.patient.age} ·{' '}
                  {t('opd.checkin.mobileVerified', { mobile: cur.patient.mobile })}
                </Detail>
                <Detail label={t('opd.checkin.abhaLabel')}>
                  {cur.patient.abhaLinked ? (
                    <StatusBadge tone="success" label={t('opd.checkin.abhaLinked')} />
                  ) : (
                    <span className="flex flex-wrap items-center gap-2">
                      <StatusBadge tone="warning" label={t('opd.checkin.abhaNotLinked')} />
                      <button
                        type="button"
                        className="text-sm font-semibold text-info underline underline-offset-2"
                        onClick={() => setDialog('abha')}
                      >
                        {t('opd.checkin.offerAbha')}
                      </button>
                    </span>
                  )}
                </Detail>
                <Detail label={t('opd.book.visitType')}>
                  {t(`opd.visitType.${cur.visitType}`)}
                </Detail>
                <Detail label={t('opd.appt.fee')}>{feeText(t, cur.fee)}</Detail>
              </dl>
              {!isDone && (
                <div className="flex flex-col gap-2">
                  <Checkbox
                    label={t('opd.checkin.confirmed')}
                    checked={confirmed}
                    onChange={(e) => setConfirmed(e.target.checked)}
                  />
                  <Checkbox
                    label={t('opd.checkin.consent')}
                    checked={consent}
                    onChange={(e) => setConsent(e.target.checked)}
                  />
                </div>
              )}
              <ApiErrorNotice error={failure} />
              {isDone && (
                <Banner tone="success" title={t('opd.checkin.doneTitle', { token: cur.token })}>
                  {result
                    ? t('opd.checkin.doneBody', { next: t(`opd.checkin.next.${result.next}`) })
                    : t('opd.checkin.doneEarlier')}
                </Banner>
              )}
              {result?.next === 'BILLING' && can('billing:bill:create') && (
                <Link
                  to={`/billing?tab=new&patient=${cur.patient.id}`}
                  className="self-start font-semibold text-info underline underline-offset-2"
                >
                  {t('opd.checkin.openBilling')}
                </Link>
              )}
              <div className="flex flex-wrap gap-2 border-t border-line pt-4">
                {!isDone && can('opd:visit:create') && (
                  <Button onClick={doCheckIn} loading={checking} disabled={!confirmed}>
                    {actionLabel(t, cur)}
                  </Button>
                )}
                {!isDone && can('opd:appointment:update') && (
                  <>
                    <Button variant="secondary" onClick={() => setDialog('move')}>
                      {t('opd.appt.reschedule')}
                    </Button>
                    <Button variant="secondary" onClick={() => setDialog('cancel')}>
                      {t('opd.appt.cancel')}
                    </Button>
                  </>
                )}
                <Link
                  to={`/patients/${cur.patient.id}`}
                  className="inline-flex min-h-10 items-center rounded-control px-3 font-semibold text-info hover:bg-info-bg"
                >
                  {t('opd.checkin.editDetails')}
                </Link>
                {cur.visitId && (
                  <Link
                    to={`/opd/visits/${cur.visitId}`}
                    className="inline-flex min-h-10 items-center rounded-control px-3 font-semibold text-info hover:bg-info-bg"
                  >
                    {t('opd.appt.openVisit')}
                  </Link>
                )}
              </div>
              {!confirmed && !isDone && (
                <p className="text-sm text-muted">{t('opd.checkin.confirmFirst')}</p>
              )}
            </div>
          </Card>
        ) : (
          <EmptyState title={t('opd.checkin.pick')} description={t('opd.checkin.pickHint')} />
        )}

        <aside aria-label={t('opd.checkin.slipTitle')} className="lg:col-span-2 xl:col-span-1">
          <Card title={t('opd.checkin.slipTitle')}>
            {cur ? (
              <div className="flex flex-col gap-3">
                <div
                  id="opd-token-slip"
                  className="mx-auto flex w-full max-w-64 flex-col items-center gap-1 rounded-control border border-dashed border-line-strong bg-surface px-4 py-5 text-center"
                >
                  <span className="text-sm text-muted">
                    {t('opd.checkin.slipHospital', { hospital: hospital ?? '' })}
                  </span>
                  <span className="font-mono text-4xl font-bold text-ink">
                    {cur.token ?? result?.token.no ?? '-'}
                  </span>
                  <span className="font-semibold text-ink">{cur.doctor.name}</span>
                  <span className="text-sm text-muted">
                    {cur.visitType === 'TELE'
                      ? t('opd.checkin.slipVideo')
                      : t('opd.checkin.slipRoom', {
                          room: cur.doctor.room,
                          eta: result?.token.eta ?? cur.time,
                        })}
                  </span>
                </div>
                <p className="text-sm text-muted">{t('opd.checkin.slipNote')}</p>
                <Button
                  variant="secondary"
                  disabled={!cur.token}
                  onClick={() => globalThis.print?.()}
                  className="self-start"
                >
                  {t('opd.checkin.printSlip')}
                </Button>
              </div>
            ) : (
              <p className="text-base text-muted">{t('opd.checkin.pick')}</p>
            )}
          </Card>
        </aside>
      </div>

      <ScanQrDialog
        open={dialog === 'qr'}
        onOpenChange={(o) => setDialog(o ? 'qr' : null)}
        onFound={(code) => setQ(code, { reset: ['id'], set: { show: 'all' } })}
      />
      <AbhaDialog
        open={dialog === 'abha'}
        onOpenChange={(o) => setDialog(o ? 'abha' : null)}
        onFound={(name) => setQ(name, { reset: ['id'], set: { show: 'all' } })}
      />
      {cur && (
        <>
          <RescheduleDialog
            key={`move-${cur.id}`}
            appointment={cur}
            open={dialog === 'move'}
            onOpenChange={(o) => setDialog(o ? 'move' : null)}
          />
          <CancelDialog
            appointment={cur}
            open={dialog === 'cancel'}
            onOpenChange={(o) => setDialog(o ? 'cancel' : null)}
          />
        </>
      )}
    </Page>
  );
}
