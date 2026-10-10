import { useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { Building2, Plus, Search } from 'lucide-react';
import { DEPARTMENT_STATUS, DEPARTMENT_TYPES } from '@hms/shared/schemas';
import {
  Button,
  DataTable,
  EmptyState,
  ErrorState,
  FormField,
  Input,
  Select,
  useHotkeys,
  useToast,
} from '@hms/ui';
import { apiError } from '../../../app/apiError.js';
import { selectSession } from '../../../app/session.js';
import { useCan } from '../../../lib/useCan.js';
import { useDebounced } from '../../../lib/useDebounced.js';
import { useUrlState } from '../../../lib/useUrlState.js';
import { PendingApprovalNotice } from '../../../components/PendingApprovalNotice.jsx';
import { Status } from '../../../components/Status.jsx';
import { useBranchesQuery, useDepartmentQuery, useDepartmentsQuery } from '../api.js';
import { DepartmentSheet } from './DepartmentSheet.jsx';

const LIMIT = 25;
const SERVICES = ['opd', 'ipd', 'procedures', 'diagnostics'];

/** Departments: filter by status, type, branch and name; register, edit, resubmit, close. */
export function DepartmentsTab() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const can = useCan();
  const session = useSelector(selectSession).data;
  const [status, setStatus] = useState('');
  const [type, setType] = useState('');
  const [branchId, setBranchId] = useState('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const query = useDebounced(q.trim());
  const [openId, setOpenId] = useUrlState('dept', '');
  const [notice, setNotice] = useState(null);
  const { data: branches = [] } = useBranchesQuery();
  const { data, isFetching, isLoading, isError, error, refetch } = useDepartmentsQuery({
    status,
    type,
    branchId,
    q: query,
    page,
    limit: LIMIT,
  });
  const items = data?.items ?? [];
  const existing = Boolean(openId) && openId !== 'new';
  const { data: one } = useDepartmentQuery(openId, { skip: !existing });
  const department = existing ? (one ?? items.find((d) => d.id === openId) ?? null) : null;

  const canCreate = can('settings:department:create');
  useHotkeys(
    canCreate
      ? [{ keys: 'n', handler: () => setOpenId('new'), description: t('departments.register') }]
      : [],
  );

  const branchName = useMemo(() => new Map(branches.map((b) => [b.id, b.name])), [branches]);

  const onResult = ({ kind, name, code, approvalId }) => {
    if (approvalId) {
      const key =
        kind === 'closing'
          ? 'departments.closeSent'
          : kind === 'submitted'
            ? 'departments.resubmitted'
            : 'departments.sentForApproval';
      setNotice({ approvalId, text: t(key, { name, code: code ?? '' }) });
    } else {
      const key =
        kind === 'saved'
          ? 'departments.saved'
          : kind === 'closing'
            ? 'departments.closed'
            : 'departments.created';
      toast({ title: t(key, { name }), tone: 'success' });
    }
  };

  const columns = useMemo(
    () => [
      {
        id: 'code',
        header: t('departments.code'),
        meta: { mono: true },
        cell: ({ row }) => row.original.code,
      },
      {
        id: 'name',
        header: t('departments.department'),
        cell: ({ row }) => <span className="font-semibold">{row.original.name}</span>,
      },
      {
        id: 'type',
        header: t('departments.type'),
        cell: ({ row }) => t(`departments.types.${row.original.type}`),
      },
      {
        id: 'branch',
        header: t('departments.branch'),
        cell: ({ row }) => branchName.get(row.original.location?.branchId) ?? '-',
      },
      {
        id: 'services',
        header: t('departments.services'),
        cell: ({ row }) =>
          SERVICES.filter((s) => row.original.services?.[s])
            .map((s) => t(`departments.serviceShort.${s}`))
            .join(', ') || '-',
      },
      {
        id: 'costCentre',
        header: t('departments.costCentre'),
        meta: { mono: true },
        cell: ({ row }) => row.original.costCentre ?? '-',
      },
      {
        id: 'status',
        header: t('common.status'),
        cell: ({ row }) => <Status kind="department" code={row.original.status} />,
      },
    ],
    [t, branchName],
  );

  const filtered = Boolean(status || type || branchId || query);

  return (
    <div className="flex flex-col gap-4">
      {notice && (
        <PendingApprovalNotice approvalId={notice.approvalId}>
          {notice.text} {t('approvalNotice.body', { approver: t('approvalNotice.superAdmin') })}
        </PendingApprovalNotice>
      )}
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
              placeholder={t('departments.searchPlaceholder')}
              value={q}
              onChange={(e) => (setQ(e.target.value), setPage(1))}
            />
          </div>
        </FormField>
        <FormField label={t('common.status')} className="w-full sm:w-48">
          <Select
            value={status}
            onChange={(e) => (setStatus(e.target.value), setPage(1))}
            placeholder={t('common.all')}
            options={Object.keys(DEPARTMENT_STATUS).map((k) => ({
              value: k,
              label: t(`status.${k}`),
            }))}
          />
        </FormField>
        <FormField label={t('departments.type')} className="w-full sm:w-44">
          <Select
            value={type}
            onChange={(e) => (setType(e.target.value), setPage(1))}
            placeholder={t('common.all')}
            options={Object.keys(DEPARTMENT_TYPES).map((k) => ({
              value: k,
              label: t(`departments.types.${k}`),
            }))}
          />
        </FormField>
        <FormField label={t('departments.branch')} className="w-full sm:w-44">
          <Select
            value={branchId}
            onChange={(e) => (setBranchId(e.target.value), setPage(1))}
            placeholder={t('common.all')}
            options={branches.map((b) => ({ value: b.id, label: b.name }))}
          />
        </FormField>
        {canCreate && (
          <Button
            className="sm:ml-auto"
            icon={<Plus size={16} aria-hidden="true" />}
            onClick={() => setOpenId('new')}
            aria-keyshortcuts="N"
          >
            {t('departments.register')}
          </Button>
        )}
      </div>

      {isError ? (
        <ErrorState
          title={t('departments.loadFailed')}
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
          caption={t('departments.title')}
          onRowClick={(row) => setOpenId(row.id)}
          empty={
            <EmptyState
              icon={Building2}
              bordered={false}
              title={filtered ? t('departments.noMatch') : t('departments.emptyTitle')}
              description={filtered ? t('departments.noMatchBody') : t('departments.emptyBody')}
              action={
                !filtered &&
                canCreate && (
                  <Button
                    icon={<Plus size={16} aria-hidden="true" />}
                    onClick={() => setOpenId('new')}
                  >
                    {t('departments.register')}
                  </Button>
                )
              }
            />
          }
        />
      )}

      {(openId === 'new' || department) && (
        <DepartmentSheet
          key={openId}
          department={department}
          defaultBranchId={session?.branch?.id}
          open
          onOpenChange={(o) => !o && setOpenId('')}
          onResult={onResult}
          onReload={refetch}
        />
      )}
    </div>
  );
}
