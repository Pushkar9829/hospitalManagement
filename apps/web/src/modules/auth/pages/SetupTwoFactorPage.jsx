import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { Copy, ShieldCheck } from 'lucide-react';
import { translateValidation } from '@hms/i18n';
import {
  Banner,
  Button,
  CodeInput,
  ErrorState,
  FormField,
  Loading,
  QrCode,
  useToast,
} from '@hms/ui';
import {
  authApi,
  useEnableTwoFactorMutation,
  useLogoutMutation,
  useSetupTwoFactorMutation,
} from '../api.js';
import { apiError } from '../../../app/apiError.js';
import { roleHome } from '../../../app/access.js';
import { selectSession } from '../../../app/session.js';
import { signedOut } from '../../../app/sessionActions.js';
import { baseApi } from '../../../app/baseApi.js';
import { AuthLayout } from '../components/AuthLayout.jsx';

/** Groups a base32 secret in fours so it is easier to type: ABCD EFGH … */
function groupSecret(secret = '') {
  return secret
    .replace(/\s+/g, '')
    .replace(/(.{4})/g, '$1 ')
    .trim();
}

/**
 * Two-factor enrolment, required before anything else when a role needs it (the API answers
 * every other call with 403 TWO_FACTOR_SETUP_REQUIRED). Scan the QR code or type the key, then
 * confirm with a code from the app.
 */
export default function SetupTwoFactorPage() {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { data: session } = useSelector(selectSession);
  const [setup, setupState] = useSetupTwoFactorMutation();
  const [enable, { isLoading: enabling }] = useEnableTwoFactorMutation();
  const [logout] = useLogoutMutation();
  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState(null);
  const [failure, setFailure] = useState(null);

  useEffect(() => {
    setup();
  }, [setup]);

  const secret = setupState.data?.secret;
  const otpauthUrl = setupState.data?.otpauthUrl;

  const submit = async (value = code) => {
    if (!/^\d{6}$/.test(value)) {
      setCodeError(translateValidation(t, 'Enter the 6-digit code'));
      return;
    }
    setCodeError(null);
    setFailure(null);
    try {
      await enable({ code: value }).unwrap();
      const me = await dispatch(
        authApi.endpoints.me.initiate(undefined, { forceRefetch: true, subscribe: false }),
      ).unwrap();
      toast({ title: t('setup2fa.enabled'), tone: 'success' });
      navigate(roleHome(me ?? session), { replace: true });
    } catch (err) {
      const e = apiError(err);
      if (e?.status === 422 || e?.code === 'VALIDATION_FAILED') setCodeError(t('setup2fa.invalid'));
      else setFailure(e);
      setCode('');
    }
  };

  const signOut = async () => {
    await logout()
      .unwrap()
      .catch(() => {});
    dispatch(signedOut());
    dispatch(baseApi.util.resetApiState());
    navigate('/login', { replace: true });
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(secret.replace(/\s+/g, ''));
      toast({ title: t('setup2fa.copied') });
    } catch {
      /* clipboard blocked: the key is selectable on screen */
    }
  };

  return (
    <AuthLayout>
      <section
        aria-labelledby="setup2fa-title"
        className="flex w-full max-w-[480px] flex-col gap-5 rounded-dialog border border-line bg-surface px-6 py-7 shadow-card sm:px-9"
      >
        <div>
          <p className="font-mono text-sm text-muted">{session?.user.username}</p>
          <h1
            id="setup2fa-title"
            className="mt-1 flex items-center gap-2 text-2xl font-semibold text-ink"
          >
            <ShieldCheck aria-hidden="true" size={24} className="text-accent" />
            {t('setup2fa.title')}
          </h1>
          <p className="mt-2 text-base text-muted">{t('setup2fa.description')}</p>
        </div>
        <Banner tone="info">{t('setup2fa.required')}</Banner>

        {setupState.isLoading && <Loading rows={2} />}
        {setupState.isError && (
          <ErrorState
            title={t('setup2fa.loadFailed')}
            requestId={apiError(setupState.error)?.requestId}
            onRetry={() => setup()}
          />
        )}

        {secret && (
          <>
            <ol className="flex flex-col gap-5">
              <li className="flex flex-col gap-3">
                <p className="text-base font-semibold text-ink">1. {t('setup2fa.step1')}</p>
                <div className="flex flex-col items-center gap-3 rounded-card border border-line bg-surface-2 p-4 sm:flex-row sm:items-start">
                  {otpauthUrl && (
                    <QrCode value={otpauthUrl} label={t('setup2fa.qrLabel')} size={168} />
                  )}
                  <div className="flex min-w-0 flex-col gap-2">
                    <p className="text-sm text-muted">{t('setup2fa.manual')}</p>
                    <p
                      className="font-mono text-md break-all text-ink select-all"
                      aria-label={t('setup2fa.secret')}
                    >
                      {groupSecret(secret)}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        icon={<Copy size={14} aria-hidden="true" />}
                        onClick={copy}
                      >
                        {t('setup2fa.copy')}
                      </Button>
                    </div>
                    {otpauthUrl && (
                      <a
                        href={otpauthUrl}
                        className="text-sm text-info underline underline-offset-2"
                      >
                        {t('setup2fa.openLink')}
                      </a>
                    )}
                  </div>
                </div>
              </li>
              <li>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    submit();
                  }}
                  noValidate
                  className="flex flex-col gap-4"
                >
                  <p className="text-base font-semibold text-ink">2. {t('setup2fa.step2')}</p>
                  {failure && (
                    <ErrorState
                      title={t('login.failed')}
                      message=""
                      requestId={failure.requestId}
                    />
                  )}
                  <FormField label={t('setup2fa.code')} error={codeError} required>
                    <CodeInput
                      value={code}
                      onChange={setCode}
                      onComplete={submit}
                      disabled={enabling}
                      label={t('setup2fa.code')}
                    />
                  </FormField>
                  <Button type="submit" size="lg" loading={enabling} className="w-full">
                    {t('setup2fa.enable')}
                  </Button>
                </form>
              </li>
            </ol>
          </>
        )}
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
