import { useId, useMemo } from 'react';
import { CircleAlert } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '../lib/cn.js';
import { FieldContext } from './field-context.js';

/**
 * Label + control + hint + error. The control inside (Input, Select, Textarea, CodeInput) gets
 * the id, `aria-describedby` (hint and error) and `aria-invalid` from here. Errors sit under the
 * field with an icon, never only in a toast.
 */
export function FormField({
  label,
  hint,
  error,
  required = false,
  optional = false,
  id,
  labelAction,
  className,
  children,
}) {
  const { t } = useTranslation();
  const autoId = useId();
  const fieldId = id ?? `f${autoId.replace(/:/g, '')}`;
  const hintId = hint ? `${fieldId}-hint` : null;
  const errorId = error ? `${fieldId}-error` : null;
  const value = useMemo(
    () => ({
      id: fieldId,
      describedBy: [errorId, hintId].filter(Boolean).join(' ') || undefined,
      invalid: Boolean(error),
      required: required || undefined,
    }),
    [fieldId, errorId, hintId, error, required],
  );
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={fieldId} className="text-sm font-semibold text-ink">
          {label}
          {required && (
            <span className="text-critical" aria-hidden="true">
              {' '}
              *
            </span>
          )}
          {optional && <span className="font-normal text-muted"> ({t('common.optional')})</span>}
        </label>
        {labelAction}
      </div>
      <FieldContext.Provider value={value}>{children}</FieldContext.Provider>
      {error && (
        <p id={errorId} className="flex items-start gap-1.5 text-sm text-critical">
          <CircleAlert aria-hidden="true" size={16} className="mt-px shrink-0" />
          <span>{error}</span>
        </p>
      )}
      {hint && (
        <p id={hintId} className="text-sm text-muted">
          {hint}
        </p>
      )}
    </div>
  );
}
