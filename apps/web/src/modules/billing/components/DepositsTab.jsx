import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Wallet } from 'lucide-react';
import {
  Button,
  DataTable,
  EmptyState,
  ErrorState,
  FormField,
  PatientCell,
  Select,
  StatusBadge,
  formatDateTime,
} from '@hms/ui';
import { apiError } from '../../../app/apiError.js';
import { useCan } from '../../../lib/useCan.js';
import { inrExact } from '../../../lib/money.js';
import { useUrlState } from '../../../lib/useUrlState.js';
import { useDepositsQuery } from '../api.js';
import { DepositDialog } from './DepositDialog.jsx';

const LIMIT = 25;

/**
 * Deposits and advances (rule R13): receipt, patient, mode, amount, used on bills, balance.
 * A deposit is applied on a bill by paying with the mode "Advance".
 */
export function DepositsTab() {
  const { t, i18n } = useTranslation();
  const can = useCan();
  const locale = i18n.language === 'hi' ? 'hi-IN' : 'en-IN';
  const [status, setStatus] = useUrlState('dstatus', 'OPEN');
  const [page, setPage] = useState(1);
  const [collecting, setCollecting] = useState(false);
  const { data, isLoading, isFetching, isError, error, refetch } = useDepositsQuery({
    status: status === 'ALL' ? undefined : status,
    page,
    limit: LIMIT,
    sort: '-createdAt',
  });
  const items = useMemo(() => data?.items ?? [], [data]);
  const columns = useMemo(
    () => [
      {
        id: 'no',
        header: t('billing.deposits.number'),
        meta: { mono: true },
        cell: ({ row }) => row.original.depositNo,
      },
      {
        id: 'date',
        header: t('billing.bill.date'),
        cell: ({ row }) => formatDateTime(row.original.createdAt, locale),
      },
      {
        id: 'patient',
        header: t('billing.bill.patient'),
        cell: ({ row }) => (
          <PatientCell
            name={row.original.patient.name}
            uhid={row.original.patient.uhid}
            age={row.original.patient.age}
            sex={row.original.patient.gender}
          />
        ),
      },
      { id: 'mode', header: t('billing.pay.mode'), cell: ({ row }) => row.original.mode },
      {
        id: 'amount',
        header: t('billing.pay.amount'),
        meta: { align: 'right' },
        cell: ({ row }) => inrExact(row.original.amount),
      },
      {
        id: 'used',
        header: t('billing.deposits.used'),
        meta: { align: 'right' },
        cell: ({ row }) => inrExact(row.original.used + row.original.refunded),
      },
      {
        id: 'balance',
        header: t('billing.bill.balance'),
        meta: { align: 'right' },
        cell: ({ row }) => <strong>{inrExact(row.original.balance)}</strong>,
      },
      {
        id: 'status',
        header: t('common.status'),
        cell: ({ row }) => (
          <StatusBadge
            tone={row.original.status === 'OPEN' ? 'info' : 'neutral'}
            icon={false}
            label={t(`billing.deposits.status.${row.original.status}`)}
          />
        ),
      },
    ],
    [t, locale],
  );
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <FormField label={t('common.status')} className="w-full sm:w-44">
          <Select
            value={status}
            onChange={(e) => (setStatus(e.target.value), setPage(1))}
            options={['OPEN', 'CLOSED', 'ALL'].map((s) => ({
              value: s,
              label: t(`billing.deposits.status.${s}`),
            }))}
          />
        </FormField>
        {can('billing:deposit:create') && (
          <Button icon={<Plus size={16} aria-hidden="true" />} onClick={() => setCollecting(true)}>
            {t('billing.deposits.collect')}
          </Button>
        )}
      </div>
      <p className="text-sm text-muted">{t('billing.deposits.hint')}</p>
      {isError ? (
        <ErrorState
          title={t('billing.deposits.failed')}
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
          caption={t('billing.tabs.deposits')}
          empty={<EmptyState icon={Wallet} bordered={false} title={t('billing.deposits.empty')} />}
        />
      )}
      {collecting && <DepositDialog open onOpenChange={setCollecting} />}
    </div>
  );
}
