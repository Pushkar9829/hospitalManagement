import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { Button, Dialog, FormField, Select, Input, useToast } from '@hms/ui';
import { FormDialog } from '../../dx-kit/FormDialog.jsx';
import { useBlockDatesMutation, useBulkMoveAppointmentsMutation, useOpdDoctorsQuery } from '../api.js';
import { todayIST } from '../opd.js';

const blockSchema = (t) =>
  z
    .object({
      doctorId: z.string().min(1, t('opd.book.errors.doctor')),
      from: z.string().min(1, t('opd.appt.errors.date')),
      to: z.string().min(1, t('opd.appt.errors.date')),
      reason: z.string().trim().min(3, t('opd.appt.errors.reason')),
    })
    .refine((v) => v.to >= v.from, { path: ['to'], message: t('opd.block.errors.order') });

/**
 * Doctor leave or an ad-hoc block (rule R10): blocks the slots, lists the bookings it hits, and
 * moves them in bulk to another doctor of the same specialty or another date; patients are
 * messaged by the API. `doctorId` preselects the doctor (OPD settings).
 */
export function BlockLeaveDialog({ open, onOpenChange, doctorId }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const doctors = useOpdDoctorsQuery();
  const [block] = useBlockDatesMutation();
  const [bulkMove, { isLoading: moving }] = useBulkMoveAppointmentsMutation();
  const [result, setResult] = useState(null);
  const [target, setTarget] = useState({ doctorId: '', date: '' });
  const today = todayIST();
  const list = doctors.data?.items ?? [];
  const blockedDoctor = list.find((d) => d.id === result?.block.doctorId);
  const sameSpecialty = list.filter(
    (d) => d.department === blockedDoctor?.department && d.id !== blockedDoctor?.id,
  );

  return (
    <>
      <FormDialog
        open={open}
        onOpenChange={onOpenChange}
        title={t('opd.block.title')}
        description={t('opd.block.hint')}
        schema={blockSchema(t)}
        defaultValues={{ doctorId: doctorId ?? '', from: today, to: today, reason: '' }}
        fields={[
          {
            name: 'doctorId',
            label: t('opd.book.doctor'),
            type: 'select',
            options: list.map((d) => ({ value: d.id, label: d.name })),
            required: true,
            span: 2,
          },
          { name: 'from', label: t('opd.block.from'), type: 'date', required: true },
          { name: 'to', label: t('opd.block.to'), type: 'date', required: true },
          { name: 'reason', label: t('opd.appt.reason'), type: 'textarea', required: true },
        ]}
        submitLabel={t('opd.block.submit')}
        onSubmit={({ doctorId: id, ...body }) => block({ doctorId: id, ...body }).unwrap()}
        onDone={(res) => {
          if (res.affected.length) setResult(res);
          else toast({ tone: 'success', title: t('opd.block.doneNone') });
        }}
      />
      <Dialog
        open={Boolean(result)}
        onOpenChange={(o) => !o && setResult(null)}
        title={t('opd.block.affected', { count: result?.affected.length ?? 0 })}
        description={t('opd.block.affectedHint')}
        size="lg"
        footer={
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="secondary" onClick={() => setResult(null)}>
              {t('opd.block.later')}
            </Button>
            <Button
              loading={moving}
              disabled={!target.doctorId && !target.date}
              onClick={async () => {
                const r = await bulkMove({
                  appointmentIds: result.affected.map((a) => a.id),
                  doctorId: target.doctorId || undefined,
                  date: target.date || undefined,
                }).unwrap();
                toast({
                  tone: 'success',
                  title: t('opd.block.moved', { count: r.moved }),
                  description: t('opd.block.messaged', { count: r.messaged }),
                });
                setResult(null);
              }}
            >
              {t('opd.block.moveAll')}
            </Button>
          </div>
        }
      >
        {result && (
          <div className="flex flex-col gap-4">
            <ul className="flex max-h-60 flex-col divide-y divide-line overflow-auto rounded-control border border-line">
              {result.affected.map((a) => (
                <li key={a.id} className="flex items-center gap-3 px-3 py-2 text-base">
                  <span className="font-mono text-sm">{a.time}</span>
                  <span className="flex-1">{a.patient.name}</span>
                  <span className="font-mono text-sm text-muted">{a.patient.uhid}</span>
                </li>
              ))}
            </ul>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <FormField label={t('opd.block.toDoctor')} optional>
                <Select
                  value={target.doctorId}
                  onChange={(e) => setTarget((x) => ({ ...x, doctorId: e.target.value }))}
                  placeholder={t('opd.block.sameDoctor')}
                  options={sameSpecialty.map((d) => ({ value: d.id, label: d.name }))}
                />
              </FormField>
              <FormField label={t('opd.block.toDate')} optional>
                <Input
                  type="date"
                  value={target.date}
                  onChange={(e) => setTarget((x) => ({ ...x, date: e.target.value }))}
                />
              </FormField>
            </div>
          </div>
        )}
      </Dialog>
    </>
  );
}
