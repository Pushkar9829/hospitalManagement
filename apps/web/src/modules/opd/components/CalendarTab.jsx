import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button, Card, IconButton, Select, formatLongDate } from '@hms/ui';
import { QueryView } from '../../dx-kit/QueryView.jsx';
import { localeOf } from '../../dx-kit/format.js';
import { useUrlState } from '../../../lib/useUrlState.js';
import { useCan } from '../../../lib/useCan.js';
import { useOpdDepartmentsQuery, useOpdQueueQuery, useOpdSlotsQuery } from '../api.js';
import { addDaysYmd, todayIST, ymdInstant } from '../opd.js';
import { AppointmentSheet } from './AppointmentSheet.jsx';
import { BookingForm } from './BookingForm.jsx';
import { QueueList } from './QueueList.jsx';
import { SlotGrid, SlotLegend } from './SlotGrid.jsx';

/**
 * Appointment calendar (board "OPD appointments", main tab): the day's slot grid by doctor, the
 * picked doctor's live queue, and quick booking. Date, department, doctor and the open booking
 * live in the URL (?date=&dept=&doctor=&appt=).
 */
export function CalendarTab() {
  const { t, i18n } = useTranslation();
  const can = useCan();
  const today = todayIST();
  const [date, setDate] = useUrlState('date', today);
  const [dept, setDept] = useUrlState('dept', '');
  const [doctorParam, setDoctor] = useUrlState('doctor', '');
  const [apptId, setAppt] = useUrlState('appt', '');
  const [prefill, setPrefill] = useState(null);
  const departments = useOpdDepartmentsQuery();
  const slots = useOpdSlotsQuery({ date, department: dept });
  const doctorId = doctorParam || slots.data?.doctors[0]?.id || '';
  const doctor = slots.data?.doctors.find((d) => d.id === doctorId);
  const queue = useOpdQueueQuery({ doctorId, stage: 'all' }, { skip: !doctorId || date !== today });

  const pickSlot = (slot) => {
    if (slot.appointmentId) setAppt(slot.appointmentId);
    else {
      setPrefill({ doctorId: slot.doctorId, time: slot.time, at: Date.now() });
      document.getElementById('opd-quick-book')?.scrollIntoView({ block: 'nearest' });
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <IconButton
            label={t('opd.cal.prevDay')}
            icon={<ChevronLeft size={18} aria-hidden="true" />}
            onClick={() => setDate(addDaysYmd(date, -1))}
          />
          <strong className="min-w-56 text-center text-md text-ink" aria-live="polite">
            {formatLongDate(ymdInstant(date), localeOf(i18n))}
          </strong>
          <IconButton
            label={t('opd.cal.nextDay')}
            icon={<ChevronRight size={18} aria-hidden="true" />}
            onClick={() => setDate(addDaysYmd(date, 1))}
          />
          {date !== today && (
            <Button variant="ghost" size="sm" onClick={() => setDate(today)}>
              {t('opd.cal.today')}
            </Button>
          )}
          <label className="sr-only" htmlFor="opd-dept">
            {t('opd.cal.department')}
          </label>
          <Select
            id="opd-dept"
            className="w-48"
            value={dept}
            onChange={(e) => setDept(e.target.value, { reset: ['doctor'] })}
            options={[
              { value: '', label: t('opd.cal.allDepartments') },
              ...(departments.data?.items ?? []).map((d) => ({ value: d.name, label: d.name })),
            ]}
          />
        </div>
        <SlotLegend />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_24rem]">
        <Card title={t('opd.cal.gridTitle')} padding={false} bodyClassName="p-3">
          <QueryView
            query={slots}
            rows={8}
            empty={t('opd.cal.noDoctors')}
            isEmpty={(d) => !d.doctors.length}
          >
            {(data) => (
              <SlotGrid
                data={data}
                selectedDoctorId={doctorId}
                onPickDoctor={(id) => setDoctor(id)}
                onPickSlot={pickSlot}
              />
            )}
          </QueryView>
        </Card>
        <div className="flex flex-col gap-4">
          <Card
            title={
              doctor ? t('opd.cal.queueTitle', { doctor: doctor.name }) : t('opd.cal.queueEmpty')
            }
            actions={
              doctor && (
                <span className="text-sm text-muted">
                  {t('opd.cal.room', { room: doctor.room })}
                </span>
              )
            }
          >
            {date !== today ? (
              <p className="text-base text-muted">{t('opd.cal.queueToday')}</p>
            ) : (
              <QueryView
                query={queue}
                empty={t('opd.cal.queueNone')}
                isEmpty={(d) => !d.items.length}
              >
                {(data) => (
                  <QueueList items={data.items.slice(0, 12)} label={t('opd.cal.queueLabel')} />
                )}
              </QueryView>
            )}
          </Card>
          {can('opd:appointment:create') && (
            <Card title={t('opd.cal.quickBook')} id="opd-quick-book">
              <BookingForm date={date} prefill={prefill} />
            </Card>
          )}
        </div>
      </div>
      <AppointmentSheet
        id={apptId}
        open={Boolean(apptId)}
        onOpenChange={(o) => !o && setAppt('')}
      />
    </div>
  );
}
