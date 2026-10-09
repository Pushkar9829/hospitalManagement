import { OctagonAlert, TriangleAlert } from 'lucide-react';
import { statusMeta } from '@hms/shared';
import { cn } from '../lib/cn.js';
import { toneClass } from './tones.js';

const icons = { critical: OctagonAlert, warning: TriangleAlert };

/**
 * Status chip: always colour plus text, and an icon for critical and warning so colour is never
 * the only signal. Use a shared catalogue (`catalogue={BED_STATUS} code="OCCUPIED"`) or give
 * `tone` and `label` directly.
 */
export function StatusBadge({ catalogue, code, tone, label, icon = true, className }) {
  const meta = catalogue ? statusMeta(catalogue, code) : { tone: tone ?? 'neutral', label };
  const finalTone = tone ?? meta.tone;
  const Icon = icon ? icons[finalTone] : null;
  return (
    <span
      data-tone={finalTone}
      className={cn(
        'inline-flex max-w-full items-center gap-1 rounded-chip px-2 py-0.5 text-sm leading-[18px] font-semibold whitespace-nowrap',
        toneClass(finalTone),
        className,
      )}
    >
      {Icon && <Icon aria-hidden="true" size={13} strokeWidth={2.5} className="shrink-0" />}
      <span className="truncate">{label ?? meta.label}</span>
    </span>
  );
}
