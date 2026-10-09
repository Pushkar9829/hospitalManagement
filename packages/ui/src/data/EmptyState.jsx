import { FileText } from 'lucide-react';
import { cn } from '../lib/cn.js';

/**
 * Says what will appear here and offers the next action. Never an empty table with only headers.
 */
export function EmptyState({
  icon: Icon = FileText,
  title,
  description,
  action,
  children,
  bordered = true,
  className,
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-2 px-6 py-10 text-center',
        bordered && 'rounded-card border border-dashed border-line-strong',
        className,
      )}
    >
      {Icon && <Icon aria-hidden="true" size={32} strokeWidth={1.5} className="mb-1 text-muted" />}
      {title && <h2 className="text-md font-semibold text-ink">{title}</h2>}
      {description && <p className="max-w-prose text-base text-muted">{description}</p>}
      {children}
      {action && <div className="mt-3 flex flex-wrap justify-center gap-2">{action}</div>}
    </div>
  );
}
