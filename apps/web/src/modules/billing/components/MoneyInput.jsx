import { Input, cn } from '@hms/ui';

/** A rupee amount field (₹ prefix, decimal keypad). The value is the text typed; convert with paiseFrom. */
export function MoneyInput({ className, ...props }) {
  return (
    <div className={cn('relative', className)}>
      <span
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted"
      >
        ₹
      </span>
      <Input
        type="text"
        inputMode="decimal"
        autoComplete="off"
        className="tabular pl-7"
        {...props}
      />
    </div>
  );
}
