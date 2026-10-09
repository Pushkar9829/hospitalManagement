import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { otpRequestBody, otpVerifyBody } from '@hms/shared/schemas';
import { translateValidation } from '@hms/i18n';
import { Button, CodeInput, FormField, Input } from '@hms/ui';
import { useRequestOtpMutation, useVerifyOtpMutation } from '../api.js';
import { describeLoginError } from '../loginErrors.js';
import { FormAlert } from './FormAlert.jsx';

const RESEND_AFTER_SEC = 30;

function useCountdown(seconds) {
  const [left, setLeft] = useState(seconds);
  const [round, setRound] = useState(0);
  useEffect(() => {
    if (!round) return undefined;
    const started = Date.now();
    const id = setInterval(() => {
      const remaining = Math.max(0, seconds - Math.floor((Date.now() - started) / 1000));
      setLeft(remaining);
      if (!remaining) clearInterval(id);
    }, 1000);
    return () => clearInterval(id);
  }, [round, seconds]);
  const restart = () => {
    setLeft(seconds);
    setRound((r) => r + 1);
  };
  return [left, restart];
}

/** Mobile OTP sign-in: request a code (always 202), then enter the 6 digits. */
export function OtpForm({ onChallenge }) {
  const { t } = useTranslation();
  const [requestOtp] = useRequestOtpMutation();
  const [verifyOtp, { isLoading: verifying }] = useVerifyOtpMutation();
  const [sent, setSent] = useState(null); // { mobile, minutes }
  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState(null);
  const [formError, setFormError] = useState(null);
  const [left, restart] = useCountdown(RESEND_AFTER_SEC);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(otpRequestBody), defaultValues: { mobile: '' } });

  const send = async ({ mobile }) => {
    setFormError(null);
    try {
      const res = await requestOtp({ mobile }).unwrap();
      setSent({ mobile, minutes: Math.max(1, Math.round((res?.expiresInSec ?? 300) / 60)) });
      setCode('');
      restart();
    } catch (err) {
      const d = describeLoginError(err, t);
      const field = d?.fields?.find((f) => String(f.path).endsWith('mobile'));
      if (field) setError('mobile', { message: field.message });
      else setFormError(d);
    }
  };

  const verify = async (value = code) => {
    setFormError(null);
    const parsed = otpVerifyBody.safeParse({ mobile: sent.mobile, code: value });
    if (!parsed.success) {
      setCodeError(translateValidation(t, parsed.error.issues[0]?.message));
      return;
    }
    setCodeError(null);
    try {
      const res = await verifyOtp(parsed.data).unwrap();
      if (res?.twoFactorRequired) onChallenge(res.challengeId);
    } catch (err) {
      const d = describeLoginError(err, t, { invalidKey: 'otp.invalid' });
      if (d?.fields?.length) setCodeError(d.fields[0].message);
      else setFormError(d);
      setCode('');
    }
  };

  if (!sent) {
    return (
      <form onSubmit={handleSubmit(send)} noValidate className="flex flex-col gap-4">
        <FormAlert error={formError} />
        <FormField
          label={t('otp.mobile')}
          hint={t('otp.mobileHint')}
          error={translateValidation(t, errors.mobile?.message)}
          required
        >
          <Input
            type="tel"
            inputMode="numeric"
            autoComplete="tel-national"
            mono
            autoFocus
            {...register('mobile')}
          />
        </FormField>
        <Button type="submit" size="lg" loading={isSubmitting} className="w-full">
          {t('otp.send')}
        </Button>
      </form>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        verify();
      }}
      noValidate
      className="flex flex-col gap-4"
    >
      <p role="status" className="text-base text-muted">
        {t('otp.sent', { mobile: sent.mobile, minutes: sent.minutes })}
      </p>
      <FormAlert error={formError} />
      <FormField label={t('otp.code')} error={codeError} required>
        <CodeInput
          value={code}
          onChange={setCode}
          onComplete={verify}
          autoFocus
          disabled={verifying}
          label={t('otp.code')}
        />
      </FormField>
      <Button type="submit" size="lg" loading={verifying} className="w-full">
        {t('otp.verify')}
      </Button>
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <button
          type="button"
          className="cursor-pointer text-info underline underline-offset-2"
          onClick={() => {
            setSent(null);
            setFormError(null);
          }}
        >
          {t('otp.changeMobile')}
        </button>
        <button
          type="button"
          disabled={left > 0}
          onClick={() => send({ mobile: sent.mobile })}
          className="cursor-pointer text-info underline underline-offset-2 disabled:cursor-default disabled:text-muted disabled:no-underline"
        >
          {left > 0 ? t('otp.resendIn', { seconds: left }) : t('otp.resend')}
        </button>
      </div>
    </form>
  );
}
