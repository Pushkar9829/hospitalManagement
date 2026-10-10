import { Checkbox, cn } from '@hms/ui';

/**
 * A group of checkboxes whose value is an array (roles, branches, languages). Unlike several
 * inputs registered under one name, it stays an array when there is only one option.
 * Use it with react-hook-form's Controller: value / onChange.
 */
export function CheckboxList({
  legend,
  hint,
  error,
  required = false,
  options,
  value = [],
  onChange,
  onBlur,
  disabled,
  columns = 2,
  className,
}) {
  const toggle = (v, on) =>
    onChange(on ? [...value.filter((x) => x !== v), v] : value.filter((x) => x !== v));
  return (
    <fieldset className={cn('min-w-0', className)} aria-invalid={error ? true : undefined}>
      <legend className="text-sm font-semibold text-ink">
        {legend}
        {required && (
          <span className="text-critical" aria-hidden="true">
            {' '}
            *
          </span>
        )}
      </legend>
      {hint && <p className="text-sm text-muted">{hint}</p>}
      <div
        className={cn(
          'grid grid-cols-1 gap-x-4',
          columns === 2 && 'sm:grid-cols-2',
          columns === 3 && 'grid-cols-2 sm:grid-cols-3',
        )}
      >
        {options.map((o) => (
          <Checkbox
            key={o.value}
            label={o.label}
            description={o.description}
            checked={value.includes(o.value)}
            disabled={disabled || o.disabled}
            onChange={(e) => toggle(o.value, e.target.checked)}
            onBlur={onBlur}
          />
        ))}
      </div>
      {error && (
        <p role="alert" className="text-sm text-critical">
          {error}
        </p>
      )}
    </fieldset>
  );
}
