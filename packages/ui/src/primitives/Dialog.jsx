import * as RadixDialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '../lib/cn.js';

const sizes = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' };

/**
 * Modal dialog (Radix): focus is trapped, Esc and the close button close it, focus returns to the
 * trigger. `footer` holds the actions, primary action last.
 */
export function Dialog({
  open,
  defaultOpen,
  onOpenChange,
  trigger,
  title,
  description,
  footer,
  size = 'md',
  hideClose = false,
  role,
  className,
  bodyClassName,
  onOpenAutoFocus,
  children,
}) {
  const { t } = useTranslation();
  return (
    <RadixDialog.Root open={open} defaultOpen={defaultOpen} onOpenChange={onOpenChange}>
      {trigger && <RadixDialog.Trigger asChild>{trigger}</RadixDialog.Trigger>}
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="fixed inset-0 z-40 animate-fade-in bg-overlay" />
        <RadixDialog.Content
          {...(role ? { role } : {})}
          {...(onOpenAutoFocus ? { onOpenAutoFocus } : {})}
          {...(description ? {} : { 'aria-describedby': undefined })}
          className={cn(
            'fixed top-1/2 left-1/2 z-50 flex max-h-[calc(100dvh-32px)] w-[calc(100vw-32px)] -translate-x-1/2 -translate-y-1/2 animate-pop-in flex-col rounded-dialog border border-line bg-surface text-ink shadow-pop',
            sizes[size],
            className,
          )}
        >
          <div className="flex items-start justify-between gap-4 px-6 pt-5">
            <div className="min-w-0">
              <RadixDialog.Title className="text-lg font-semibold text-ink">
                {title}
              </RadixDialog.Title>
              {description && (
                <RadixDialog.Description className="mt-1 text-base text-muted">
                  {description}
                </RadixDialog.Description>
              )}
            </div>
            {!hideClose && (
              <RadixDialog.Close
                aria-label={t('common.close')}
                className="-mt-1 -mr-2 inline-flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-control text-muted hover:bg-neutral-bg hover:text-ink"
              >
                <X size={18} aria-hidden="true" />
              </RadixDialog.Close>
            )}
          </div>
          <div className={cn('min-h-0 overflow-y-auto px-6 pt-4 pb-5', bodyClassName)}>
            {children}
          </div>
          {footer && (
            <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line px-6 py-4">
              {footer}
            </div>
          )}
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}

export const DialogClose = RadixDialog.Close;
