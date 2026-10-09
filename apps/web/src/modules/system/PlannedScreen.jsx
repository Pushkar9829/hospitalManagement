import { useTranslation } from 'react-i18next';
import { Construction } from 'lucide-react';
import { SCREENS } from '@hms/shared/catalog';
import { Card, Page, PageHeader } from '@hms/ui';
import { moduleName } from '../../app/access.js';

/**
 * Placeholder for a screen whose module is not built yet. It states facts from the catalogue
 * only: no sample patients, numbers or other invented hospital data.
 */
export function PlannedScreen({ screenKey }) {
  const { t } = useTranslation();
  const screen = SCREENS[screenKey];
  // Catalogue phase 0 means "no module gate" (e.g. Reports); such screens come with Phase 1.
  const phase = screen.phase || 1;
  const rows = [
    [t('planned.module'), screen.module ? moduleName(screen.module) : t('planned.noModule')],
    [t('planned.route'), <code className="font-mono text-sm">{screen.route}</code>],
    [
      t('planned.board'),
      <code className="font-mono text-sm">docs/ui-design/boards/{screenKey}.dc.html</code>,
    ],
  ];
  return (
    <Page width="medium">
      <PageHeader eyebrow={t('planned.eyebrow')} title={screen.title} />
      <Card>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          <Construction
            aria-hidden="true"
            size={32}
            strokeWidth={1.5}
            className="shrink-0 text-muted"
          />
          <div className="flex min-w-0 flex-col gap-4">
            <p className="text-md text-ink">{t('planned.body', { phase })}</p>
            <dl className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-[max-content_1fr]">
              {rows.map(([k, v]) => (
                <div key={k} className="contents">
                  <dt className="text-sm font-semibold text-muted">{k}</dt>
                  <dd className="min-w-0 text-base break-words text-ink">{v}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </Card>
    </Page>
  );
}
