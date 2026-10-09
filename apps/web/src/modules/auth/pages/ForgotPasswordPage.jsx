import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { ArrowLeft } from 'lucide-react';
import { AuthLayout } from '../components/AuthLayout.jsx';

/** Phase 0: resets go through the hospital admin. Self-service reset arrives in Phase 1. */
export default function ForgotPasswordPage() {
  const { t } = useTranslation();
  return (
    <AuthLayout>
      <section className="flex w-full max-w-[420px] flex-col gap-3 rounded-dialog border border-line bg-surface px-6 py-7 shadow-card sm:px-9">
        <p className="font-mono text-sm text-muted">{globalThis.location?.host}</p>
        <h1 className="text-2xl font-semibold text-ink">{t('forgot.title')}</h1>
        <p className="text-base text-ink">{t('forgot.body')}</p>
        <p className="text-sm text-muted">{t('forgot.phase')}</p>
        <Link
          to="/login"
          className="mt-2 inline-flex min-h-tap items-center gap-2 self-start rounded-control border border-line-strong px-4 font-semibold text-ink hover:bg-surface-2"
        >
          <ArrowLeft size={16} aria-hidden="true" />
          {t('forgot.back')}
        </Link>
      </section>
    </AuthLayout>
  );
}
