import { useTranslation } from 'react-i18next';
import { LANGUAGES } from '@hms/i18n';
import { usePrefs } from '../../../app/prefs-context.js';

/**
 * Sign-in frame (design board "Login"): navy brand panel on the left from 1024 px, the form card
 * on the grey ground on the right. The language switch is here because people choose it before
 * signing in.
 */
export function AuthLayout({ children }) {
  const { t } = useTranslation();
  const { language, setLanguage } = usePrefs();
  const facts = [
    ['16', t('login.statModules')],
    ['2FA', t('login.stat2fa')],
    ['24×7', t('login.statCloud')],
  ];
  return (
    <div className="grid min-h-dvh grid-cols-1 bg-ground lg:grid-cols-2">
      <aside
        data-surface="menu"
        className="hidden flex-col justify-between bg-menu px-14 py-14 text-menu-ink lg:flex"
      >
        <div className="flex items-center gap-3">
          <span
            aria-hidden="true"
            className="inline-flex size-10 items-center justify-center rounded-control bg-accent text-lg font-bold text-on-accent"
          >
            H
          </span>
          <span className="text-md font-semibold">{t('app.name')}</span>
        </div>
        <div className="max-w-lg">
          <p className="text-3xl leading-tight font-bold">{t('app.tagline')}</p>
          <p className="mt-4 text-md text-menu-muted">{t('app.taglineDetail')}</p>
        </div>
        <dl className="grid max-w-lg grid-cols-3 gap-6">
          {facts.map(([value, label]) => (
            <div key={label} className="flex flex-col-reverse">
              <dt className="text-sm text-menu-muted">{label}</dt>
              <dd className="text-xl font-semibold">{value}</dd>
            </div>
          ))}
        </dl>
      </aside>
      <main id="main" className="flex flex-col items-center justify-center gap-6 px-4 py-10">
        <div className="flex w-full max-w-[420px] items-center justify-between lg:hidden">
          <span className="flex items-center gap-2 text-md font-semibold text-ink">
            <span
              aria-hidden="true"
              className="inline-flex size-8 items-center justify-center rounded-control bg-accent text-base font-bold text-on-accent"
            >
              H
            </span>
            {t('app.shortName')}
          </span>
        </div>
        {children}
        <nav aria-label={t('topbar.language')} className="flex gap-1">
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
        </nav>
      </main>
    </div>
  );
}
