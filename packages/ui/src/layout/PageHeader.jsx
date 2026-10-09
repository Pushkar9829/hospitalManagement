import { ChevronRight } from 'lucide-react';
import { cn } from '../lib/cn.js';

/**
 * Breadcrumb, the page's h1, an optional line under it, and actions (primary action last).
 * Breadcrumb items: [{ label, href?, onClick? }]; the last one is the current page.
 */
export function PageHeader({ title, description, eyebrow, breadcrumb, actions, className }) {
  return (
    <header className={cn('flex flex-wrap items-end justify-between gap-x-6 gap-y-3', className)}>
      <div className="min-w-0">
        {breadcrumb?.length > 0 && (
          <nav aria-label="Breadcrumb" className="mb-1">
            <ol className="flex flex-wrap items-center gap-1 text-sm text-muted">
              {breadcrumb.map((b, i) => {
                const last = i === breadcrumb.length - 1;
                return (
                  <li key={`${b.label}-${i}`} className="flex items-center gap-1">
                    {b.href && !last ? (
                      <a
                        href={b.href}
                        onClick={b.onClick}
                        className="underline-offset-2 hover:text-ink hover:underline"
                      >
                        {b.label}
                      </a>
                    ) : (
                      <span aria-current={last ? 'page' : undefined}>{b.label}</span>
                    )}
                    {!last && <ChevronRight aria-hidden="true" size={12} />}
                  </li>
                );
              })}
            </ol>
          </nav>
        )}
        {eyebrow && <p className="mb-1 text-sm text-muted">{eyebrow}</p>}
        <h1 className="text-xl font-semibold text-ink md:text-2xl">{title}</h1>
        {description && <p className="mt-1 text-base text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}
