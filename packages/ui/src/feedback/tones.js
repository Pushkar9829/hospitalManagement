/** Tone -> token classes. Tailwind needs the literal class names, so they live here. */
export const toneClasses = {
  success: 'bg-success-bg text-success',
  warning: 'bg-warning-bg text-warning',
  critical: 'bg-critical-bg text-critical',
  info: 'bg-info-bg text-info',
  neutral: 'bg-neutral-bg text-neutral',
  accent: 'bg-accent-bg text-accent',
};

export const toneBorder = {
  success: 'border-success/30',
  warning: 'border-warning/30',
  critical: 'border-critical/30',
  info: 'border-info/30',
  neutral: 'border-line',
  accent: 'border-accent/30',
};

export function toneClass(tone) {
  return toneClasses[tone] ?? toneClasses.neutral;
}
