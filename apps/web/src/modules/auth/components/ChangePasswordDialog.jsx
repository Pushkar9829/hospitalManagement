import { useTranslation } from 'react-i18next';
import { Dialog, useToast } from '@hms/ui';
import { ChangePasswordForm } from './ChangePasswordForm.jsx';

/** Change password from the account menu. Other devices are signed out; this one stays. */
export function ChangePasswordDialog({ open, onOpenChange }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={t('password.changeTitle')}
      description={t('password.changeHint')}
    >
      {open && (
        <ChangePasswordForm
          formId="change-password-dialog"
          onDone={() => {
            toast({ title: t('password.changedOthers'), tone: 'success' });
            onOpenChange(false);
          }}
        />
      )}
    </Dialog>
  );
}
