import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { Undo2 } from 'lucide-react';
import {
  Button,
  DataTable,
  Dialog,
  EmptyState,
  ErrorState,
  FormField,
  Input,
  Select,
  StatusBadge,
  formatDateTime,
  useToast,
} from '@hms/ui';
import { apiError } from '../../../app/apiError.js';
import { ApiErrorNotice } from '../../../components/ApiErrorNotice.jsx';
import { useCan } from '../../../lib/useCan.js';
import { useIdempotencyKey } from '../../../lib/useIdempotencyKey.js';
import { inr, inrExact } from '../../../lib/money.js';
import { useUrlState } from '../../../lib/useUrlState.js';
import { usePayRefundMutation, useRefundsQuery } from '../api.js';

const LIMIT = 25;

/** Pays out an approved refund through its original modes (rule R6) from the open shift. */
function PayRefundDialog({ refund, onOpenChange }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [pay, { isLoading }] = usePayRefundMutation();
  const [key, renewKey] = useIdempotencyKey();
  const [reference, setReference] = useState('');
  const [failure, setFailure] = useState(null);
  const submit = async (e) => {
    e.preventDefault();
    setFailure(null);
    try {
      await pay({
        id: refund.id,
        version: refund.version,
        reference: reference.trim() || undefined,
        idempotencyKey: key(),
      }).unwrap();
      renewKey();
      toast({
        title: t('billing.refunds.paid', { no: refund.refundNo, amount: inr(refund.amount) }),
        tone: 'success',
      });
      onOpenChange(false);
    } catch (err) {
      setFailure(err);
    }
  };
  return (
    <Dialog
      open
      onOpenChange={onOpenChange}
      size="sm"
      title={t('billing.refunds.payTitle', { no: refund.refundNo })}
      description={t('billing.refunds.payBody', {
        amount: inr(refund.amount),
        modes: refund.modes.map((m) => `${m.mode} ${inr(m.amount)}`).join(', '),
      })}
    >
      <form onSubmit={submit} noValidate className="flex flex-col gap-4">
        <ApiErrorNotice error={failure} />
        <FormField label={t('billing.pay.reference')} optional>
          <Input mono value={reference} onChange={(e) => setReference(e.target.value)} />
        </FormField>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" loading={isLoading}>
            {t('billing.refunds.pay')}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

/**
 * Refunds approved after a cancellation (rule R6): waiting to be paid, or paid. Requests are
 * raised from the bill (Cancel bill) and decided under Approvals.
 */
export function RefundsTab() {
  const { t, i18n } = useTranslation();
  const can = useCan();
  const locale = i18n.language === 'hi' ? 'hi-IN' : 'en-IN';
  const [status, setStatus] = useUrlState('rstatus', 'APPROVED');
  const [page, setPage] = useState(1);
  const [paying, setPaying] = useState(null);
  const { data, isLoading, isFetching, isError, error, refetch } = useRefundsQuery({
    status: status === 'ALL' ? undefined : status,
    page,
    limit: LIMIT,
    sort: '-createdAt',
  });
  const items = useMemo(() => data?.items ?? [], [data]);
  const canPay = can('billing:refund:pay');
  const columns = useMemo(
    () => [
      {
        id: 'no',
        header: t('billing.refunds.number'),
        meta: { mono: true },
        cell: ({ row }) => row.original.refundNo,
      },
      {
        id: 'date',
        header: t('billing.bill.date'),
        cell: ({ row }) => formatDateTime(row.original.createdAt, locale),
      },
      {
        id: 'bill',
        header: t('billing.refunds.bill'),
        cell: ({ row }) =>
          row.original.billId ? (
            <Link
              to={`/billing/bills/${row.original.billId}`}
              className="underline underline-offset-2"
            >
              {t('billing.refunds.openBill')}
            </Link>
          ) : (
            '-'
          ),
      },
      {
        id: 'amount',
        header: t('billing.pay.amount'),
        meta: { align: 'right' },
        cell: ({ row }) => inrExact(row.original.amount),
      },
      {
        id: 'modes',
        header: t('billing.refunds.modes'),
        cell: ({ row }) => row.original.modes.map((m) => m.mode).join(', '),
      },
      { id: 'reason', header: t('billing.refunds.reason'), cell: ({ row }) => row.original.reason },
      {
        id: 'status',
        header: t('common.status'),
        cell: ({ row }) => (
          <StatusBadge
            tone={row.original.status === 'PAID' ? 'success' : 'warning'}
            label={t(`billing.refunds.status.${row.original.status}`)}
          />
        ),
      },
      ...(canPay
        ? [
            {
              id: 'actions',
              header: <span className="sr-only">{t('common.actions')}</span>,
              meta: { align: 'right' },
              cell: ({ row }) =>
                row.original.status === 'APPROVED' && (
                  <Button size="sm" onClick={() => setPaying(row.original)}>
                    {t('billing.refunds.pay')}
                  </Button>
                ),
            },
          ]
        : []),
    ],
    [t, locale, canPay],
  );
  return (
    <div className="flex flex-col gap-4">
      <FormField label={t('common.status')} className="w-full sm:w-52">
        <Select
          value={status}
          onChange={(e) => (setStatus(e.target.value), setPage(1))}
          options={['APPROVED', 'PAID', 'ALL'].map((s) => ({
            value: s,
            label: t(`billing.refunds.status.${s}`),
          }))}
        />
      </FormField>
      <p className="text-sm text-muted">{t('billing.refunds.hint')}</p>
      {isError ? (
        <ErrorState
          title={t('billing.refunds.failed')}
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
          caption={t('billing.tabs.refunds')}
          empty={<EmptyState icon={Undo2} bordered={false} title={t('billing.refunds.empty')} />}
        />
      )}
      {paying && <PayRefundDialog refund={paying} onOpenChange={(o) => !o && setPaying(null)} />}
    </div>
  );
}
