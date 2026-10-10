import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { translateValidation } from '@hms/i18n';
import { Button, FormField, Input } from '@hms/ui';
import { applyFieldErrors } from '../../../lib/forms.js';
import { ApiErrorNotice } from '../../../components/ApiErrorNotice.jsx';
import { useChangePasswordMutation } from '../api.js';
import { changePasswordForm } from '../passwordSchemas.js';
import { NewPasswordFields } from './NewPasswordFields.jsx';

/**
 * Current password, new password (policy checklist) and confirmation. 422 details (wrong current
 * password, a password used before) appear under their fields. `onDone` runs after the 204.
 */
export function ChangePasswordForm({ onDone, submitLabel, children, formId = 'change-password' }) {
  const { t } = useTranslation();
  const [changePassword] = useChangePasswordMutation();
  const [failure, setFailure] = useState(null);
  const form = useForm({
    resolver: zodResolver(changePasswordForm),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  });
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = form;

  const onSubmit = async ({ currentPassword, newPassword }) => {
    setFailure(null);
    try {
      await changePassword({ currentPassword, newPassword }).unwrap();
      await onDone?.();
    } catch (err) {
      setFailure(applyFieldErrors(err, setError, ['currentPassword', 'newPassword']));
    }
  };

  return (
    <form id={formId} onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
      <ApiErrorNotice error={failure} title={t('password.failed')} />
      <FormField
        label={t('password.current')}
        error={translateValidation(t, errors.currentPassword?.message)}
        required
      >
        <Input
          type="password"
          autoComplete="current-password"
          autoFocus
          {...register('currentPassword')}
        />
      </FormField>
      <NewPasswordFields form={form} />
      {children}
      <Button type="submit" size="lg" loading={isSubmitting} className="w-full">
        {submitLabel ?? t('password.change')}
      </Button>
    </form>
  );
}
