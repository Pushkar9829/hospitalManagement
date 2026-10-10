import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import { ScrollText, X } from 'lucide-react';
import {
  Button,
  Card,
  DataTable,
  DiffTable,
  EmptyState,
  ErrorState,
  FormField,
  IconButton,
  Input,
  Page,
  PageHeader,
  Select,
  StatusBadge,
  formatDateTime,
  formatTime,
} from '@hms/ui';
import { apiError } from '../../../app/apiError.js';
import { istDayEnd, istDayStart } from '../../../lib/dates.js';
import { useCan } from '../../../lib/useCan.js';
import { useAuditLogQuery, useAuditUsersQuery } from '../api.js';
import { useAdminStrings } from '../../../lib/useAdminStrings.js';

const LIMIT = 25;
const OBJECT_ID = /^[a-f\d]{24}$/i;

/** Audit actions (API enum) and their badge tones; red only for security events. */
const AUDIT_ACTION_TONES = {
  CREATE: 'success',
  UPDATE: 'info',
  DELETE: 'warning',
  APPROVE: 'success',
  REJECT: 'critical',
  PRINT: 'neutral',
  EXPORT: 'warning',
  LOGIN: 'neutral',
  LOGIN_FAILED: 'critical',
  LOGOUT: 'neutral',
  ACCOUNT_LOCKED: 'critical',
  PASSWORD_CHANGED: 'info',
  TWO_FACTOR_ENABLED: 'info',
  SESSION_REUSE_DETECTED: 'critical',
  ACCESS_DENIED: 'warning',
};

/** Records the API audits today, offered as suggestions in the record filter. */
const ENTITIES = [
  'ApprovalRequest',
  'Branch',
  'Department',
  'HospitalSettings',
  'LegalEntity',
  'MasterImport',
  'NumberSeries',
  'PriceList',
  'Role',
  'Service',
  'Session',
  'StoredFile',
  'TaxCode',
  'User',
];

const FILTERS = ['entity', 'entityId', 'userId', 'action', 'from', 'to'];

function ActionBadge({ action }) {
  const { t } = useTranslation();
  return (
    <StatusBadge
      tone={AUDIT_ACTION_TONES[action] ?? 'neutral'}
      label={t(`audit.actions.${action}`, { defaultValue: action })}
    />
  );
}

function EntryDetail({ entry, onClose }) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'hi' ? 'hi-IN' : 'en-IN';
  const hasDiff = entry.before || entry.after;
  return (
    <Card
      title={t('audit.detail')}
      actions={
        <IconButton
          size="sm"
          label={t('common.close')}
          icon={<X size={16} aria-hidden="true" />}
          onClick={onClose}
        />
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <p className="font-mono text-sm text-muted">
            {entry.id} · {formatDateTime(entry.at, locale)}
          </p>
          <p className="text-base text-ink">
            <span className="font-semibold">{entry.userName ?? t('audit.system')}</span>{' '}
            {entry.summary ?? `${entry.action} ${entry.entity}`}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <ActionBadge action={entry.action} />
            <span className="text-sm text-muted">
              {entry.entity}
              {entry.entityId && <code className="ml-1 font-mono">{entry.entityId}</code>}
            </span>
          </div>
        </div>
        {hasDiff ? (
          <DiffTable before={entry.before} after={entry.after} caption={t('audit.changes')} />
        ) : (
          <p className="text-sm text-muted">{t('audit.noChanges')}</p>
        )}
        <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1 text-sm">
          <dt className="text-muted">{t('audit.ip')}</dt>
          <dd className="font-mono text-ink">{entry.ip ?? '-'}</dd>
          <dt className="text-muted">{t('audit.requestId')}</dt>
          <dd className="font-mono break-all text-ink">{entry.requestId ?? '-'}</dd>
          {entry.userId && (
            <>
              <dt className="text-muted">{t('audit.userId')}</dt>
              <dd className="font-mono break-all text-ink">{entry.userId}</dd>
            </>
          )}
        </dl>
      </div>
    </Card>
  );
}

