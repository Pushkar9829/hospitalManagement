import { useTranslation } from 'react-i18next';
import { Check, Circle } from 'lucide-react';
import { cn } from '@hms/ui';

const CLASSES = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/];

/** Live checklist of the password policy (spec 4.4): length, 3 of 4 classes, no reuse. */
export function PasswordRules({ value = '', id, className }) {
  const { t } = useTranslation();
  const rules = [
    { ok: value.length >= 10, label: t('password.ruleLength') },
    {
      ok: CLASSES.filter((re) => re.test(value)).length >= 3,
      label: t('password.ruleClasses'),
    },
    { ok: null, label: t('password.ruleHistory') },
  ];
  return (
    <ul id={id} className={cn('flex flex-col gap-1 text-sm', className)}>
      {rules.map((r) => (
        <li
          key={r.label}
          className={cn('flex items-start gap-2', r.ok ? 'text-success' : 'text-muted')}
        >
          {r.ok ? (
            <Check size={14} aria-hidden="true" className="mt-0.5 shrink-0" />
          ) : (
            <Circle size={8} aria-hidden="true" className="mt-1.5 shrink-0 fill-current" />
          )}
          <span>
            {r.label}
            {r.ok !== null && (
              <span className="sr-only"> ({r.ok ? t('password.met') : t('password.notMet')})</span>
            )}
          </span>
        </li>
      ))}
    </ul>
  );
}
