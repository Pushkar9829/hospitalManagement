import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Database, FileUp, Plus, Search } from 'lucide-react';
import { MASTERS } from '@hms/shared/schemas';
import {
  Button,
  ConfirmDialog,
  DataTable,
  EmptyState,
  ErrorState,
  FormField,
  Input,
  Select,
  StatusBadge,
  formatLongDate,
  useToast,
} from '@hms/ui';
import { apiError } from '../../../app/apiError.js';
import { useCan } from '../../../lib/useCan.js';
import { useDebounced } from '../../../lib/useDebounced.js';
import { ApiErrorNotice } from '../../../components/ApiErrorNotice.jsx';
import { PendingApprovalNotice } from '../../../components/PendingApprovalNotice.jsx';
import { Status } from '../../../components/Status.jsx';
import { useBranchesQuery, useMastersQuery, useSetMasterActiveMutation } from '../api.js';
import { masterFields, useMasterLabels } from '../masters.js';
import { ratesText, useServiceRefs } from '../services.js';
import { MasterSheet } from './MasterSheet.jsx';
import { ServiceSheet } from './ServiceSheet.jsx';
import { ImportWizard } from './ImportWizard.jsx';

/** Stable while the query is skipped, so memos and effects do not rerun every render. */
const NO_BRANCHES = [];

const LIMIT = 25;

/** Service columns: category, current rates and rates waiting for approval, status. */
function useServiceColumns(labels, skip) {
  const { t } = useTranslation();
  const refs = useServiceRefs({ skip });
  return useMemo(
    () => [
      {
        id: 'category',
        header: labels.field('category'),
        cell: ({ row }) => labels.option(row.original.category),
      },
      {
        id: 'rates',
        header: t('masters.services.rates'),
        cell: ({ row }) => (
          <div className="flex flex-col gap-0.5">
            <span className="tabular">{ratesText(row.original.rates, refs.listCode) || '-'}</span>
            {row.original.pendingRates?.length > 0 && (
              <span className="text-sm text-warning">
                {t('masters.services.pendingShort', {
                  rates: ratesText(row.original.pendingRates, refs.listCode),
                })}
              </span>
            )}
          </div>
        ),
      },
      {
        id: 'status',
        header: t('common.status'),
        cell: ({ row }) => <Status kind="service" code={row.original.status} />,
      },
    ],
    [t, labels, refs],
  );
}

/**
 * One master (price lists, tax codes, payment modes, …): search, active filter, add/edit with a
 * form generated from its schema (services hand-tuned), activate/deactivate and Excel import.
 */
