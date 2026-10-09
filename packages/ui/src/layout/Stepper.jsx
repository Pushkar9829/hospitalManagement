import { Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '../lib/cn.js';

/** Numbered steps for multi-step flows (setup wizard, admission). `current` is 0-based. */
export function Stepper({ steps, current = 0, className }) {
  const { t } = useTranslation();
  return (
    <ol
      aria-label={t('stepper.label')}
      className={cn('flex flex-wrap items-center gap-2', className)}
    >
      {steps.map((s, i) => {
        const done = i < current;
        const active = i === current;
        const label = typeof s === 'string' ? s : s.label;
        return (
          <li
            key={label}
            aria-current={active ? 'step' : undefined}
            className="flex items-center gap-2"
          >
            <span
              className={cn(
                'inline-flex size-7 shrink-0 items-center justify-center rounded-full border text-sm font-semibold',
                done && 'border-success bg-success-bg text-success',
                active && 'border-primary bg-primary text-on-primary',
                !done && !active && 'border-line-strong bg-surface text-muted',
              )}
            >
              {done ? <Check size={14} aria-hidden="true" /> : i + 1}
            </span>
            <span className={cn('text-base', active ? 'font-semibold text-ink' : 'text-muted')}>
              {label}
              {done && <span className="sr-only"> ({t('stepper.done')})</span>}
            </span>
            {i < steps.length - 1 && (
              <span aria-hidden="true" className="mx-1 h-px w-6 bg-line-strong sm:w-10" />
            )}
          </li>
        );
      })}
    </ol>
  );
}
