import * as RadixDialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '../lib/cn.js';

/**
 * Side sheet (Radix Dialog) for the menu on tablets. Esc, a tap outside, or the close button
 * (`closeLabel`) closes it.
 */
export function Drawer({
  open,
  onOpenChange,
  title,
  closeLabel,
  side = 'left',
  className,
  children,
}) {
  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="fixed inset-0 z-40 animate-fade-in bg-overlay" />
        <RadixDialog.Content
          aria-describedby={undefined}
          className={cn(
            'fixed top-0 bottom-0 z-50 flex w-[min(320px,calc(100vw-48px))] flex-col shadow-pop',
            side === 'left' ? 'left-0 animate-slide-in' : 'right-0',
            className,
          )}
        >
          <RadixDialog.Title className="sr-only">{title}</RadixDialog.Title>
          {children}
          {closeLabel && (
            <RadixDialog.Close
              aria-label={closeLabel}
              className="absolute top-3 right-3 inline-flex size-9 cursor-pointer items-center justify-center rounded-control text-menu-muted hover:bg-menu-hover hover:text-menu-ink"
            >
              <X size={18} aria-hidden="true" />
            </RadixDialog.Close>
          )}
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}
