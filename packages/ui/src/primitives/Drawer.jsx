import * as RadixDialog from '@radix-ui/react-dialog';
import { cn } from '../lib/cn.js';

/** Side sheet (Radix Dialog). Used for the menu on tablets and for detail panels. */
export function Drawer({ open, onOpenChange, title, side = 'left', className, children }) {
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
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}
