import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Eye, EyeOff } from 'lucide-react';
import { translateValidation } from '@hms/i18n';
import { FormField, IconButton, Input } from '@hms/ui';
import { PasswordRules } from '../../../components/PasswordRules.jsx';

/**
 * New password + confirmation with the live policy checklist, for any react-hook-form form whose
 * schema has `newPassword` and `confirmPassword`.
 */
export function NewPasswordFields({ form, autoFocus = false, label }) {
  const { t } = useTranslation();
  const rulesId = useId();
  const [show, setShow] = useState(false);
  const {
    register,
    watch,
    formState: { errors },
  } = form;
  const msg = (e) => translateValidation(t, e?.message);
  return (
    <>
      <FormField label={label ?? t('password.new')} error={msg(errors.newPassword)} required>
        <div className="relative">
          <Input
            type={show ? 'text' : 'password'}
            autoComplete="new-password"
            className="pr-12"
            autoFocus={autoFocus}
            aria-describedby={rulesId}
            {...register('newPassword')}
          />
          <IconButton
            size="sm"
            label={show ? t('login.hidePassword') : t('login.showPassword')}
            aria-pressed={show}
            icon={show ? <EyeOff size={16} /> : <Eye size={16} />}
            onClick={() => setShow((s) => !s)}
            className="absolute top-1/2 right-1 -translate-y-1/2 text-muted"
          />
        </div>
      </FormField>
      <PasswordRules id={rulesId} value={watch('newPassword') ?? ''} className="-mt-2" />
      <FormField label={t('password.confirm')} error={msg(errors.confirmPassword)} required>
        <Input
          type={show ? 'text' : 'password'}
          autoComplete="new-password"
          {...register('confirmPassword')}
        />
      </FormField>
    </>
  );
}
