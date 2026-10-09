import { cn } from '../lib/cn.js';
import { controlClass } from './Input.jsx';
import { useFieldProps } from './field-context.js';

export function Textarea({ className, invalid, rows = 3, ...props }) {
  const field = useFieldProps({ ...props, invalid });
  return (
    <textarea
      rows={rows}
      {...props}
      {...field}
      className={cn(controlClass, 'min-h-20 resize-y py-2', className)}
    />
  );
}
