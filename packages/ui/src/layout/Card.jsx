import { cn } from '../lib/cn.js';

/** White card on the grey ground. Header has a title (h2 by default), a line under it, actions. */
export function Card({
  title,
  description,
  actions,
  footer,
  headingLevel = 2,
  padding = true,
  className,
  bodyClassName,
  children,
  ...props
}) {
  const H = `h${headingLevel}`;
  const hasHeader = title || actions;
  return (
    <section
      className={cn(
        'flex min-w-0 flex-col rounded-card border border-line bg-surface shadow-card',
        className,
      )}
      {...props}
    >
      {hasHeader && (
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-4 py-3">
          <div className="min-w-0">
            {title && <H className="text-md font-semibold text-ink">{title}</H>}
            {description && <p className="text-sm text-muted">{description}</p>}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </div>
      )}
      <div className={cn('min-w-0 flex-1', padding && 'p-4', bodyClassName)}>{children}</div>
      {footer && <div className="border-t border-line px-4 py-3">{footer}</div>}
    </section>
  );
}
