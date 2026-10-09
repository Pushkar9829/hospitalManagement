import { cn } from '../lib/cn.js';

/**
 * List on the left, detail on the right (OPD check-in, approvals inbox). Stacks below 1024 px.
 * `ratio`: 'narrow' (list 1/3), 'even'.
 */
export function SplitView({ list, detail, ratio = 'narrow', className }) {
  return (
    <div
      className={cn(
        'grid min-w-0 grid-cols-1 gap-5',
        ratio === 'even' ? 'lg:grid-cols-2' : 'lg:grid-cols-[minmax(280px,1fr)_2fr]',
        className,
      )}
    >
      <div className="min-w-0">{list}</div>
      <div className="min-w-0">{detail}</div>
    </div>
  );
}
