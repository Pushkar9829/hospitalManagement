import { useTranslation } from 'react-i18next';
import { cn } from '@hms/ui';
import { SLOT_TONE } from '../opd.js';

const cellTone = {
  info: 'bg-info-bg text-info border-info/30',
  success: 'bg-success-bg text-success border-success/30',
  warning: 'bg-warning-bg text-warning border-warning/30',
  critical: 'bg-critical-bg text-critical border-critical/30',
  neutral: 'bg-neutral-bg text-neutral border-line',
};

/**
 * The appointment calendar: one row per slot time, one column per doctor. Every slot is a
 * button (Tab and Enter): a free slot starts a booking, a booked one opens the booking. The
 * doctor headers pick whose queue shows beside the grid. Status is written in each cell, so
 * colour is never the only signal.
 */
export function SlotGrid({ data, selectedDoctorId, onPickDoctor, onPickSlot }) {
  const { t } = useTranslation();
  const { doctors, times, cells } = data;
  const byDoctor = Object.fromEntries(cells.map((c) => [c.doctorId, c.slots]));
  return (
    <div className="max-h-[640px] overflow-auto rounded-card border border-line">
      <table className="w-full min-w-[640px] border-collapse text-base">
        <caption className="sr-only">{t('opd.grid.caption')}</caption>
        <thead className="sticky top-0 z-10 bg-surface-2">
          <tr>
            <th scope="col" className="w-20 border-b border-line px-3 py-2 text-left text-sm">
              {t('opd.grid.time')}
            </th>
            {doctors.map((d) => {
              const on = d.id === selectedDoctorId;
              return (
                <th
                  key={d.id}
                  scope="col"
                  className="border-b border-l border-line px-2 py-2 text-left align-top"
                >
                  <button
                    type="button"
                    aria-pressed={on}
                    onClick={() => onPickDoctor(d.id)}
                    className={cn(
                      'w-full cursor-pointer rounded-control px-2 py-1 text-left',
                      on ? 'bg-info-bg' : 'hover:bg-surface',
                    )}
                  >
                    <span className="block font-semibold text-ink">{d.name}</span>
                    <span className="block text-sm font-normal text-muted">
                      {t('opd.grid.deptRoom', { department: d.department, room: d.room })}
                    </span>
                  </button>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {times.map((time, row) => (
            <tr key={time} className={cn(time === data.now && 'border-t-2 border-t-accent')}>
              <th
                scope="row"
                className="border-b border-line px-3 py-1.5 text-left font-mono text-sm font-medium"
              >
                {time}
              </th>
              {doctors.map((d) => {
                const slot = byDoctor[d.id]?.[row];
                if (!slot || slot.status === 'NONE')
                  return (
                    <td key={d.id} className="border-b border-l border-line bg-ground px-2 py-1.5">
                      <span className="sr-only">{t('opd.grid.noSession')}</span>
                    </td>
                  );
                const tone = SLOT_TONE[slot.status] ?? 'neutral';
                const label = t(`opd.slot.${slot.status}`);
                const clickable = slot.status === 'FREE' || slot.appointmentId;
                return (
                  <td key={d.id} className="border-b border-l border-line px-1.5 py-1">
                    <button
                      type="button"
                      disabled={!clickable}
                      onClick={() => onPickSlot({ ...slot, doctorId: d.id, doctor: d })}
                      aria-label={t('opd.grid.cellLabel', {
                        time,
                        doctor: d.name,
                        status: label,
                        patient: slot.patientName ?? '',
                      })}
                      className={cn(
                        'flex min-h-9 w-full flex-col rounded-control border px-2 py-1 text-left text-sm',
                        clickable ? 'cursor-pointer hover:brightness-95' : 'cursor-default',
                        slot.status === 'FREE'
                          ? 'border-dashed border-line-strong bg-surface text-muted'
                          : cellTone[tone],
                        (slot.status === 'PAST' || slot.status === 'BLOCKED') && 'opacity-70',
                      )}
                    >
                      <span className="truncate font-semibold">{slot.patientName || label}</span>
                      {slot.patientName && <span className="truncate text-xs">{label}</span>}
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** The legend above the grid: the same chips the cells use. */
export function SlotLegend() {
  const { t } = useTranslation();
  const keys = ['FREE', 'BOOKED', 'CHECKED_IN', 'IN_CONSULT', 'NO_SHOW'];
  return (
    <ul className="flex flex-wrap gap-2" aria-label={t('opd.grid.legend')}>
      {keys.map((k) => (
        <li
          key={k}
          className={cn(
            'rounded-chip border px-2 py-0.5 text-sm font-semibold',
            k === 'FREE'
              ? 'border-dashed border-line-strong bg-surface text-muted'
              : cellTone[SLOT_TONE[k]],
          )}
        >
          {t(`opd.slot.${k}`)}
        </li>
      ))}
    </ul>
  );
}
