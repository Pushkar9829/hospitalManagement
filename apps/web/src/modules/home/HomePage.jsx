import { useMemo } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { LayoutDashboard } from 'lucide-react';
import { PANELS } from '@hms/shared/catalog';
import { Card, EmptyState, Page, PageHeader, StatusBadge, formatLongDate, istHour } from '@hms/ui';
import { menuFor, panelKeys } from '../../app/access.js';
import { selectSession } from '../../app/session.js';

function greetingKey(hour) {
  if (hour < 12) return 'home.morning';
  if (hour < 17) return 'home.afternoon';
  return 'home.evening';
}

/** Role home: who you are, where you work, and the areas your menu opens. No invented numbers. */
export default function HomePage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { data } = useSelector(selectSession);
  const menu = useMemo(() => menuFor(data), [data]);
  const panels = panelKeys(data).map((k) => PANELS[k]);
  const now = new Date();
  const firstName = data.user.name.replace(/^(dr|mr|mrs|ms|prof)\.?\s+/i, '').split(/\s+/)[0];
  const groups = menu
    .map((g) => ({ ...g, items: g.items.filter((it) => !it.route.includes(':')) }))
    .filter((g) => g.items.length);

  return (
    <Page>
      <PageHeader
        eyebrow={formatLongDate(now, i18n.language === 'hi' ? 'hi-IN' : 'en-IN')}
        title={t(greetingKey(istHour(now)), { name: firstName })}
      />

      <Card padding={false}>
        <dl className="grid grid-cols-1 divide-y divide-line sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          <div className="px-4 py-3">
            <dt className="text-sm text-muted">{t('home.panel')}</dt>
            <dd className="mt-0.5 flex flex-wrap items-center gap-2 text-md font-semibold text-ink">
              {panels.map((p) => p.name).join(', ')}
              {panels.some((p) => p.readOnly) && (
                <StatusBadge tone="info" label={t('home.readOnly')} />
              )}
            </dd>
          </div>
          <div className="px-4 py-3">
            <dt className="text-sm text-muted">{t('home.scope')}</dt>
            <dd className="mt-0.5 text-md text-ink">{panels.map((p) => p.scope).join('; ')}</dd>
          </div>
          <div className="px-4 py-3">
            <dt className="text-sm text-muted">{t('home.branch')}</dt>
            <dd className="mt-0.5 text-md text-ink">{data.branch?.name ?? data.tenant.name}</dd>
          </div>
        </dl>
      </Card>

      <EmptyState
        icon={LayoutDashboard}
        title={t('home.dashboardTitle')}
        description={groups.length ? t('home.dashboardBody') : t('home.noMenu')}
        className="bg-surface"
      >
        {groups.length > 0 && (
          <div className="mt-4 grid w-full max-w-5xl grid-cols-1 gap-3 text-left sm:grid-cols-2 xl:grid-cols-3">
            {groups.map((g) => (
              <section key={g.group} className="rounded-card border border-line bg-surface-2 p-3">
                <h2 className="mb-2 text-xs font-semibold tracking-[0.08em] text-muted uppercase">
                  {g.group}
                </h2>
                <ul className="flex flex-wrap gap-1.5">
                  {g.items.map((it) => (
                    <li key={it.screen}>
                      <a
                        href={it.route}
                        onClick={(e) => {
                          if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return;
                          e.preventDefault();
                          navigate(it.route);
                        }}
                        className="inline-flex min-h-8 items-center rounded-control border border-line-strong bg-surface px-2.5 text-sm font-medium text-ink hover:border-muted pointer-coarse:min-h-tap"
                      >
                        {it.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </EmptyState>
    </Page>
  );
}
