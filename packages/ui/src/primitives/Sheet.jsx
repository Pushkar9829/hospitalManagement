import * as RadixDialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '../lib/cn.js';

const widths = {
  md: 'w-[min(480px,100vw)]',
  lg: 'w-[min(600px,100vw)]',
  xl: 'w-[min(800px,100vw)]',
};

/**
 * Side panel for create and edit forms (department, branch, master record). It slides in from
 * the right over the list, so the list stays in view on wide screens; on a tablet it takes the
 * full width. Focus is trapped, Esc closes it and focus returns to the button that opened it.
 * `footer` holds the actions, primary action last.
 */
export function Sheet({
  open,
  onOpenChange,
  title,
  description,
  footer,
  size = 'md',
  className,
  bodyClassName,
  children,
}) {
  const { t } = useTranslation();
  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="fixed inset-0 z-40 animate-fade-in bg-overlay" />
        <RadixDialog.Content
          {...(description ? {} : { 'aria-describedby': undefined })}
          className={cn(
            'fixed top-0 right-0 bottom-0 z-50 flex animate-slide-in-right flex-col border-l border-line bg-surface text-ink shadow-pop',
            widths[size] ?? widths.md,
            className,
          )}
        >
          <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
            <div className="min-w-0">
              <RadixDialog.Title className="text-lg font-semibold text-ink">
                {title}
              </RadixDialog.Title>
              {description && (
                <RadixDialog.Description className="mt-0.5 text-sm text-muted">
                  {description}
                </RadixDialog.Description>
              )}
            </div>
            <RadixDialog.Close
              aria-label={t('common.close')}
              className="-mt-1 -mr-2 inline-flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-control text-muted hover:bg-neutral-bg hover:text-ink"
            >
              <X size={18} aria-hidden="true" />
            </RadixDialog.Close>
          </div>
          <div className={cn('min-h-0 flex-1 overflow-y-auto px-5 py-4', bodyClassName)}>
            {children}
          </div>
          {footer && (
            <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line px-5 py-3">
              {footer}
            </div>
          )}
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}
