import { z } from 'zod';
import { passwordPolicy } from '@hms/shared/schemas';

const confirm = (schema) =>
  schema.refine((v) => v.newPassword === v.confirmPassword, {
    path: ['confirmPassword'],
    message: 'The two passwords do not match',
  });

/** Change own password: current + new (shared policy) + confirmation. */
export const changePasswordForm = confirm(
  z.object({
    currentPassword: z.string().min(1, 'Enter your current password'),
    newPassword: passwordPolicy,
    confirmPassword: z.string(),
  }),
).refine((v) => v.currentPassword !== v.newPassword, {
  path: ['newPassword'],
  message: 'Choose a password you have not used just now',
});

/** A new password and its confirmation (reset by SMS code, invitation). */
export const newPasswordForm = confirm(
  z.object({ newPassword: passwordPolicy, confirmPassword: z.string() }),
);
