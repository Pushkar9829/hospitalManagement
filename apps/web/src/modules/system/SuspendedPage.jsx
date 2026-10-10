import { Navigate, useNavigate } from 'react-router';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { PauseCircle } from 'lucide-react';
import { Button } from '@hms/ui';
import { baseApi } from '../../app/baseApi.js';
import { isSuspended, roleHome } from '../../app/access.js';
import { selectSession } from '../../app/session.js';
import { signedOut } from '../../app/sessionActions.js';
import { useLogoutMutation } from '../auth/api.js';
import { clearAllDrafts } from '../../lib/useDraft.js';

/**
 * The hospital's subscription is suspended (spec 2.4): staff can sign in but see only this
 * notice; the Super Admin is sent to Subscription instead to pay and reactivate.
 */
export default function SuspendedPage() {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { data } = useSelector(selectSession);
  const [logout, { isLoading }] = useLogoutMutation();
  if (!isSuspended(data)) return <Navigate to={roleHome(data)} replace />;

  const signOut = async () => {
    try {
      await logout().unwrap();
    } catch {
      // Signed out locally either way.
    }
    clearAllDrafts();
    dispatch(signedOut());
    dispatch(baseApi.util.resetApiState());
    navigate('/login', { replace: true });
  };

  return (
    <main
      id="main"
      className="mx-auto flex min-h-dvh w-full max-w-lg flex-col items-center justify-center gap-3 px-4 text-center"
    >
      <PauseCircle aria-hidden="true" size={36} strokeWidth={1.5} className="text-critical" />
      <h1 className="text-xl font-semibold text-ink">
        {t('suspended.title', { hospital: data.tenant.name })}
      </h1>
      <p className="text-base text-muted">{t('suspended.body')}</p>
      <p className="text-base text-muted">{t('suspended.records')}</p>
      <Button variant="secondary" className="mt-2" loading={isLoading} onClick={signOut}>
        {t('common.signOut')}
      </Button>
    </main>
  );
}
