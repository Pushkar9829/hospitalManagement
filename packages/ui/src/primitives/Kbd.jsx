import { Fragment } from 'react';
import { cn } from '../lib/cn.js';
import { keyLabel } from './keys.js';

/**
 * Keyboard key(s). `<Kbd>Esc</Kbd>` for one key, `<Kbd keys="mod+k" />` for a combination.
 */
export function Kbd({ keys, className, children }) {
  const cls = cn(
    'inline-flex h-6 min-w-6 items-center justify-center rounded-[4px] border border-b-2 border-line bg-surface-2 px-1.5 font-mono text-xs font-medium text-muted',
    className,
  );
  if (!keys) return <kbd className={cls}>{children}</kbd>;
  const parts = String(keys).split('+');
  return (
    <span className="inline-flex items-center gap-1">
      {parts.map((p, i) => (
        <Fragment key={`${p}-${i}`}>
          <kbd className={cls}>{keyLabel(p)}</kbd>
        </Fragment>
      ))}
    </span>
  );
}
