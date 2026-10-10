import { useState } from 'react';
import { useLocation } from 'react-router';
import { useTranslation } from 'react-i18next';
import { Banner, Tabs, TabsContent, TabsList, TabsTrigger } from '@hms/ui';
import { AuthLayout } from '../components/AuthLayout.jsx';
import { PasswordForm } from '../components/PasswordForm.jsx';
import { OtpForm } from '../components/OtpForm.jsx';
import { TwoFactorStep } from '../components/TwoFactorStep.jsx';

/**
 * Sign in with password or mobile OTP, then a 2FA code when the role needs it. After a password
 * reset or an accepted invitation the username comes prefilled with a confirmation.
 */
export default function LoginPage() {
  const { t } = useTranslation();
  const { state } = useLocation();
  const notice = ['reset', 'welcome'].includes(state?.notice) ? state.notice : null;
  const [challengeId, setChallengeId] = useState(null);
  const [method, setMethod] = useState('password');
  const host = globalThis.location?.host ?? '';

  return (
    <AuthLayout>
      <section
        aria-labelledby="login-title"
        className="w-full max-w-[420px] rounded-dialog border border-line bg-surface px-6 py-7 shadow-card sm:px-9"
      >
        <p className="font-mono text-sm text-muted">{host}</p>
        <h1 id="login-title" className="mt-1 mb-5 text-2xl font-semibold text-ink">
          {challengeId ? t('twoFactor.title') : t('login.title')}
        </h1>
        {notice && !challengeId && (
          <Banner tone="success" role="status" className="mb-4">
            {t(notice === 'reset' ? 'forgot.done' : 'welcome.done')}
          </Banner>
        )}
        {challengeId ? (
          <TwoFactorStep challengeId={challengeId} onCancel={() => setChallengeId(null)} />
        ) : (
          <Tabs value={method} onValueChange={setMethod}>
            <TabsList aria-label={t('login.methodLabel')} className="w-full">
              <TabsTrigger value="password" className="flex-1 justify-center">
                {t('login.tabPassword')}
              </TabsTrigger>
              <TabsTrigger value="otp" className="flex-1 justify-center">
                {t('login.tabOtp')}
              </TabsTrigger>
            </TabsList>
            <TabsContent value="password">
              <PasswordForm onChallenge={setChallengeId} initialUsername={state?.username} />
            </TabsContent>
            <TabsContent value="otp">
              <OtpForm onChallenge={setChallengeId} />
            </TabsContent>
          </Tabs>
        )}
      </section>
    </AuthLayout>
  );
}
