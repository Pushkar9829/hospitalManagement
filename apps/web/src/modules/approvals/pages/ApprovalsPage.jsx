import { useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Inbox } from 'lucide-react';
import {
  Card,
  EmptyState,
  ErrorState,
  FormField,
  Loading,
  Page,
  PageHeader,
  Pagination,
  Select,
  SplitView,
  StatusBadge,
  Tabs,
  TabsList,
  TabsTrigger,
  cn,
  formatDateTime,
} from '@hms/ui';
import { apiError } from '../../../app/apiError.js';
import { useCan } from '../../../lib/useCan.js';
import { useUrlState } from '../../../lib/useUrlState.js';
import { useApprovalCountQuery, useApprovalsQuery } from '../api.js';
import { ApprovalDetail, ExpiryBadge } from '../components/ApprovalDetail.jsx';
import { useAdminStrings } from '../../../lib/useAdminStrings.js';

const LIMIT = 20;
const STATUSES = ['PENDING', 'APPLIED', 'APPROVED', 'REJECTED', 'WITHDRAWN', 'EXPIRED'];

function RequestList({ items, selectedId, onSelect, box }) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'hi' ? 'hi-IN' : 'en-IN';
  return (
    <ul className="flex flex-col gap-1 p-2" aria-label={t('approvals.listLabel')}>
      {items.map((r) => {
        const selected = r.id === selectedId;
        const multi = r.levels.length > 1 && r.status === 'PENDING';
        return (
          <li key={r.id}>
            <button
              type="button"
              aria-current={selected ? 'true' : undefined}
              onClick={() => onSelect(r.id)}
              className={cn(
                'flex w-full cursor-pointer flex-col gap-1 rounded-control border px-3 py-2.5 text-left transition-colors',
                selected ? 'border-info/40 bg-info-bg' : 'border-transparent hover:bg-surface-2',
              )}
            >
              <span className="flex items-start justify-between gap-2">
                <span className="min-w-0 font-semibold text-ink">{r.title}</span>
                {multi ? (
                  <StatusBadge
                    tone="warning"
                    label={t('approvals.levelShort', { n: r.levelIndex + 1 })}
                  />
                ) : box === 'inbox' ? (
                  <ExpiryBadge expiresAt={r.expiresAt} status={r.status} />
                ) : (
                  <StatusBadge
                    tone={
                      {
                        PENDING: 'warning',
                        APPLIED: 'success',
                        APPROVED: 'success',
                        REJECTED: 'critical',
                      }[r.status] ?? 'neutral'
                    }
                    label={t(`status.${r.status}`)}
                  />
                )}
              </span>
              <span className="text-sm text-muted">
                {t(`approvals.entities.${r.entity}`, { defaultValue: r.entity })} · {r.makerName}
              </span>
              <span className="text-sm text-muted">{formatDateTime(r.createdAt, locale)}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Approvals inbox (design board "Approvals", spec 4.5): requests waiting for me, requests I
 * raised and (auditors) all requests; the selected request and box are kept in the URL.
 */
export default function ApprovalsPage() {
  useAdminStrings();
  const { t } = useTranslation();
  const can = useCan();
  const canAll = can('approvals:inbox:read-all');
  const [box, setBox] = useUrlState('box', 'inbox');
  const [selectedId, setSelectedId] = useUrlState('id', '');
  const [status, setStatus] = useUrlState('status', '');
  const [pageText, setPage] = useUrlState('page', '1');
  const page = Math.max(1, Number(pageText) || 1);
  const activeBox = box === 'all' && !canAll ? 'inbox' : box;
  const { data: count } = useApprovalCountQuery();
  const { data, isLoading, isFetching, isError, error, refetch } = useApprovalsQuery({
    box: activeBox,
    status: activeBox === 'inbox' ? undefined : status,
    page,
    limit: LIMIT,
  });
  const items = useMemo(() => data?.items ?? [], [data]);
  const detailRef = useRef(null);

  // Open the first request when none is chosen (wide screens show list and detail together).
  useEffect(() => {
    if (!selectedId && items.length && window.matchMedia?.('(min-width: 1024px)').matches)
      setSelectedId(items[0].id);
  }, [selectedId, items, setSelectedId]);

  const select = (id) => {
    setSelectedId(id, { replace: false });
    if (!window.matchMedia?.('(min-width: 1024px)').matches)
      requestAnimationFrame(() => detailRef.current?.scrollIntoView({ block: 'start' }));
  };

  const onDecided = (id) => {
    if (activeBox !== 'inbox') return;
    const i = items.findIndex((x) => x.id === id);
    const next = items[i + 1] ?? items[i - 1];
    setSelectedId(next?.id ?? '');
  };

  const tabs = [
    { id: 'inbox', label: t('approvals.tabs.inbox'), badge: count?.inbox },
    { id: 'mine', label: t('approvals.tabs.mine') },
    ...(canAll ? [{ id: 'all', label: t('approvals.tabs.all') }] : []),
  ];

  const emptyKey = activeBox === 'inbox' ? 'inbox' : activeBox === 'mine' ? 'mine' : 'all';

  return (
    <Page>
      <PageHeader title={t('approvals.title')} description={t('approvals.description')} />
      <div className="flex flex-wrap items-end justify-between gap-3">
        <Tabs
          value={activeBox}
          onValueChange={(v) => setBox(v, { reset: ['id', 'page', 'status'] })}
        >
          <TabsList aria-label={t('approvals.tabsLabel')}>
            {tabs.map((x) => (
              <TabsTrigger key={x.id} value={x.id}>
                {x.label}
                {x.badge > 0 && (
                  <span className="rounded-chip bg-accent px-1.5 text-xs leading-5 font-semibold text-on-accent">
                    {x.badge}
                  </span>
                )}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        {activeBox !== 'inbox' && (
          <FormField label={t('common.status')} className="w-48">
            <Select
              value={status}
              onChange={(e) => setStatus(e.target.value, { reset: ['page', 'id'] })}
              placeholder={t('common.all')}
              options={STATUSES.map((s) => ({ value: s, label: t(`status.${s}`) }))}
            />
          </FormField>
        )}
      </div>
      {isError ? (
        <ErrorState
          title={t('approvals.loadFailed')}
          requestId={apiError(error)?.requestId}
          onRetry={refetch}
        />
      ) : (
        <SplitView
          list={
            <Card padding={false} aria-busy={isFetching || undefined}>
              {isLoading ? (
                <Loading rows={4} className="p-4" />
              ) : items.length ? (
                <>
                  <RequestList
                    items={items}
                    selectedId={selectedId}
                    onSelect={select}
                    box={activeBox}
                  />
                  {data.total > LIMIT && (
                    <Pagination
                      className="border-t border-line px-3 py-2"
                      page={page}
                      limit={LIMIT}
                      total={data.total}
                      onPageChange={(p) => setPage(String(p), { reset: ['id'] })}
                    />
                  )}
                </>
              ) : (
                <EmptyState
                  icon={Inbox}
                  bordered={false}
                  title={t(`approvals.empty.${emptyKey}`)}
                  description={t(`approvals.emptyBody.${emptyKey}`)}
                />
              )}
            </Card>
          }
          detail={
            (items.length > 0 || selectedId) && (
              <div ref={detailRef} className="scroll-mt-20">
                <ApprovalDetail
                  key={selectedId}
                  id={selectedId}
                  box={activeBox}
                  onDecided={onDecided}
                />
              </div>
            )
          }
        />
      )}
    </Page>
  );
}
