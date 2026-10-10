import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { Check } from 'lucide-react';
import { MODULES } from '@hms/shared';
import { addSignupStrings } from '@hms/i18n/signup';
import { ErrorState, Loading, StatusBadge, cn } from '@hms/ui';
import { apiError } from '../../../app/apiError.js';
import { inr } from '../../../lib/money.js';
import { useStrings } from '../../../lib/useStrings.js';
import { PublicLayout } from '../components/PublicLayout.jsx';
import { usePlansQuery } from '../api.js';

/** Monthly / annual switch (annual: the months charged per year, e.g. 10 for 12). */
function CycleSwitch({ annual, onChange, months }) {
  const { t } = useTranslation();
  return (
    <div
      role="group"
      aria-label={t('signup.pricing.cycle')}
      className="inline-flex gap-1 rounded-control bg-neutral-bg p-1"
    >
      {[false, true].map((a) => (
        <button
          key={String(a)}
          type="button"
          aria-pressed={annual === a}
          onClick={() => onChange(a)}
          className="min-h-9 cursor-pointer rounded-[6px] px-3 text-base text-muted aria-pressed:bg-surface aria-pressed:font-semibold aria-pressed:text-ink aria-pressed:shadow-card"
        >
          {a ? t('signup.pricing.annual', { free: 12 - months }) : t('signup.pricing.monthly')}
        </button>
      ))}
    </div>
  );
}

/**
 * Pricing (design board "Signup", spec 2.2): plans from GET /api/public/plans with monthly or
 * annual prices before GST, what each includes, and modules one by one with their dependencies.
 */
export default function PricingPage() {
  useStrings(addSignupStrings);
  const { t } = useTranslation();
  const [annual, setAnnual] = useState(false);
  const { data, isLoading, isError, error, refetch } = usePlansQuery();
  useEffect(() => {
    document.title = `${t('signup.pricing.title')} · ${t('app.shortName')}`;
  }, [t]);

  let body;
  if (isLoading) body = <Loading rows={4} />;
  else if (isError)
    body = (
      <ErrorState
        title={t('signup.pricing.failed')}
        requestId={apiError(error)?.requestId}
        onRetry={refetch}
      />
    );
  else {
    const months = annual ? data.annualMonthsCharged : 1;
    body = (
      <div className="flex flex-col gap-10">
        <section aria-labelledby="plans-title" className="flex flex-col gap-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 id="plans-title" className="text-xl font-semibold text-ink">
                {t('signup.pricing.plans')}
              </h2>
              <p className="text-base text-muted">
                {t('signup.pricing.gstNote', {
                  rate: data.gstRate,
                  free: 12 - data.annualMonthsCharged,
                })}
              </p>
            </div>
            <CycleSwitch annual={annual} onChange={setAnnual} months={data.annualMonthsCharged} />
          </div>
          <ul className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {Object.entries(data.plans).map(([code, p]) => {
              const popular = code === 'HOSPITAL';
              const unlimited = p.limits.users >= 100000;
              return (
                <li
                  key={code}
                  className={cn(
                    'flex flex-col gap-4 rounded-card border bg-surface p-5 shadow-card',
                    popular ? 'border-primary ring-1 ring-primary' : 'border-line',
                  )}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-lg font-semibold text-ink">{p.name}</h3>
                    {popular && (
                      <StatusBadge tone="info" icon={false} label={t('signup.pricing.popular')} />
                    )}
                  </div>
                  <p className="text-base text-muted">{t(`signup.pricing.who.${code}`)}</p>
                  <p className="text-ink">
                    {p.monthly == null ? (
                      <span className="text-2xl font-semibold">{t('signup.pricing.custom')}</span>
                    ) : (
                      <>
                        <span className="tabular text-3xl font-bold">
                          {inr(p.monthly * months)}
                        </span>{' '}
                        <span className="text-base text-muted">
                          {annual ? t('signup.pricing.perYear') : t('signup.pricing.perMonth')}
                        </span>
                      </>
                    )}
                  </p>
                  <ul className="flex flex-1 flex-col gap-1.5 text-base text-ink">
                    {[
                      p.modules.length >= Object.keys(MODULES).length
                        ? t('signup.pricing.allModules', { count: p.modules.length })
                        : p.modules.map((m) => MODULES[m]?.name ?? m).join(', '),
                      unlimited
                        ? t('signup.pricing.unlimited')
                        : t('signup.pricing.limits', {
                            users: p.limits.users,
                            branches: p.limits.branches,
                            beds: p.limits.beds,
                          }),
                      t('signup.pricing.storage', { gb: p.limits.storageGb }),
                    ].map((f) => (
                      <li key={f} className="flex items-start gap-2">
                        <Check
                          size={16}
                          aria-hidden="true"
                          className="mt-1 shrink-0 text-success"
                        />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                  <Link
                    to={`/signup?plan=${code}`}
                    className={cn(
                      'inline-flex min-h-tap items-center justify-center rounded-control border px-4 font-semibold',
                      popular
                        ? 'border-transparent bg-primary text-on-primary hover:bg-primary-hover'
                        : 'border-line-strong bg-surface text-ink hover:bg-surface-2',
                    )}
                  >
                    {p.monthly == null
                      ? t('signup.pricing.talk')
                      : t('signup.pricing.start', { days: data.trialDays })}
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
        <section aria-labelledby="modules-title" className="flex flex-col gap-3">
          <h2 id="modules-title" className="text-xl font-semibold text-ink">
            {t('signup.pricing.alaCarte')}
          </h2>
          <p className="text-base text-muted">{t('signup.pricing.alaCarteHint')}</p>
          <ul className="grid grid-cols-1 gap-x-6 gap-y-2 rounded-card border border-line bg-surface p-4 sm:grid-cols-2 lg:grid-cols-3">
            {Object.entries(data.modules).map(([code, m]) => {
              const deps = (MODULES[code]?.dependsOn ?? []).filter((d) => d !== 'CORE');
              return (
                <li key={code} className="flex flex-col border-b border-line py-2 last:border-b-0">
                  <span className="font-medium text-ink">{MODULES[code]?.name ?? code}</span>
                  <span className="text-sm text-muted">
                    {t(`signup.pricing.unit.${m.unit}`, { amount: inr(m.monthly * months) })}
                    {annual ? ` ${t('signup.pricing.yearly')}` : ''}
                    {code === 'CORE' ? ` · ${t('signup.pricing.always')}` : ''}
                    {deps.length > 0 &&
                      ` · ${t('signup.pricing.needs', { modules: deps.map((d) => MODULES[d]?.name ?? d).join(', ') })}`}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      </div>
    );
  }

  return (
    <PublicLayout>
      <div className="flex flex-col gap-8">
        <header className="flex flex-col gap-3">
          <p className="text-sm font-semibold text-info">{t('signup.pricing.eyebrow')}</p>
          <h1 className="text-3xl leading-tight font-bold text-ink">{t('signup.pricing.title')}</h1>
          <p className="max-w-3xl text-md text-muted">{t('signup.pricing.lead')}</p>
          <div>
            <Link
              to="/signup"
              className="inline-flex min-h-tap items-center rounded-control bg-primary px-5 font-semibold text-on-primary hover:bg-primary-hover"
            >
              {t('signup.pricing.cta', { days: data?.trialDays ?? 14 })}
            </Link>
          </div>
        </header>
        {body}
      </div>
    </PublicLayout>
  );
}
