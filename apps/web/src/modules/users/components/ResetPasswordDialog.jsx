import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { passwordPolicy } from '@hms/shared/schemas';
import { translateValidation } from '@hms/i18n';
import { Button, Dialog, FormField, Input, useToast } from '@hms/ui';
import { apiError } from '../../../app/apiError.js';
import { ApiErrorNotice } from '../../../components/ApiErrorNotice.jsx';
import { PasswordRules } from '../../../components/PasswordRules.jsx';
import { useUserActionMutation } from '../api.js';
import { generatePassword } from '../password.js';

/**
 * Admin reset: a temporary password that follows the policy. The user is signed out everywhere
 * and must choose their own password at the next sign-in.
 */
export function ResetPasswordDialog({ user, onOpenChange }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [run, { isLoading }] = useUserActionMutation();
  const [password, setPassword] = useState(() => generatePassword());
  const [error, setError] = useState(null);
  const [failure, setFailure] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    const parsed = passwordPolicy.safeParse(password);
    if (!parsed.success) {
      setError(translateValidation(t, parsed.error.issues[0]?.message));
      return;
    }
    setError(null);
    setFailure(null);
    try {
      await run({
        id: user.id,
        action: 'reset-password',
        body: { temporaryPassword: password },
      }).unwrap();
      toast({ title: t('users.resetDone', { name: user.name }), tone: 'success' });
      onOpenChange(false);
    } catch (err) {
      const ae = apiError(err);
      const field = ae?.details?.find((d) => String(d.path).includes('temporaryPassword'));
      if (field) setError(field.message);
      else setFailure(ae);
    }
  };

  return (
    <Dialog
      open
      onOpenChange={onOpenChange}
      title={t('users.resetTitle', { name: user.name })}
      description={t('users.resetBody')}
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" form="reset-password-form" loading={isLoading}>
            {t('users.resetConfirm')}
          </Button>
        </>
      }
    >
      <form id="reset-password-form" onSubmit={submit} noValidate className="flex flex-col gap-3">
        <ApiErrorNotice error={failure} />
        <FormField
          label={t('users.tempPassword')}
          error={error}
          required
          labelAction={
            <button
              type="button"
              className="cursor-pointer text-sm text-info underline underline-offset-2"
              onClick={() => setPassword(generatePassword())}
            >
              {t('users.generate')}
            </button>
          }
        >
          <Input
            mono
            autoComplete="off"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </FormField>
        <PasswordRules value={password} />
        <p className="text-sm text-muted">{t('users.tempHint')}</p>
      </form>
    </Dialog>
  );
}
