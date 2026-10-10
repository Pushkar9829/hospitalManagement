import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { ConfirmDialog, useToast } from '@hms/ui';
import { FormDialog } from '../../dx-kit/FormDialog.jsx';
import { inr } from '../../../lib/money.js';
import {
  useCancelAppointmentMutation,
  useOpdDoctorsQuery,
  useOpdSlotsQuery,
  useRescheduleAppointmentMutation,
} from '../api.js';
import { todayIST } from '../opd.js';

const rescheduleSchema = (t) =>
  z.object({
    doctorId: z.string().min(1, t('opd.book.errors.doctor')),
    date: z.string().min(1, t('opd.appt.errors.date')),
    time: z.string().min(1, t('opd.book.errors.time')),
    reason: z.string().trim().min(3, t('opd.appt.errors.reason')),
  });

/** Moves a booking that has not arrived to another slot (POST /opd/appointments/{id}/reschedule). */
export function RescheduleDialog({ appointment, open, onOpenChange, onDone }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [move] = useRescheduleAppointmentMutation();
  const [date, setDate] = useState(appointment?.date ?? todayIST());
  const [doctorId, setDoctorId] = useState(appointment?.doctor?.id ?? '');
  const doctors = useOpdDoctorsQuery();
  const slots = useOpdSlotsQuery({ date }, { skip: !open });
  const free =
    slots.data?.cells
      .find((c) => c.doctorId === doctorId)
      ?.slots.filter((s) => s.status === 'FREE')
      .map((s) => ({ value: s.time, label: s.time })) ?? [];
  if (!appointment) return null;
  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t('opd.appt.rescheduleTitle', { name: appointment.patient.name })}
      description={t('opd.appt.rescheduleHint')}
      schema={rescheduleSchema(t)}
      defaultValues={{
        doctorId: appointment.doctor.id,
        date: appointment.date,
        time: '',
        reason: '',
      }}
      fields={[
        {
          name: 'doctorId',
          label: t('opd.book.doctor'),
          type: 'select',
          options: (doctors.data?.items ?? []).map((d) => ({ value: d.id, label: d.name })),
          required: true,
          onChange: setDoctorId,
        },
        { name: 'date', label: t('opd.appt.date'), type: 'date', required: true, onChange: setDate },
        {
          name: 'time',
          label: t('opd.book.slot'),
          type: 'select',
          options: free,
          required: true,
          hint: free.length ? undefined : t('opd.book.noFree'),
        },
        { name: 'reason', label: t('opd.appt.reason'), type: 'textarea', required: true },
      ]}
      submitLabel={t('opd.appt.reschedule')}
      onSubmit={(v) => move({ id: appointment.id, ...v }).unwrap()}
      onDone={(res) => {
        toast({
          tone: 'success',
          title: t('opd.appt.rescheduled', {
            name: appointment.patient.name,
            time: res.appointment.time,
          }),
          description: t('opd.book.smsSent'),
        });
        onDone?.(res);
      }}
    />
  );
}

/** Cancels a booking with a reason; the refund rule (R9) is applied by the API and shown. */
export function CancelDialog({ appointment, open, onOpenChange, onDone }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [cancel] = useCancelAppointmentMutation();
  if (!appointment) return null;
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t('opd.appt.cancelTitle', {
        name: appointment.patient.name,
        time: appointment.time,
      })}
      description={t('opd.appt.cancelHint')}
      confirmLabel={t('opd.appt.cancel')}
      cancelLabel={t('opd.appt.keep')}
      reasonLabel={t('opd.appt.reason')}
      onConfirm={async (reason) => {
        const res = await cancel({ id: appointment.id, reason }).unwrap();
        toast({
          tone: 'success',
          title: t('opd.appt.cancelled', { name: appointment.patient.name }),
          description: res.refund
            ? t(`opd.appt.refund.${res.refund.mode}`, { amount: inr(res.refund.amount) })
            : undefined,
        });
        onDone?.(res);
      }}
    />
  );
}