export function MasterTab({ type }) {
  const { t, i18n } = useTranslation();
  const { toast } = useToast();
  const can = useCan();
  const labels = useMasterLabels(type);
  const isServices = type === 'services';
  const typeLabel = t(`masters.types.${type}`, { defaultValue: MASTERS[type].label });
  const [q, setQ] = useState('');
  const [active, setActive] = useState('');
  const [page, setPage] = useState(1);
  const query = useDebounced(q.trim());
  const [editing, setEditing] = useState(null);
  const [toggling, setToggling] = useState(null);
  const [importing, setImporting] = useState(false);
  const [notice, setNotice] = useState(null);
  const [failure, setFailure] = useState(null);
  const [setActiveFlag] = useSetMasterActiveMutation();
  const { data, isLoading, isFetching, isError, error, refetch } = useMastersQuery({
    type,
    q: query,
    active,
    page,
    limit: LIMIT,
  });
  const { data: branches = NO_BRANCHES } = useBranchesQuery(undefined, {
    skip: type !== 'holidays',
  });
  const items = data?.items ?? [];
  const record = editing?.id ? items.find((r) => r.id === editing.id) : null;

  const fields = useMemo(() => masterFields(type), [type]);
  const serviceColumns = useServiceColumns(labels, !isServices);
  const locale = i18n.language === 'hi' ? 'hi-IN' : 'en-IN';

  const columns = useMemo(() => {
    const generic = fields
      .filter((f) => !['code', 'name'].includes(f.name))
      .map((f) => ({
        id: f.name,
        header: labels.field(f.name),
        meta: f.kind === 'number' ? { align: 'right' } : undefined,
        cell: ({ row }) => {
          const r = row.original;
          if (f.kind === 'list') {
            const names = (r.branchIds ?? []).map(
              (id) => branches.find((b) => b.id === id)?.code ?? '?',
            );
            return names.length ? names.join(', ') : t('masters.allBranches');
          }
          const v = r[f.name];
          if (v === undefined || v === null || v === '') return '-';
          if (f.kind === 'boolean') return t(v ? 'common.yes' : 'common.no');
          if (f.kind === 'enum') return labels.option(v);
          if (f.kind === 'date') return formatLongDate(v, locale);
          return String(v);
        },
      }));
    return [
      {
        id: 'code',
        header: labels.field('code'),
        meta: { mono: true },
        cell: ({ row }) => row.original.code,
      },
      {
        id: 'name',
        header: labels.field('name'),
        cell: ({ row }) => (
          <span className="font-semibold">
            {row.original.name}
            {row.original.isDefault && (
              <StatusBadge tone="info" label={t('masters.default')} className="ml-2" />
            )}
          </span>
        ),
      },
      ...(isServices ? serviceColumns : generic),
      ...(isServices
        ? []
        : [
            {
              id: 'active',
              header: t('common.status'),
              cell: ({ row }) => (
                <Status kind="active" code={row.original.isActive ? 'ACTIVE' : 'INACTIVE'} />
              ),
            },
          ]),
      ...(can('settings:master:update')
        ? [
            {
              id: 'actions',
              header: <span className="sr-only">{t('common.actions')}</span>,
              meta: { align: 'right' },
              cell: ({ row }) => {
                const r = row.original;
                const canDeactivate = isServices ? r.status === 'ACTIVE' : r.isActive;
                const canActivate = isServices ? r.status === 'INACTIVE' : !r.isActive;
                if (!canDeactivate && !canActivate) return null;
                return (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={(e) => (
                      e.stopPropagation(),
                      setToggling({ record: r, active: canActivate })
                    )}
                  >
                    {canActivate ? t('masters.activate') : t('masters.deactivate')}
                    <span className="sr-only"> {r.name}</span>
                  </Button>
                );
              },
            },
          ]
        : []),
    ];
  }, [fields, labels, t, isServices, serviceColumns, can, branches, locale, setToggling]);

  const onDone = ({ name, approvalId, created }) => {
    if (approvalId)
      setNotice({
        approvalId,
        text: t(created ? 'masters.services.sentNew' : 'masters.services.sentRates', { name }),
      });
    else
      toast({ title: t(created ? 'masters.added' : 'masters.saved', { name }), tone: 'success' });
  };

  const confirmToggle = async () => {
    const { record: r, active: next } = toggling;
    setFailure(null);
    try {
      await setActiveFlag({ type, id: r.id, version: r.version, active: next }).unwrap();
      toast({
        title: t(next ? 'masters.activated' : 'masters.deactivated', { name: r.name }),
        tone: 'success',
      });
    } catch (err) {
      setFailure(apiError(err));
    }
  };

  const Sheet = isServices ? ServiceSheet : MasterSheet;
  const filtered = Boolean(query || active);

  return (
    <div className="flex flex-col gap-4">
      {notice && (
        <PendingApprovalNotice approvalId={notice.approvalId}>
          {notice.text} {t('approvalNotice.body', { approver: t('approvalNotice.superAdmin') })}
        </PendingApprovalNotice>
      )}
      <ApiErrorNotice error={failure} onReload={() => (setFailure(null), refetch())} />
      <div className="flex flex-wrap items-end gap-3">
        <FormField label={t('common.search')} className="w-full sm:w-64">
          <div className="relative">
            <Search
              size={16}
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted"
            />
            <Input
              type="search"
              className="pl-9"
              placeholder={t('masters.searchPlaceholder')}
              value={q}
              onChange={(e) => (setQ(e.target.value), setPage(1))}
            />
          </div>
        </FormField>
        <FormField label={t('common.status')} className="w-full sm:w-44">
          <Select
            value={active}
            onChange={(e) => (setActive(e.target.value), setPage(1))}
            options={[
              { value: '', label: t('common.all') },
              { value: 'true', label: t('status.ACTIVE') },
              { value: 'false', label: t('status.INACTIVE') },
            ]}
          />
        </FormField>
        <div className="flex flex-wrap gap-2 sm:ml-auto">
          {can('settings:master:import') && (
            <Button
              variant="secondary"
              icon={<FileUp size={16} aria-hidden="true" />}
              onClick={() => setImporting(true)}
            >
              {t('import.open')}
            </Button>
          )}
          {can('settings:master:create') && (
            <Button
              icon={<Plus size={16} aria-hidden="true" />}
              onClick={() => setEditing({ id: null })}
            >
              {t('masters.addType', { type: typeLabel })}
            </Button>
          )}
        </div>
      </div>
      {isError ? (
        <ErrorState
          title={t('masters.loadFailed')}
          requestId={apiError(error)?.requestId}
          onRetry={refetch}
        />
      ) : (
        <DataTable
          columns={columns}
          data={items}
          total={data?.total}
          page={page}
          limit={LIMIT}
          onPageChange={setPage}
          loading={isLoading || (isFetching && !items.length)}
          caption={typeLabel}
          onRowClick={(r) => setEditing({ id: r.id })}
          empty={
            <EmptyState
              icon={Database}
              bordered={false}
              title={filtered ? t('masters.noMatch') : t('masters.emptyTitle', { type: typeLabel })}
              description={filtered ? undefined : t('masters.emptyBody')}
            />
          }
        />
      )}
      {editing && (
        <Sheet
          key={editing.id ?? 'new'}
          type={type}
          record={record}
          open
          onOpenChange={(o) => !o && setEditing(null)}
          onDone={onDone}
          onReload={refetch}
        />
      )}
      {importing && <ImportWizard type={type} open onOpenChange={setImporting} />}
      <ConfirmDialog
        open={Boolean(toggling)}
        onOpenChange={(o) => !o && setToggling(null)}
        title={
          toggling?.active
            ? t('masters.activateTitle', { name: toggling?.record.name ?? '' })
            : t('masters.deactivateTitle', { name: toggling?.record.name ?? '' })
        }
        description={toggling?.active ? undefined : t('masters.deactivateBody')}
        confirmLabel={toggling?.active ? t('masters.activate') : t('masters.deactivate')}
        destructive={!toggling?.active}
        requireReason={null}
        onConfirm={confirmToggle}
      />
    </div>
  );
}
