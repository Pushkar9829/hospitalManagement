import { clsx } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

/** tailwind-merge that knows our custom type scale, so `text-sm` and `text-ink` don't clash. */
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      text: ['xs', 'sm', 'base', 'md', 'lg', 'xl', '2xl', '3xl'],
      radius: ['control', 'card', 'dialog', 'chip'],
      shadow: ['card', 'pop'],
    },
  },
});

/** Joins class names (clsx) and resolves Tailwind conflicts (later wins). */
export function cn(...inputs) {
  return twMerge(clsx(inputs));
}
