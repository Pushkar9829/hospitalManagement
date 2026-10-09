import * as RadixTabs from '@radix-ui/react-tabs';
import { cn } from '../lib/cn.js';

/** Tabs (Radix) with the segmented look from the design system. Arrow keys move between tabs. */
export function Tabs({ className, ...props }) {
  return <RadixTabs.Root className={cn('flex flex-col gap-4', className)} {...props} />;
}

export function TabsList({ className, ...props }) {
  return (
    <RadixTabs.List
      className={cn(
        'inline-flex w-fit max-w-full items-center gap-1 overflow-x-auto rounded-control bg-neutral-bg p-1',
        className,
      )}
      {...props}
    />
  );
}

export function TabsTrigger({ className, ...props }) {
  return (
    <RadixTabs.Trigger
      className={cn(
        'inline-flex min-h-9 cursor-pointer items-center gap-2 rounded-[6px] px-3 text-base font-medium whitespace-nowrap text-muted transition-colors hover:text-ink',
        'data-[state=active]:bg-surface data-[state=active]:font-semibold data-[state=active]:text-ink data-[state=active]:shadow-card',
        'disabled:cursor-not-allowed disabled:opacity-55',
        className,
      )}
      {...props}
    />
  );
}

export function TabsContent({ className, ...props }) {
  return <RadixTabs.Content className={cn('outline-none', className)} {...props} />;
}
