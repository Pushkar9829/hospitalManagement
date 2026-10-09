import { cn } from '../lib/cn.js';

/** Placeholder block in the real layout's shape. Decorative: wrap the region in aria-busy. */
export function Skeleton({ className }) {
  return (
    <div
      aria-hidden="true"
      className={cn('animate-shimmer rounded-control bg-skeleton', className)}
    />
  );
}
