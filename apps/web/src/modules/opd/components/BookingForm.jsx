import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { Banner, Button, FormField, Select, Textarea, useToast } from '@hms/ui';
import { ApiErrorNotice } from '../../../components/ApiErrorNotice.jsx';
import { apiError } from '../../../app/apiError.js';
import { applyFieldErrors, cleanResolver } from '../../../lib/forms.js';
import { PatientPicker } from '../../patients/components/PatientPicker.jsx';
import { useBookAppointmentMutation, useOpdDoctorsQuery, useOpdSlotsQuery } from '../api.js';
import { CHANNELS, VISIT_TYPES } from '../opd.js';

const schema = z
  .object({
    // Loose: the resolver's output replaces the values, and the card's name and UHID are needed.
    patient: z.looseObject({ id: z.string() }).nullable().optional(),
    doctorId: z.string({ error: 'opd.book.errors.doctor' }).min(1, 'opd.book.errors.doctor'),
    time: z.string().optional(),
    visitType: z.string().min(1),
    channel: z.string().min(1),
    notes: z.string().max(300).optional(),
  })
  .superRefine((v, ctx) => {
    if (!v.patient)
      ctx.addIssue({ code: 'custom', path: ['patient'], message: 'opd.book.errors.patient' });
    if (v.channel !== 'WALK_IN' && !v.time)
      ctx.addIssue({ code: 'custom', path: ['time'], message: 'opd.book.errors.time' });
  });

/**
 * Quick booking: a real patient (GET /patients), doctor, a free slot on the chosen date, visit
 * type and channel (POST /opd/appointments). A walk-in skips the slot and is checked in at once.
 * When two desks take the same slot, the 409 names the next free one and offers it.
 * `prefill` ({ doctorId, time }) comes from a click on a free slot in the grid.
 */
export function BookingForm({ date, prefill, onBooked, walkIn = false, submitLabel }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [book] = useBookAppointmentMutation();
  const [failure, setFailure] = useState(null);
  const doctors = useOpdDoctorsQuery();
  const slots = useOpdSlotsQuery({ date });
  const {
    control,
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: cleanResolver(schema),
    mode: 'onBlur',
    defaultValues: {
      patient: null,
      doctorId: prefill?.doctorId ?? '',
      time: prefill?.time ?? '',
      visitType: 'NEW',
      channel: walkIn ? 'WALK_IN' : 'DESK',
      notes: '',
    },
  });

  useEffect(() => {
    if (prefill?.doctorId) setValue('doctorId', prefill.doctorId);
    if (prefill?.time) setValue('time', prefill.time);
  }, [prefill, setValue]);

  const doctorId = watch('doctorId');
  const channel = watch('channel');
  const freeTimes =
    slots.data?.cells
      .find((c) => c.doctorId === doctorId)
      ?.slots.filter((s) => s.status === 'FREE')
      .map((s) => s.time) ?? [];

  const err = (name) => (errors[name]?.message ? t(errors[name].message) : undefined);

  const submit = async (values) => {
    setFailure(null);
    try {
      const res = await book({
        patient: values.patient,
        patientId: values.patient.id,
        doctorId: values.doctorId,
        date,
        time: values.channel === 'WALK_IN' ? undefined : values.time,
        visitType: values.visitType,
        channel: values.channel,
        notes: values.notes,
      }).unwrap();
      const token = res.token?.no;
      toast({
        tone: 'success',
        title: token
          ? t('opd.book.walkInDone', { name: values.patient.name, token })
          : t('opd.book.done', { name: values.patient.name, time: res.time }),
        description: token ? undefined : t('opd.book.smsSent'),
      });
      reset({ ...values, patient: null, time: '', notes: '' });
      onBooked?.(res);
    } catch (e) {
      const problem = apiError(e);
      setFailure(
        problem?.code === 'SLOT_TAKEN'
          ? problem
          : applyFieldErrors(e, setError, ['patient', 'doctorId', 'time']),
      );
    }
  };

  const nextFree = failure?.code === 'SLOT_TAKEN' ? failure.details?.[0]?.nextFree : null;

  return (
    <form onSubmit={handleSubmit(submit)} noValidate className="flex flex-col gap-3">
      {failure?.code === 'SLOT_TAKEN' ? (
        <Banner
          tone="warning"
          title={t('opd.book.slotTaken')}
          action={
            nextFree && (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  setValue('time', nextFree);
                  setFailure(null);
                }}
              >
                {t('opd.book.useSlot', { time: nextFree })}
              </Button>
            )
          }
        >
          {failure.message}
        </Banner>
      ) : (
        <ApiErrorNotice error={failure} />
      )}
      <Controller
        control={control}
        name="patient"
        render={({ field }) => (
          <PatientPicker
            label={t('opd.book.patient')}
            value={field.value}
            onChange={field.onChange}
            error={err('patient')}
          />
        )}
      />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <FormField label={t('opd.book.doctor')} error={err('doctorId')} required>
          <Select
            {...register('doctorId')}
            placeholder={t('opd.book.chooseDoctor')}
            options={(doctors.data?.items ?? []).map((d) => ({
              value: d.id,
              label: `${d.name} · ${d.department}`,
            }))}
          />
        </FormField>
        {channel !== 'WALK_IN' && (
          <FormField
            label={t('opd.book.slot')}
            error={err('time')}
            hint={doctorId && !freeTimes.length ? t('opd.book.noFree') : undefined}
            required
          >
            <Select
              {...register('time')}
              placeholder={t('opd.book.chooseSlot')}
              options={[...new Set([...(prefill?.time ? [prefill.time] : []), ...freeTimes])]
                .sort()
                .map((x) => ({ value: x, label: x }))}
            />
          </FormField>
        )}
        <FormField label={t('opd.book.visitType')}>
          <Select
            {...register('visitType')}
            options={VISIT_TYPES.filter((v) => v !== 'HEALTH_CHECK').map((v) => ({
              value: v,
              label: t(`opd.visitType.${v}`),
            }))}
          />
        </FormField>
        <FormField label={t('opd.book.channel')}>
          <Select
            {...register('channel')}
            options={CHANNELS.map((c) => ({ value: c, label: t(`opd.channel.${c}`) }))}
          />
        </FormField>
      </div>
      <FormField label={t('opd.book.notes')} optional>
        <Textarea {...register('notes')} rows={2} />
      </FormField>
      <Button type="submit" loading={isSubmitting} className="self-start">
        {submitLabel ?? (channel === 'WALK_IN' ? t('opd.book.walkIn') : t('opd.book.submit'))}
      </Button>
    </form>
  );
}
