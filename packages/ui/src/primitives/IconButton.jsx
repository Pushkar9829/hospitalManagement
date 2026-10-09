import { cn } from '../lib/cn.js';
import { buttonVariants } from './button-styles.js';
import { Spinner } from './Spinner.jsx';

const sizes = { sm: 'size-8', md: 'size-tap', lg: 'size-12' };

/** Icon-only button. `label` is required: it is the accessible name. */
export function IconButton({
  label,
  icon,
  variant = 'ghost',
  size = 'md',
  loading = false,
  disabled,
  type = 'button',
  className,
  children,
  ...props
}) {
  return (
    <button
      type={type}
      aria-label={label}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        'inline-flex shrink-0 cursor-pointer items-center justify-center rounded-control border transition-colors',
        'disabled:cursor-not-allowed disabled:opacity-55',
        buttonVariants[variant],
        sizes[size],
        className,
      )}
      {...props}
    >
      {loading ? <Spinner /> : (icon ?? children)}
    </button>
  );
}
