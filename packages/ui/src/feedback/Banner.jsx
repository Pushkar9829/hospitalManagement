import { CircleCheck, Info, OctagonAlert, TriangleAlert, WifiOff } from 'lucide-react';
import { cn } from '../lib/cn.js';
import { toneClass, toneBorder } from './tones.js';

const icons = {
  success: CircleCheck,
  warning: TriangleAlert,
  critical: OctagonAlert,
  info: Info,
  neutral: Info,
  offline: WifiOff,
};

/** Full-width message: bold lead-in (`title`), the detail, and an optional action. */
export function Banner({ tone = 'info', title, icon, action, role, className, children }) {
  const Icon = icon === false ? null : (icon ?? icons[tone] ?? Info);
  return (
    <div
      role={role}
      data-tone={tone}
      className={cn(
        'flex items-start gap-3 rounded-card border px-4 py-3 text-base',
        toneClass(tone),
        toneBorder[tone],
        className,
      )}
    >
      {Icon && <Icon aria-hidden="true" size={18} className="mt-px shrink-0" />}
      <div className="min-w-0 flex-1">
        {title && <strong className="font-semibold">{title} </strong>}
        {children}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
