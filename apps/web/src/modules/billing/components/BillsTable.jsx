import { useMemo } from 'react';
import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { ReceiptIndianRupee } from 'lucide-react';
import {
  DataTable,
  EmptyState,
  ErrorState,
  PatientCell,
  StatusBadge,
  formatDateTime,
} from '@hms/ui';
import { apiError } from '../../../app/apiError.js';
import { inrExact } from '../../../lib/money.js';
import { useBillsQuery } from '../api.js';
import { BILL_TONES } from '../billing.js';

/** A bill's status chip; a bill on hold for an approval says so. */
export function BillStatus({ bill, inline = false }) {
  const { t } = useTranslation();
  return (
    <span className={inline ? 'inline-flex flex-wrap items-center gap-1' : 'flex flex-col items-start gap-1'}>
      <StatusBadge
        tone={BILL_TONES[bill.status] ?? 'neutral'}
        icon={false}
        label={t(`billing.status.${bill.status}`)}
      />
      {bill.hold && <StatusBadge tone="warning" label={t(`billing.hold.${bill.hold}`)} />}
    </span>
  );
}

/** Bills (server-paged): number, date, patient, totals and status; a row opens the bill. */
export function BillsTable({ params, page, onPageChange, limit = 25, hidePatient = false, empty }) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const locale = i18n.language === 'hi' ? 'hi-IN' : 'en-IN';
  const { data, isLoading, isFetching, isError, error, refetch } = useBillsQuery({
    ...params,
    page,
    limit,
    sort: '-createdAt',
  });
  const items = useMemo(() => data?.items ?? [], [data]);
  const columns = useMemo(
    () => [
      {
        id: 'billNo',
        header: t('billing.bill.number'),
        meta: { mono: true },
        cell: ({ row }) =>
          row.original.billNo ?? <span className="text-muted">{t('billing.bill.draft')}</span>,
      },
      {
        id: 'date',
        header: t('billing.bill.date'),
        cell: ({ row }) =>
          formatDateTime(row.original.finalizedAt ?? row.original.createdAt, locale),
      },
      ...(hidePatient
        ? []
        : [
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
          ]),
      {
        id: 'type',
        header: t('billing.bill.type'),
        cell: ({ row }) => t(`billing.types.${row.original.type}`),
      },
      {
        id: 'total',
        header: t('billing.bill.total'),
        meta: { align: 'right' },
        cell: ({ row }) => inrExact(row.original.totals.total),
      },
      {
        id: 'balance',
        header: t('billing.bill.balance'),
        meta: { align: 'right' },
        cell: ({ row }) =>
          inrExact(row.original.status === 'CANCELLED' ? 0 : row.original.totals.balance),
      },
      {
        id: 'status',
        header: t('common.status'),
        cell: ({ row }) => <BillStatus bill={row.original} />,
      },
    ],
    [t, locale, hidePatient],
  );
  if (isError)
    return (
      <ErrorState
        title={t('billing.bills.failed')}
        requestId={apiError(error)?.requestId}
        onRetry={refetch}
      />
    );
  return (
    <DataTable
      columns={columns}
      data={items}
      total={data?.total}
      page={page}
      limit={limit}
      onPageChange={onPageChange}
      loading={isLoading || (isFetching && !items.length)}
      caption={t('billing.bills.title')}
      onRowClick={(b) => navigate(`/billing/bills/${b.id}`)}
      empty={
        empty ?? (
          <EmptyState icon={ReceiptIndianRupee} bordered={false} title={t('billing.bills.empty')} />
        )
      }
    />
  );
}
