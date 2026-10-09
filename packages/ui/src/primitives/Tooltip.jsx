import * as RadixTooltip from '@radix-ui/react-tooltip';
import { cn } from '../lib/cn.js';

export const TooltipProvider = RadixTooltip.Provider;

/**
 * Tooltip on hover and keyboard focus. It supplements a visible or aria label; it never holds the
 * only copy of important information.
 */
export function Tooltip({ content, side = 'top', delayDuration = 300, className, children }) {
  if (!content) return children;
  return (
    <RadixTooltip.Provider delayDuration={delayDuration}>
      <RadixTooltip.Root>
        <RadixTooltip.Trigger asChild>{children}</RadixTooltip.Trigger>
        <RadixTooltip.Portal>
          <RadixTooltip.Content
            side={side}
            sideOffset={6}
            className={cn(
              'z-50 max-w-xs animate-fade-in rounded-control bg-ink px-2.5 py-1.5 text-sm text-surface shadow-pop',
              className,
            )}
          >
            {content}
            <RadixTooltip.Arrow className="fill-ink" />
          </RadixTooltip.Content>
        </RadixTooltip.Portal>
      </RadixTooltip.Root>
    </RadixTooltip.Provider>
  );
}
