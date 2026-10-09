/** Button colour and size classes, shared by Button and IconButton. */
export const buttonVariants = {
  primary: 'border-transparent bg-primary text-on-primary hover:bg-primary-hover',
  secondary: 'border-line-strong bg-surface text-ink hover:bg-surface-2',
  danger: 'border-transparent bg-danger text-on-primary hover:bg-danger-hover',
  ghost: 'border-transparent bg-transparent text-ink hover:bg-neutral-bg',
};

export const buttonSizes = {
  sm: 'min-h-8 gap-1.5 px-3 text-sm',
  md: 'min-h-tap gap-2 px-4 text-base',
  lg: 'min-h-12 gap-2 px-5 text-md',
};
