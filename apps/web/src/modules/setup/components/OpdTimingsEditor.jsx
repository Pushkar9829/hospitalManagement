import { useTranslation } from 'react-i18next';
import { CopyCheck, Plus, X } from 'lucide-react';
import { translateValidation } from '@hms/i18n';
import { Button, IconButton, Input } from '@hms/ui';

/** Monday first, as Indian OPD rosters are written; `day` is 0 = Sunday … 6 = Saturday. */
const DAYS = [1, 2, 3, 4, 5, 6, 0];
const MAX_PER_DAY = 3;

function dayName(day, locale) {
  // 2026-10-04 is a Sunday.
  return new Intl.DateTimeFormat(locale, { weekday: 'long', timeZone: 'UTC' }).format(
    new Date(Date.UTC(2026, 9, 4 + day)),
  );
}

/**
 * OPD timings per weekday: up to three sessions a day (e.g. 09:00–13:00 and 17:00–20:00).
 * `value` is the departmentInput `opdTimings` array; `errors` its field errors by index.
 */
export function OpdTimingsEditor({ value = [], onChange, errors = [], disabled = false }) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'hi' ? 'hi-IN' : 'en-IN';
  const indexed = value.map((v, i) => ({ ...v, i }));

  const update = (i, patch) => onChange(value.map((v, j) => (j === i ? { ...v, ...patch } : v)));
  const remove = (i) => onChange(value.filter((_, j) => j !== i));
  const add = (day) => {
    const last = indexed.filter((s) => s.day === day).at(-1);
    onChange([
      ...value,
      last ? { day, from: last.to, to: last.to } : { day, from: '09:00', to: '13:00' },
    ]);
  };
  const copyMonday = () => {
    const monday = value.filter((s) => s.day === 1);
    onChange([
      ...value.filter((s) => s.day === 0 || s.day === 1),
      ...[2, 3, 4, 5, 6].flatMap((day) => monday.map((s) => ({ day, from: s.from, to: s.to }))),
    ]);
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted">{t('departments.timingsHint')}</p>
        {!disabled && (
          <Button
            size="sm"
            variant="secondary"
            icon={<CopyCheck size={14} aria-hidden="true" />}
            onClick={copyMonday}
            disabled={!value.some((s) => s.day === 1)}
          >
            {t('departments.copyMonday')}
          </Button>
        )}
      </div>
      <ul className="flex flex-col divide-y divide-line rounded-card border border-line">
        {DAYS.map((day) => {
          const sessions = indexed.filter((s) => s.day === day);
          const name = dayName(day, locale);
          return (
            <li key={day} className="flex flex-col gap-2 px-3 py-2 sm:flex-row sm:items-start">
              <span className="w-28 shrink-0 pt-2.5 text-base font-semibold text-ink">{name}</span>
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                {sessions.length === 0 && (
                  <span className="pt-2.5 text-sm text-muted">{t('departments.noOpd')}</span>
                )}
                {sessions.map((s, n) => {
                  const err = errors?.[s.i];
                  const message = translateValidation(t, err?.to?.message ?? err?.from?.message);
                  return (
                    <div key={s.i} className="flex flex-col gap-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Input
                          type="time"
                          aria-label={t('departments.sessionFrom', { day: name, n: n + 1 })}
                          className="w-32"
                          value={s.from}
                          disabled={disabled}
                          invalid={Boolean(err?.from)}
                          onChange={(e) => update(s.i, { from: e.target.value })}
                        />
                        <span aria-hidden="true" className="text-muted">
                          –
                        </span>
                        <Input
                          type="time"
                          aria-label={t('departments.sessionTo', { day: name, n: n + 1 })}
                          className="w-32"
                          value={s.to}
                          disabled={disabled}
                          invalid={Boolean(err?.to)}
                          onChange={(e) => update(s.i, { to: e.target.value })}
                        />
                        {!disabled && (
                          <IconButton
                            size="sm"
                            label={t('departments.removeSession', { day: name, n: n + 1 })}
                            icon={<X size={14} aria-hidden="true" />}
                            onClick={() => remove(s.i)}
                          />
                        )}
                      </div>
                      {message && (
                        <p role="alert" className="text-sm text-critical">
                          {message}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
              {!disabled && sessions.length < MAX_PER_DAY && (
                <Button
                  size="sm"
                  variant="ghost"
                  icon={<Plus size={14} aria-hidden="true" />}
                  onClick={() => add(day)}
                  className="self-start sm:mt-1"
                >
                  {t('departments.addSession')}
                  <span className="sr-only"> {name}</span>
                </Button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
