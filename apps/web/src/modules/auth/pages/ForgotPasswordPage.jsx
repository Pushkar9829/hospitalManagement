import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { ArrowLeft } from 'lucide-react';
import { forgotPasswordBody } from '@hms/shared/schemas';
import { translateValidation } from '@hms/i18n';
import { Button, CodeInput, FormField, Input } from '@hms/ui';
import { apiError } from '../../../app/apiError.js';
import { applyFieldErrors } from '../../../lib/forms.js';
import { ApiErrorNotice } from '../../../components/ApiErrorNotice.jsx';
import { useForgotPasswordMutation, useResetPasswordMutation } from '../api.js';
import { AuthLayout } from '../components/AuthLayout.jsx';
import { NewPasswordFields } from '../components/NewPasswordFields.jsx';
import { newPasswordForm } from '../passwordSchemas.js';

const RESEND_AFTER_SEC = 30;

function useCountdown(initial) {
  const [left, setLeft] = useState(initial);
  useEffect(() => {
    if (left <= 0) return undefined;
    const id = setTimeout(() => setLeft((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [left]);
  return [left, () => setLeft(RESEND_AFTER_SEC)];
}

function RequestStep({ onSent }) {
  const { t } = useTranslation();
  const [forgot] = useForgotPasswordMutation();
  const [failure, setFailure] = useState(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(forgotPasswordBody), defaultValues: { username: '' } });

  const onSubmit = async ({ username }) => {
    setFailure(null);
    try {
      const res = await forgot({ username }).unwrap();
      onSent({ username, minutes: Math.max(1, Math.round((res?.expiresInSec ?? 600) / 60)) });
    } catch (err) {
      setFailure(applyFieldErrors(err, setError, ['username']));
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
      <p className="text-base text-muted">{t('forgot.body')}</p>
      <ApiErrorNotice error={failure} title={t('forgot.failed')} />
      <FormField
        label={t('forgot.username')}
        error={errors.username && translateValidation(t, 'Enter your username or mobile')}
        required
      >
        <Input
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          autoFocus
          {...register('username')}
        />
      </FormField>
      <Button type="submit" size="lg" loading={isSubmitting} className="w-full">
        {t('forgot.send')}
      </Button>
    </form>
  );
}

function ResetStep({ sent, onResend, onChangeUser }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [reset] = useResetPasswordMutation();
  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState(null);
  const [failure, setFailure] = useState(null);
  const [left, restart] = useCountdown(RESEND_AFTER_SEC);
  const form = useForm({
    resolver: zodResolver(newPasswordForm),
    defaultValues: { newPassword: '', confirmPassword: '' },
  });
  const {
    handleSubmit,
    setError,
    formState: { isSubmitting },
  } = form;

  const onSubmit = async ({ newPassword }) => {
    if (!/^\d{6}$/.test(code)) {
      setCodeError(translateValidation(t, 'Enter the 6-digit code'));
      return;
    }
    setCodeError(null);
    setFailure(null);
    try {
      await reset({ username: sent.username, code, newPassword }).unwrap();
      navigate('/login', { replace: true, state: { notice: 'reset', username: sent.username } });
    } catch (err) {
      const e = apiError(err);
      if (e?.status === 401) {
        setCodeError(t('forgot.wrongCode'));
        setCode('');
      } else setFailure(applyFieldErrors(err, setError, ['newPassword']));
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
      <p role="status" className="text-base text-muted">
        {t('forgot.sent', { username: sent.username, minutes: sent.minutes })}
      </p>
      <ApiErrorNotice error={failure} title={t('forgot.failed')} />
      <FormField label={t('forgot.code')} error={codeError} required>
        <CodeInput value={code} onChange={setCode} autoFocus label={t('forgot.code')} />
      </FormField>
      <NewPasswordFields form={form} />
      <Button type="submit" size="lg" loading={isSubmitting} className="w-full">
        {t('forgot.reset')}
      </Button>
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <button
          type="button"
          className="cursor-pointer text-info underline underline-offset-2"
          onClick={onChangeUser}
        >
          {t('forgot.otherUser')}
        </button>
        <button
          type="button"
          disabled={left > 0}
          onClick={async () => {
            await onResend();
            restart();
          }}
          className="cursor-pointer text-info underline underline-offset-2 disabled:cursor-default disabled:text-muted disabled:no-underline"
        >
          {left > 0 ? t('otp.resendIn', { seconds: left }) : t('otp.resend')}
        </button>
      </div>
    </form>
  );
}

/**
 * Forgotten password (spec 4.4): a 6-digit code by SMS to the registered mobile (the answer is
 * the same whether or not the user exists), then a new password that meets the policy. A reset
 * signs out every device.
 */
export default function ForgotPasswordPage() {
  const { t } = useTranslation();
  const [sent, setSent] = useState(null);
  const [forgot] = useForgotPasswordMutation();
  return (
    <AuthLayout>
      <section
        aria-labelledby="forgot-title"
        className="flex w-full max-w-[440px] flex-col gap-4 rounded-dialog border border-line bg-surface px-6 py-7 shadow-card sm:px-9"
      >
        <p className="font-mono text-sm text-muted">{globalThis.location?.host}</p>
        <h1 id="forgot-title" className="text-2xl font-semibold text-ink">
          {sent ? t('forgot.resetTitle') : t('forgot.title')}
        </h1>
        {sent ? (
          <ResetStep
            sent={sent}
            onChangeUser={() => setSent(null)}
            onResend={() =>
              forgot({ username: sent.username })
                .unwrap()
                .catch(() => {})
            }
          />
        ) : (
          <RequestStep onSent={setSent} />
        )}
        <Link
          to="/login"
          className="inline-flex min-h-tap items-center gap-2 self-start text-sm font-semibold text-info underline underline-offset-2"
        >
          <ArrowLeft size={16} aria-hidden="true" />
          {t('forgot.back')}
        </Link>
      </section>
    </AuthLayout>
  );
}