/** The filter form; it starts from the URL and is remounted when the URL changes. */
function AuditFilters({ applied, onApply, users, anyFilter }) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState(applied);
  const [userError, setUserError] = useState(null);
  const set = (k) => (e) => setDraft((d) => ({ ...d, [k]: e.target.value }));
  const submit = (e) => {
    e.preventDefault();
    if (draft.userId && !OBJECT_ID.test(draft.userId.trim())) {
      setUserError(t('audit.userIdError'));
      return;
    }
    setUserError(null);
    onApply(draft);
  };
  return (
    <form
      onSubmit={submit}
      noValidate
      className="flex flex-wrap items-end gap-3"
      aria-label={t('audit.filters')}
    >
      <FormField label={t('audit.entity')} className="w-full sm:w-44">
        <Input
          list="audit-entities"
          value={draft.entity}
          onChange={set('entity')}
          placeholder={t('common.all')}
        />
      </FormField>
      <datalist id="audit-entities">
        {ENTITIES.map((e) => (
          <option key={e} value={e} />
        ))}
      </datalist>
      <FormField label={t('audit.entityId')} className="w-full sm:w-56">
        <Input mono value={draft.entityId} onChange={set('entityId')} />
      </FormField>
      <FormField label={t('audit.user')} error={userError} className="w-full sm:w-52">
        {users ? (
          <Select
            value={draft.userId}
            onChange={set('userId')}
            placeholder={t('audit.anyUser')}
            options={users.map((u) => ({ value: u.id, label: u.name }))}
          />
        ) : (
          <Input
            mono
            value={draft.userId}
            onChange={set('userId')}
            placeholder={t('audit.userIdPlaceholder')}
          />
        )}
      </FormField>
      <FormField label={t('audit.action')} className="w-full sm:w-48">
        <Select
          value={draft.action}
          onChange={set('action')}
          placeholder={t('common.all')}
          options={Object.keys(AUDIT_ACTION_TONES).map((a) => ({
            value: a,
            label: t(`audit.actions.${a}`, { defaultValue: a }),
          }))}
        />
      </FormField>
      <FormField label={t('audit.from')} className="w-full sm:w-40">
        <Input type="date" value={draft.from} onChange={set('from')} max={draft.to || undefined} />
      </FormField>
      <FormField label={t('audit.to')} className="w-full sm:w-40">
        <Input type="date" value={draft.to} onChange={set('to')} min={draft.from || undefined} />
      </FormField>
      <div className="flex gap-2">
        <Button type="submit">{t('common.search')}</Button>
        {anyFilter && (
          <Button variant="ghost" onClick={() => onApply({})}>
            {t('audit.clear')}
          </Button>
        )}
      </div>
    </form>
  );
}

/**
 * Audit log (design board "AuditLog"): filter by record, record id, user, action and date range
 * (IST days); the page and filters are kept in the URL. Selecting an entry shows its before and
 * after values. Append-only: nothing here edits or deletes.
 */
