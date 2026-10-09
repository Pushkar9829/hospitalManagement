import { cn } from '../lib/cn.js';
import { Spinner } from './Spinner.jsx';
import { buttonSizes, buttonVariants } from './button-styles.js';

/**
 * Button. `loading` shows a spinner, keeps the label and disables the button so a double click
 * cannot submit twice. Destructive actions use `variant="danger"` and say what they do.
 */
export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled,
  type = 'button',
  icon,
  className,
  children,
  ...props
}) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        'inline-flex shrink-0 cursor-pointer items-center justify-center rounded-control border font-semibold whitespace-nowrap transition-colors select-none',
        'disabled:cursor-not-allowed disabled:opacity-55',
        buttonVariants[variant],
        buttonSizes[size],
        className,
      )}
      {...props}
    >
      {loading ? <Spinner /> : icon}
      {children}
    </button>
  );
}
