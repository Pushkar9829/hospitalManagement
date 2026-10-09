import { cn } from '../lib/cn.js';
import { useFieldProps } from './field-context.js';

export const controlClass =
  'w-full rounded-control border border-line-strong bg-surface px-3 text-base text-ink transition-colors placeholder:text-muted hover:border-muted disabled:cursor-not-allowed disabled:bg-surface-2 disabled:text-muted read-only:bg-surface-2 aria-[invalid=true]:border-critical aria-[invalid=true]:ring-1 aria-[invalid=true]:ring-critical';

/** Text input. Inside a FormField it is labelled and wired to the hint and error automatically. */
export function Input({ className, invalid, mono = false, ...props }) {
  const field = useFieldProps({ ...props, invalid });
  return (
    <input
      {...props}
      {...field}
      className={cn(controlClass, 'min-h-tap', mono && 'font-mono', className)}
    />
  );
}
