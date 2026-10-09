import { cn } from '../lib/cn.js';

/** Page body: padding and max width. Put a PageHeader first, then cards. */
export function Page({ className, children, width = 'full' }) {
  return (
    <div
      className={cn(
        'mx-auto flex w-full flex-col gap-5 px-4 py-5 md:px-6 md:py-6',
        width === 'narrow' && 'max-w-3xl',
        width === 'medium' && 'max-w-5xl',
        width === 'full' && 'max-w-[1600px]',
        className,
      )}
    >
      {children}
    </div>
  );
}
