import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { Button, Card, ConfirmDialog, EmptyState, Select, StatusBadge, useToast } from '@hms/ui';
import { KpiRow } from '../../../dx-kit/KpiRow.jsx';
import { QueryView } from '../../../dx-kit/QueryView.jsx';
import { fmtMinutes } from '../../../dx-kit/format.js';
import { useCan } from '../../../../lib/useCan.js';
import { useUrlState } from '../../../../lib/useUrlState.js';
import {
  useCallVisitMutation,
  useMoveVisitMutation,
  useOpdDoctorsQuery,
  useOpdQueueQuery,
  useSkipVisitMutation,
} from '../../api.js';
import { PRIORITY_TONE, STAGE_TONE } from '../../opd.js';

/**
 * The doctor's OPD queue (the menu's "OPD Consultation"): patients with vitals done, in the
 * order of rule R11 (red first, then booked on time, walk-ins, late). Call opens the
 * consultation; skip sends the token to recall; moving a patient up needs a reason (audited).
 */
export function DoctorQueue() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const navigate = useNavigate();
  const can = useCan();
  const [doctorId, setDoctorId] = useUrlState('doctor', 'me');
  const doctors = useOpdDoctorsQuery();
  const queue = useOpdQueueQuery({ doctorId, stage: 'all' }, { pollingInterval: 30_000 });
  const [call, { isLoading: calling }] = useCallVisitMutation();
  const [skip] = useSkipVisitMutation();
  const [move] = useMoveVisitMutation();
  const [dialog, setDialog] = useState(null);
  const items = queue.data?.items ?? [];
  const ready = items.filter((q) => ['TRIAGED', 'CALLED', 'WITH_DOCTOR'].includes(q.stage));
  const waiting = items.filter((q) => ['WAITING', 'IN_TRIAGE', 'NOT_ARRIVED'].includes(q.stage));
  const seen = items.filter((q) => q.stage === 'DONE');
  const canCall = can('opd:consultation:write');

  const open = async (q) => {
    if (q.stage !== 'WITH_DOCTOR' && canCall) await call({ id: q.visitId }).unwrap();
    navigate(`/opd/visits/${q.visitId}`);
  };

  const row = (q, actions = true) => (
    <li
      key={q.visitId ?? q.appointmentId}
      className="flex flex-wrap items-center gap-3 border-b border-line px-1 py-3 last:border-b-0"
    >
      <span className="w-14 font-mono text-base font-semibold">{q.token ?? '-'}</span>
      <span className="min-w-0 flex-1">
        <strong className="block truncate text-base text-ink">
          {q.patient.name}
          <span className="font-normal text-muted">
            {' · '}
            {q.patient.age} · <span className="font-mono">{q.patient.uhid}</span>
          </span>
        </strong>
        <span className="block truncate text-sm text-muted">
          {[
            t(`opd.visitType.${q.visitType}`),
            q.complaint,
            q.vitals?.bp && `${t('opd.print.bp')} ${q.vitals.bp}`,
            q.waitedMin != null && t('opd.queue.waited', { time: fmtMinutes(q.waitedMin, t) }),
            q.slotTime && t('opd.queue.slotAt', { time: q.slotTime }),
          ]
            .filter(Boolean)
            .join(' · ')}
        </span>
      </span>
      <span className="flex flex-wrap items-center gap-1.5">
        {q.priority && q.priority !== 'GREEN' && (
          <StatusBadge tone={PRIORITY_TONE[q.priority]} label={t(`opd.priority.${q.priority}`)} />
        )}
        {q.late && <StatusBadge tone="warning" label={t('opd.queue.late')} />}
        <StatusBadge tone={STAGE_TONE[q.stage]} label={t(`opd.stage.${q.stage}`)} />
      </span>
      {actions && q.visitId && (
        <span className="flex flex-wrap gap-1.5">
          <Button size="sm" loading={calling} onClick={() => open(q)}>
            {q.stage === 'WITH_DOCTOR' ? t('opd.dq.open') : t('opd.dq.call')}
          </Button>
          {canCall && q.stage !== 'WITH_DOCTOR' && (
            <>
              <Button size="sm" variant="secondary" onClick={() => setDialog({ kind: 'skip', q })}>
                {t('opd.dq.skip')}
              </Button>
              {q.priority !== 'RED' && (
                <Button size="sm" variant="ghost" onClick={() => setDialog({ kind: 'move', q })}>
                  {t('opd.dq.moveUp')}
                </Button>
              )}
            </>
          )}
        </span>
      )}
    </li>
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <KpiRow
          className="flex-1"
          loading={queue.isLoading}
          items={[
            { label: t('opd.dq.ready'), value: ready.length },
            { label: t('opd.dq.inBuilding'), value: waiting.filter((q) => q.visitId).length },
            { label: t('opd.dq.booked'), value: waiting.filter((q) => !q.visitId).length },
            { label: t('opd.dq.seen'), value: seen.length },
          ]}
        />
        <div className="flex flex-col gap-1">
          <label htmlFor="dq-doctor" className="text-sm font-semibold">
            {t('opd.book.doctor')}
          </label>
          <Select
            id="dq-doctor"
            className="w-60"
            value={doctorId}
            onChange={(e) => setDoctorId(e.target.value)}
            options={[
              { value: 'me', label: t('opd.dq.me') },
              ...(doctors.data?.items ?? []).map((d) => ({ value: d.id, label: d.name })),
            ]}
          />
        </div>
      </div>
      <QueryView query={queue} rows={5}>
        {() => (
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_24rem]">
            <Card title={t('opd.dq.readyTitle')} description={t('opd.dq.readyHint')}>
              {ready.length ? (
                <ul aria-label={t('opd.dq.readyTitle')}>{ready.map((q) => row(q))}</ul>
              ) : (
                <EmptyState
                  bordered={false}
                  title={t('opd.dq.none')}
                  description={t('opd.dq.noneHint')}
                />
              )}
            </Card>
            <div className="flex flex-col gap-4">
              <Card title={t('opd.dq.waitingTitle')}>
                {waiting.length ? (
                  <ul aria-label={t('opd.dq.waitingTitle')}>{waiting.map((q) => row(q, false))}</ul>
                ) : (
                  <p className="text-base text-muted">{t('opd.dq.noWaiting')}</p>
                )}
              </Card>
              <Card title={t('opd.dq.seenTitle')}>
                {seen.length ? (
                  <ul aria-label={t('opd.dq.seenTitle')}>
                    {seen.map((q) => (
                      <li key={q.visitId} className="border-b border-line last:border-b-0">
                        <button
                          type="button"
                          onClick={() => navigate(`/opd/visits/${q.visitId}`)}
                          className="flex w-full cursor-pointer items-center gap-3 px-1 py-2 text-left hover:bg-surface-2"
                        >
                          <span className="w-14 font-mono text-sm">{q.token}</span>
                          <span className="flex-1">{q.patient.name}</span>
                          <StatusBadge tone="neutral" label={t('opd.stage.DONE')} />
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-base text-muted">{t('opd.dq.noSeen')}</p>
                )}
              </Card>
            </div>
          </div>
        )}
      </QueryView>
      <ConfirmDialog
        open={dialog?.kind === 'skip'}
        onOpenChange={(o) => !o && setDialog(null)}
        title={t('opd.dq.skipTitle', { token: dialog?.q.token, name: dialog?.q.patient.name })}
        description={t('opd.dq.skipHint')}
        confirmLabel={t('opd.dq.skip')}
        cancelLabel={t('opd.appt.keep')}
        reasonLabel={t('opd.appt.reason')}
        requireReason={false}
        destructive={false}
        onConfirm={async (reason) => {
          await skip({ id: dialog.q.visitId, reason }).unwrap();
          toast({ tone: 'success', title: t('opd.dq.skipped', { token: dialog.q.token }) });
        }}
      />
      <ConfirmDialog
        open={dialog?.kind === 'move'}
        onOpenChange={(o) => !o && setDialog(null)}
        title={t('opd.dq.moveTitle', { token: dialog?.q.token, name: dialog?.q.patient.name })}
        description={t('opd.dq.moveHint')}
        confirmLabel={t('opd.dq.moveUp')}
        cancelLabel={t('opd.appt.keep')}
        reasonLabel={t('opd.appt.reason')}
        destructive={false}
        onConfirm={async (reason) => {
          await move({ id: dialog.q.visitId, reason }).unwrap();
          toast({ tone: 'success', title: t('opd.dq.moved', { token: dialog.q.token }) });
        }}
      />
    </div>
  );
}
