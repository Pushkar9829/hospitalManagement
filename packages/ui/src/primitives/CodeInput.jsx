import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '../lib/cn.js';
import { useFieldProps } from './field-context.js';

/**
 * One-time code in separate boxes (2FA, OTP). Typing moves forward, Backspace moves back, arrow
 * keys move, and pasting or SMS autofill fills every box. `onComplete` fires when all are filled.
 */
export function CodeInput({
  length = 6,
  value = '',
  onChange,
  onComplete,
  autoFocus = false,
  disabled = false,
  invalid,
  name,
  label,
  className,
  ...props
}) {
  const { t } = useTranslation();
  const refs = useRef([]);
  const field = useFieldProps({ ...props, invalid });
  const digits = Array.from({ length }, (_, i) => value[i] ?? '');

  const commit = (next) => {
    const clean = next.replace(/\D/g, '').slice(0, length);
    onChange?.(clean);
    if (clean.length === length) onComplete?.(clean);
    return clean;
  };

  const focusAt = (i) => refs.current[Math.max(0, Math.min(length - 1, i))]?.focus();

  const handleChange = (i, e) => {
    const typed = e.target.value.replace(/\D/g, '');
    if (!typed) return;
    if (typed.length > 1) {
      // Autofill or a paste the browser routed through onChange: fill from this box on.
      const clean = commit(value.slice(0, i) + typed);
      focusAt(clean.length);
      return;
    }
    const arr = digits.slice();
    arr[i] = typed.slice(-1);
    const clean = commit(arr.join(''));
    if (clean.length > i) focusAt(i + 1);
  };

  const handleKeyDown = (i, e) => {
    if (e.key === 'Backspace') {
      e.preventDefault();
      const arr = digits.slice();
      if (arr[i]) {
        arr[i] = '';
        commit(arr.join('').slice(0, i) + arr.slice(i + 1).join(''));
      } else if (i > 0) {
        commit(value.slice(0, i - 1));
        focusAt(i - 1);
      }
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      focusAt(i - 1);
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      focusAt(i + 1);
    }
  };

  const handlePaste = (e) => {
    const text = e.clipboardData?.getData('text') ?? '';
    const pasted = text.replace(/\D/g, '');
    if (!pasted) return;
    e.preventDefault();
    const clean = commit(pasted);
    focusAt(clean.length);
  };

  return (
    <div role="group" aria-label={label} className={cn('flex gap-2', className)}>
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          id={i === 0 ? field.id : undefined}
          name={name ? `${name}-${i}` : undefined}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          autoFocus={autoFocus && i === 0}
          maxLength={i === 0 ? length : 1}
          disabled={disabled}
          value={d}
          aria-label={t('twoFactor.digit', { n: i + 1 })}
          aria-describedby={field['aria-describedby']}
          aria-invalid={field['aria-invalid']}
          onChange={(e) => handleChange(i, e)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onPaste={handlePaste}
          onFocus={(e) => e.target.select()}
          className={cn(
            'size-12 rounded-control border border-line-strong bg-surface text-center font-mono text-xl text-ink transition-colors',
            'disabled:cursor-not-allowed disabled:bg-surface-2 aria-[invalid=true]:border-critical aria-[invalid=true]:ring-1 aria-[invalid=true]:ring-critical',
          )}
        />
      ))}
    </div>
  );
}
