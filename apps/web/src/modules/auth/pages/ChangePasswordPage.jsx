import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { KeyRound } from 'lucide-react';
import { Banner, useToast } from '@hms/ui';
import { authApi, useLogoutMutation } from '../api.js';
import { roleHome } from '../../../app/access.js';
import { selectSession } from '../../../app/session.js';
import { signedOut } from '../../../app/sessionActions.js';
import { baseApi } from '../../../app/baseApi.js';
import { AuthLayout } from '../components/AuthLayout.jsx';
import { ChangePasswordForm } from '../components/ChangePasswordForm.jsx';

/**
 * Forced password change: after an admin reset the user signs in with a temporary password and
 * the API refuses every other call (403 PASSWORD_CHANGE_REQUIRED) until they choose their own.
 */
export default function ChangePasswordPage() {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { data: session } = useSelector(selectSession);
  const [logout] = useLogoutMutation();

  const done = async () => {
    const me = await dispatch(
      authApi.endpoints.me.initiate(undefined, { forceRefetch: true, subscribe: false }),
    ).unwrap();
    toast({ title: t('password.changed'), tone: 'success' });
    navigate(roleHome(me ?? session), { replace: true });
  };

  const signOut = async () => {
    await logout()
      .unwrap()
      .catch(() => {});
    dispatch(signedOut());
    dispatch(baseApi.util.resetApiState());
    navigate('/login', { replace: true });
  };

  return (
    <AuthLayout>
      <section
        aria-labelledby="change-password-title"
        className="flex w-full max-w-[440px] flex-col gap-5 rounded-dialog border border-line bg-surface px-6 py-7 shadow-card sm:px-9"
      >
        <div>
          <p className="font-mono text-sm text-muted">{session?.user.username}</p>
          <h1
            id="change-password-title"
            className="mt-1 flex items-center gap-2 text-2xl font-semibold text-ink"
          >
            <KeyRound aria-hidden="true" size={24} className="text-accent" />
            {t('password.forcedTitle')}
          </h1>
        </div>
        <Banner tone="info">{t('password.forcedBody')}</Banner>
        <ChangePasswordForm onDone={done} submitLabel={t('password.saveAndContinue')} />
        <button
          type="button"
          onClick={signOut}
          className="cursor-pointer self-start text-sm text-info underline underline-offset-2"
        >
          {t('common.signOut')}
        </button>
      </section>
    </AuthLayout>
  );
}
