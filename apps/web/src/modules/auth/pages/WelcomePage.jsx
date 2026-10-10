import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { PartyPopper } from 'lucide-react';
import { Banner, Button, ErrorState, Loading } from '@hms/ui';
import { apiError } from '../../../app/apiError.js';
import { applyFieldErrors } from '../../../lib/forms.js';
import { ApiErrorNotice } from '../../../components/ApiErrorNotice.jsx';
import { useAcceptInviteMutation, useInviteInfoQuery } from '../api.js';
import { AuthLayout } from '../components/AuthLayout.jsx';
import { NewPasswordFields } from '../components/NewPasswordFields.jsx';
import { newPasswordForm } from '../passwordSchemas.js';

/**
 * First sign-in from an invitation (`/welcome?token=`): shows who the invitation is for, then the
 * new user chooses a password and continues to sign in with the username prefilled.
 */
export default function WelcomePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const valid = token.length >= 20;
  const { data, isLoading, isError, error, refetch } = useInviteInfoQuery(token, { skip: !valid });
  const [accept] = useAcceptInviteMutation();
  const [failure, setFailure] = useState(null);
  const form = useForm({
    resolver: zodResolver(newPasswordForm),
    defaultValues: { newPassword: '', confirmPassword: '' },
  });
  const {
    handleSubmit,
    setError,
    formState: { isSubmitting },
  } = form;

  const onSubmit = async ({ newPassword }) => {
    setFailure(null);
    try {
      const res = await accept({ token, newPassword }).unwrap();
      navigate('/login', {
        replace: true,
        state: { notice: 'welcome', username: res?.username ?? data?.username },
      });
    } catch (err) {
      setFailure(applyFieldErrors(err, setError, ['newPassword']));
    }
  };

  const e = apiError(error);
  const expired =
    !valid || e?.status === 410 || e?.status === 404 || e?.code === 'VALIDATION_FAILED';

  let body;
  if (isLoading) body = <Loading rows={2} />;
  else if (expired)
    body = (
      <Banner tone="warning" role="alert" title={t('welcome.expiredTitle')}>
        {e?.message ?? t('welcome.expiredBody')}
      </Banner>
    );
  else if (isError)
    body = (
      <ErrorState title={t('welcome.loadFailed')} requestId={e?.requestId} onRetry={refetch} />
    );
  else
    body = (
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
        <p className="text-base text-ink">
          {t('welcome.body', { name: data.name, hospital: data.hospital })}
        </p>
        <dl className="rounded-control border border-line bg-surface-2 px-3 py-2">
          <dt className="text-sm text-muted">{t('welcome.username')}</dt>
          <dd className="font-mono text-md text-ink">{data.username}</dd>
        </dl>
        <ApiErrorNotice error={failure} title={t('welcome.failed')} />
        <NewPasswordFields form={form} autoFocus />
        <Button type="submit" size="lg" loading={isSubmitting} className="w-full">
          {t('welcome.submit')}
        </Button>
      </form>
    );

  return (
    <AuthLayout>
      <section
        aria-labelledby="welcome-title"
        className="flex w-full max-w-[440px] flex-col gap-4 rounded-dialog border border-line bg-surface px-6 py-7 shadow-card sm:px-9"
      >
        <p className="font-mono text-sm text-muted">{globalThis.location?.host}</p>
        <h1 id="welcome-title" className="flex items-center gap-2 text-2xl font-semibold text-ink">
          <PartyPopper aria-hidden="true" size={24} className="text-accent" />
          {data?.hospital ? t('welcome.titleFor', { hospital: data.hospital }) : t('welcome.title')}
        </h1>
        {body}
      </section>
    </AuthLayout>
  );
}
