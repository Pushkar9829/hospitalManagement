import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { LANGUAGES } from '@hms/i18n';
import { usePrefs } from '../../../app/prefs-context.js';

/** The marketing site frame: brand, Pricing, Start trial, the language switch, a footer. */
export function PublicLayout({ children }) {
  const { t } = useTranslation();
  const { language, setLanguage } = usePrefs();
  return (
    <div className="flex min-h-dvh flex-col bg-ground">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-control focus:bg-surface focus:px-3 focus:py-2"
      >
        {t('app.skipToContent')}
      </a>
      <header data-surface="menu" className="bg-menu text-menu-ink">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 md:px-6">
          <Link to="/pricing" className="flex items-center gap-2 text-md font-semibold">
            <span
              aria-hidden="true"
              className="inline-flex size-8 items-center justify-center rounded-control bg-accent text-base font-bold text-on-accent"
            >
              H
            </span>
            {t('app.name')}
          </Link>
          <nav aria-label={t('signup.nav.label')} className="flex flex-wrap items-center gap-2">
            <Link
              to="/pricing"
              className="min-h-9 rounded-control px-3 py-2 text-sm text-menu-ink hover:bg-menu-hover"
            >
              {t('signup.nav.pricing')}
            </Link>
            <Link
              to="/signup"
              className="min-h-9 rounded-control bg-accent px-3 py-2 text-sm font-semibold text-on-accent"
            >
              {t('signup.nav.trial')}
            </Link>
          </nav>
        </div>
      </header>
      <main
        id="main"
        tabIndex={-1}
        className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 outline-none md:px-6"
      >
        {children}
      </main>
      <footer className="border-t border-line">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-4 text-sm text-muted md:px-6">
          <span>{t('signup.footer')}</span>
          <div role="group" aria-label={t('topbar.language')} className="flex gap-1">
            {LANGUAGES.map((l) => (
              <button
                key={l.code}
                type="button"
                lang={l.code}
                aria-pressed={language === l.code}
                onClick={() => setLanguage(l.code)}
                className="min-h-9 cursor-pointer rounded-control px-3 text-sm text-muted hover:text-ink aria-pressed:font-semibold aria-pressed:text-ink"
              >
                {l.label}
              </button>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
}
