import { useState } from 'react';
import { Link } from 'react-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { Eye, EyeOff } from 'lucide-react';
import { loginBody } from '@hms/shared/schemas';
import { translateValidation } from '@hms/i18n';
import { Button, Checkbox, FormField, IconButton, Input } from '@hms/ui';
import { useLoginMutation } from '../api.js';
import { describeLoginError } from '../loginErrors.js';
import { FormAlert } from './FormAlert.jsx';

const FIELDS = new Set(['username', 'password', 'rememberDevice']);

/** Username + password. 422 details land under their fields; other errors above the form. */
export function PasswordForm({ onChallenge, initialUsername }) {
  const { t } = useTranslation();
  const [login] = useLoginMutation();
  const [formError, setFormError] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(loginBody),
    defaultValues: { username: initialUsername ?? '', password: '', rememberDevice: false },
  });

  const onSubmit = async (values) => {
    setFormError(null);
    try {
      const res = await login(values).unwrap();
      if (res?.twoFactorRequired) onChallenge(res.challengeId);
      // A session response signs the user in; the route guard then continues to `next`.
    } catch (err) {
      const d = describeLoginError(err, t);
      const unknown = [];
      for (const f of d?.fields ?? []) {
        const name = String(f.path).split('.').pop();
        if (FIELDS.has(name)) setError(name, { message: f.message });
        else unknown.push(f.message);
      }
      setFormError(unknown.length ? { ...d, message: unknown.join(' ') } : d);
    }
  };

  const msg = (e) => translateValidation(t, e?.message);

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
      <FormAlert error={formError} />
      <FormField label={t('login.username')} error={msg(errors.username)} required>
        <Input
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          autoFocus={!initialUsername}
          {...register('username')}
        />
      </FormField>
      <FormField
        label={t('login.password')}
        error={msg(errors.password)}
        required
        labelAction={
          <Link
            to="/forgot-password"
            className="text-sm text-info underline underline-offset-2 hover:text-ink"
          >
            {t('login.forgot')}
          </Link>
        }
      >
        <div className="relative">
          <Input
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            autoFocus={Boolean(initialUsername)}
            className="pr-12"
            {...register('password')}
          />
          <IconButton
            size="sm"
            label={showPassword ? t('login.hidePassword') : t('login.showPassword')}
            aria-pressed={showPassword}
            icon={showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            onClick={() => setShowPassword((s) => !s)}
            className="absolute top-1/2 right-1 -translate-y-1/2 text-muted"
          />
        </div>
      </FormField>
      <Checkbox label={t('login.remember')} {...register('rememberDevice')} />
      <Button type="submit" size="lg" loading={isSubmitting} className="w-full">
        {t('login.submit')}
      </Button>
      <p className="text-sm text-muted">{t('login.lockoutHint')}</p>
    </form>
  );
}