export default function AuditLogPage() {
  useAdminStrings();
  const { t, i18n } = useTranslation();
  const can = useCan();
  const [params, setParams] = useSearchParams();
  const applied = Object.fromEntries(FILTERS.map((k) => [k, params.get(k) ?? '']));
  const page = Math.max(1, Number(params.get('page')) || 1);
  const [entryId, setEntryId] = useState(null);
  const locale = i18n.language === 'hi' ? 'hi-IN' : 'en-IN';
  const paramsKey = params.toString();

  const { data: users, isError: noUsers } = useAuditUsersQuery(undefined, {
    skip: !can('settings:user:read'),
  });
  const userPicker = can('settings:user:read') && !noUsers;

  const { data, isLoading, isFetching, isError, error, refetch } = useAuditLogQuery({
    entity: applied.entity,
    entityId: applied.entityId,
    userId: applied.userId,
    action: applied.action,
    from: istDayStart(applied.from),
    to: istDayEnd(applied.to),
    page,
    limit: LIMIT,
  });
  const items = useMemo(() => data?.items ?? [], [data]);
  const entry = items.find((x) => x.id === entryId) ?? null;

  const apply = (next, nextPage = 1) => {
    const p = new URLSearchParams();
    for (const k of FILTERS) if (next[k]?.trim()) p.set(k, next[k].trim());
    if (nextPage > 1) p.set('page', String(nextPage));
    setParams(p);
    setEntryId(null);
  };

  const filterByUser = (userId) => apply({ ...applied, userId });

  const columns = useMemo(
    () => [
      {
        id: 'at',
        header: t('audit.time'),
        meta: { mono: true, className: 'whitespace-nowrap' },
        cell: ({ row }) => (
          <time dateTime={row.original.at} title={formatDateTime(row.original.at, locale)}>
            <span className="block">{formatTime(row.original.at, locale)}</span>
            <span className="block text-xs text-muted">
              {new Intl.DateTimeFormat(locale, {
                day: 'numeric',
                month: 'short',
                timeZone: 'Asia/Kolkata',
              }).format(new Date(row.original.at))}
            </span>
          </time>
        ),
      },
      {
        id: 'user',
        header: t('audit.user'),
        cell: ({ row }) =>
          row.original.userId ? (
            <button
              type="button"
              className="cursor-pointer text-left text-ink underline-offset-2 hover:underline"
              onClick={(e) => {
                e.stopPropagation();
                filterByUser(row.original.userId);
              }}
              aria-label={t('audit.filterUser', {
                name: row.original.userName ?? row.original.userId,
              })}
            >
              {row.original.userName ?? row.original.userId}
            </button>
          ) : (
            <span className="text-muted">{t('audit.system')}</span>
          ),
      },
      {
        id: 'action',
        header: t('audit.action'),
        cell: ({ row }) => <ActionBadge action={row.original.action} />,
      },
      {
        id: 'record',
        header: t('audit.record'),
        cell: ({ row }) => (
          <span className="flex flex-col">
            <span>{row.original.summary ?? row.original.entity}</span>
            <span className="text-sm text-muted">
              {row.original.entity}
              {row.original.entityId && (
                <code className="ml-1 font-mono text-xs">{row.original.entityId}</code>
              )}
            </span>
          </span>
        ),
      },
      {
        id: 'ip',
        header: t('audit.ip'),
        meta: { mono: true },
        cell: ({ row }) => row.original.ip ?? '-',
      },
    ],
    // filterByUser closes over `applied`, which changes with the URL.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t, locale, paramsKey],
  );

  const anyFilter = FILTERS.some((k) => applied[k]);

  return (
    <Page>
      <PageHeader title={t('audit.title')} description={t('audit.description')} />
      <AuditFilters
        key={paramsKey}
        applied={applied}
        onApply={apply}
        users={userPicker ? (users?.items ?? []) : null}
        anyFilter={anyFilter}
      />
      <p className="text-sm text-muted">{t('audit.appendOnly')}</p>
      {isError ? (
        <ErrorState
          title={t('audit.loadFailed')}
          requestId={apiError(error)?.requestId}
          onRetry={refetch}
        />
      ) : (
        <div className={entry ? 'grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_420px]' : ''}>
          <DataTable
            columns={columns}
            data={items}
            total={data?.total}
            page={page}
            limit={LIMIT}
            onPageChange={(p) => apply(applied, p)}
            loading={isLoading || (isFetching && !items.length)}
            caption={t('audit.title')}
            density="compact"
            onRowClick={(row) => setEntryId(row.id)}
            empty={
              <EmptyState
                icon={ScrollText}
                bordered={false}
                title={anyFilter ? t('audit.noMatch') : t('audit.emptyTitle')}
              />
            }
          />
          {entry && (
            <div className="min-w-0">
              <EntryDetail entry={entry} onClose={() => setEntryId(null)} />
            </div>
          )}
        </div>
      )}
    </Page>
  );
}
