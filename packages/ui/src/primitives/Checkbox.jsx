import { useId } from 'react';
import { cn } from '../lib/cn.js';

/** Checkbox with its own label (and optional description). The whole row is clickable. */
export function Checkbox({ label, description, className, id, disabled, ...props }) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const descId = description ? `${inputId}-desc` : undefined;
  return (
    <div className={cn('flex min-h-tap items-start gap-3 py-2', className)}>
      <input
        type="checkbox"
        id={inputId}
        disabled={disabled}
        aria-describedby={descId}
        className="mt-0.5 size-[18px] shrink-0 cursor-pointer rounded-[4px] accent-primary disabled:cursor-not-allowed"
        {...props}
      />
      <div className="min-w-0">
        <label
          htmlFor={inputId}
          className={cn('cursor-pointer text-base text-ink', disabled && 'text-muted')}
        >
          {label}
        </label>
        {description && (
          <p id={descId} className="text-sm text-muted">
            {description}
          </p>
        )}
      </div>
    </div>
  );
}
