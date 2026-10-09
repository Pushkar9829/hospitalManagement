import * as RadixMenu from '@radix-ui/react-dropdown-menu';
import { Check } from 'lucide-react';
import { cn } from '../lib/cn.js';

/** Dropdown menu (Radix): arrow keys, typeahead, Esc, focus return. Styled with tokens. */
export const DropdownMenu = RadixMenu.Root;
export const DropdownMenuTrigger = RadixMenu.Trigger;
export const DropdownMenuGroup = RadixMenu.Group;
export const DropdownMenuRadioGroup = RadixMenu.RadioGroup;

export function DropdownMenuContent({ className, align = 'end', sideOffset = 6, ...props }) {
  return (
    <RadixMenu.Portal>
      <RadixMenu.Content
        align={align}
        sideOffset={sideOffset}
        className={cn(
          'z-50 max-h-[var(--radix-dropdown-menu-content-available-height)] min-w-56 animate-pop-in overflow-y-auto rounded-control border border-line bg-surface p-1 text-ink shadow-pop',
          className,
        )}
        {...props}
      />
    </RadixMenu.Portal>
  );
}

const itemClass =
  'relative flex min-h-9 cursor-pointer items-center gap-2 rounded-[6px] px-2.5 text-base outline-none select-none data-[disabled]:cursor-not-allowed data-[disabled]:opacity-55 data-[highlighted]:bg-neutral-bg';

export function DropdownMenuItem({ className, icon, shortcut, children, ...props }) {
  return (
    <RadixMenu.Item className={cn(itemClass, className)} {...props}>
      {icon && <span className="inline-flex w-4 shrink-0 justify-center text-muted">{icon}</span>}
      <span className="flex-1">{children}</span>
      {shortcut && <span className="ml-4 text-sm text-muted">{shortcut}</span>}
    </RadixMenu.Item>
  );
}

export function DropdownMenuRadioItem({ className, children, ...props }) {
  return (
    <RadixMenu.RadioItem className={cn(itemClass, 'pl-8', className)} {...props}>
      <RadixMenu.ItemIndicator className="absolute left-2.5 inline-flex">
        <Check size={14} aria-hidden="true" />
      </RadixMenu.ItemIndicator>
      {children}
    </RadixMenu.RadioItem>
  );
}

export function DropdownMenuLabel({ className, ...props }) {
  return (
    <RadixMenu.Label
      className={cn(
        'px-2.5 pt-2 pb-1 text-xs font-semibold tracking-wide text-muted uppercase',
        className,
      )}
      {...props}
    />
  );
}

export function DropdownMenuSeparator({ className }) {
  return <RadixMenu.Separator className={cn('my-1 h-px bg-line', className)} />;
}
