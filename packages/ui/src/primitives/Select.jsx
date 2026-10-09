import { ChevronDown } from 'lucide-react';
import { cn } from '../lib/cn.js';
import { controlClass } from './Input.jsx';
import { useFieldProps } from './field-context.js';

/**
 * Native select (best on tablets and for screen readers). Pass `options` as
 * [{ value, label, disabled? }] or children <option>s. `placeholder` adds an empty first option.
 */
export function Select({ className, invalid, options, placeholder, children, ...props }) {
  const field = useFieldProps({ ...props, invalid });
  return (
    <div className={cn('relative', className)}>
      <select
        {...props}
        {...field}
        className={cn(controlClass, 'min-h-tap cursor-pointer appearance-none pr-9')}
      >
        {placeholder != null && <option value="">{placeholder}</option>}
        {options?.map((o) => (
          <option key={o.value} value={o.value} disabled={o.disabled}>
            {o.label}
          </option>
        ))}
        {children}
      </select>
      <ChevronDown
        aria-hidden="true"
        size={16}
        className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-muted"
      />
    </div>
  );
}
