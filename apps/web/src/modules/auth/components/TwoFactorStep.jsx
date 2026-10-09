import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { twoFactorVerifyBody } from '@hms/shared/schemas';
import { translateValidation } from '@hms/i18n';
import { Button, CodeInput, FormField } from '@hms/ui';
import { useVerifyTwoFactorMutation } from '../api.js';
import { describeLoginError } from '../loginErrors.js';
import { FormAlert } from './FormAlert.jsx';

/** Second step for privileged roles: the 6-digit authenticator code. Submits on the 6th digit. */
export function TwoFactorStep({ challengeId, onCancel }) {
  const { t } = useTranslation();
  const [verify, { isLoading }] = useVerifyTwoFactorMutation();
  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState(null);
  const [formError, setFormError] = useState(null);

  const submit = async (value = code) => {
    setFormError(null);
    const parsed = twoFactorVerifyBody.safeParse({ challengeId, code: value });
    if (!parsed.success) {
      const issue = parsed.error.issues.find((i) => i.path[0] === 'code') ?? parsed.error.issues[0];
      setCodeError(translateValidation(t, issue?.message));
      return;
    }
    setCodeError(null);
    try {
      await verify(parsed.data).unwrap();
    } catch (err) {
      const d = describeLoginError(err, t, { invalidKey: 'twoFactor.invalid' });
      if (d?.fields?.length) setCodeError(d.fields[0].message);
      else setFormError(d);
      setCode('');
    }
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      noValidate
      className="flex flex-col gap-4"
    >
      <p className="text-base text-muted">{t('twoFactor.description')}</p>
      <FormAlert error={formError} />
      <FormField label={t('twoFactor.code')} error={codeError} required>
        <CodeInput
          value={code}
          onChange={setCode}
          onComplete={submit}
          autoFocus
          disabled={isLoading}
          label={t('twoFactor.code')}
        />
      </FormField>
      <Button type="submit" size="lg" loading={isLoading} className="w-full">
        {t('twoFactor.verify')}
      </Button>
      <button
        type="button"
        onClick={onCancel}
        className="cursor-pointer self-start text-sm text-info underline underline-offset-2"
      >
        {t('twoFactor.useAnother')}
      </button>
    </form>
  );
}
