import { LoaderCircle } from 'lucide-react';
import { cn } from '../lib/cn.js';

/** Decorative spinner; the busy state is announced by the control that owns it. */
export function Spinner({ className, size = 16 }) {
  return (
    <LoaderCircle
      aria-hidden="true"
      size={size}
      className={cn('shrink-0 animate-spin', className)}
    />
  );
}
