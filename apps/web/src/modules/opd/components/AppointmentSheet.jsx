import { useState } from 'react';
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { Button, ConfirmDialog, PatientBanner, Sheet, StatusBadge, useToast } from '@hms/ui';
import { QueryView } from '../../dx-kit/QueryView.jsx';
import { fmtDate } from '../../dx-kit/format.js';
import { inr } from '../../../lib/money.js';
import { useCan } from '../../../lib/useCan.js';
import { useMarkNoShowMutation, useOpdAppointmentQuery } from '../api.js';
import { APPT_TONE, ymdInstant } from '../opd.js';
import { CancelDialog, RescheduleDialog } from './AppointmentDialogs.jsx';

/** One field of a details list. */
export function Detail({ label, children, mono = false }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className={mono ? 'font-mono text-base text-ink' : 'text-base text-ink'}>{children}</dd>
    </div>
  );
}

/** The fee line: free follow-up (day n of the window), paid online, or due at the counter. */
export function feeText(t, fee) {
  if (!fee) return '';
  if (fee.amount === 0)
    return fee.freeDay
      ? t('opd.fee.freeDay', { day: fee.freeDay, window: fee.window })
      : t('opd.fee.free');
  if (fee.prepaid) return t('opd.fee.prepaid', { amount: inr(fee.amount) });
  if (fee.paid) return t('opd.fee.paid', { amount: inr(fee.amount) });
  return t('opd.fee.due', { amount: inr(fee.amount) });
}

/**
 * A booking opened from the appointment grid: patient, slot, fee, and the actions its status
 * allows (check in at the desk, reschedule, cancel with the refund rule, mark no-show).
 */
export function AppointmentSheet({ id, open, onOpenChange }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const can = useCan();
  const query = useOpdAppointmentQuery(id, { skip: !id });
  const [noShow] = useMarkNoShowMutation();
  const [dialog, setDialog] = useState(null);
  const a = query.data;
  const open_ = ['BOOKED', 'CONFIRMED'].includes(a?.status);
  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={a ? t('opd.appt.title', { time: a.time }) : t('opd.appt.loading')}
      description={a ? `${a.doctor.name} · ${fmtDate(ymdInstant(a.date))}` : undefined}
      footer={
        a &&
        open_ && (
          <div className="flex flex-wrap justify-end gap-2">
            {can('opd:appointment:update') && (
              <>
                <Button variant="secondary" onClick={() => setDialog('noShow')}>
                  {t('opd.appt.noShow')}
                </Button>
                <Button variant="secondary" onClick={() => setDialog('cancel')}>
                  {t('opd.appt.cancel')}
                </Button>
                <Button variant="secondary" onClick={() => setDialog('move')}>
                  {t('opd.appt.reschedule')}
                </Button>
              </>
            )}
            {can('opd:visit:create') && (
              <Link
                to={`/opd/check-in?id=${a.id}`}
                className="inline-flex min-h-10 items-center rounded-control bg-primary px-4 font-semibold text-on-primary hover:bg-primary-hover"
              >
                {t('opd.appt.goCheckIn')}
              </Link>
            )}
          </div>
        )
      }
    >
      <QueryView query={query}>
        {(appt) => (
          <div className="flex flex-col gap-4">
            <PatientBanner
              name={appt.patient.name}
              age={appt.patient.age}
              sex={appt.patient.gender}
              uhid={appt.patient.uhid}
              allergies={appt.patient.allergies}
              noKnownAllergies={appt.patient.noKnownAllergies}
            />
            <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Detail label={t('opd.appt.status')}>
                <StatusBadge
                  tone={APPT_TONE[appt.status]}
                  label={t(`opd.apptStatus.${appt.status}`)}
                />
              </Detail>
              <Detail label={t('opd.appt.no')} mono>
                {appt.apptNo}
              </Detail>
              <Detail label={t('opd.book.visitType')}>
                {t(`opd.visitType.${appt.visitType}`)}
              </Detail>
              <Detail label={t('opd.book.channel')}>{t(`opd.channel.${appt.channel}`)}</Detail>
              <Detail label={t('opd.appt.fee')}>{feeText(t, appt.fee)}</Detail>
              <Detail label={t('opd.appt.token')} mono>
                {appt.token ?? '-'}
              </Detail>
              {appt.notes && <Detail label={t('opd.book.notes')}>{appt.notes}</Detail>}
              {appt.reason && <Detail label={t('opd.appt.reason')}>{appt.reason}</Detail>}
            </dl>
            {appt.visitId && (
              <Link
                to={`/opd/visits/${appt.visitId}`}
                className="self-start font-semibold text-info underline underline-offset-2"
              >
                {t('opd.appt.openVisit')}
              </Link>
            )}
            <RescheduleDialog
              appointment={appt}
              open={dialog === 'move'}
              onOpenChange={(o) => setDialog(o ? 'move' : null)}
              onDone={() => onOpenChange(false)}
            />
            <CancelDialog
              appointment={appt}
              open={dialog === 'cancel'}
              onOpenChange={(o) => setDialog(o ? 'cancel' : null)}
              onDone={() => onOpenChange(false)}
            />
            <ConfirmDialog
              open={dialog === 'noShow'}
              onOpenChange={(o) => setDialog(o ? 'noShow' : null)}
              title={t('opd.appt.noShowTitle', { name: appt.patient.name })}
              description={t('opd.appt.noShowHint')}
              confirmLabel={t('opd.appt.noShow')}
              cancelLabel={t('opd.appt.keep')}
              requireReason={null}
              onConfirm={async () => {
                await noShow({ id: appt.id }).unwrap();
                toast({ tone: 'success', title: t('opd.appt.markedNoShow') });
                onOpenChange(false);
              }}
            />
          </div>
        )}
      </QueryView>
    </Sheet>
  );
}
