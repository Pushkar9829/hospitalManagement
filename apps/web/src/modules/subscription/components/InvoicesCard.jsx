import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FileText } from 'lucide-react';
import { Button, Card, DataTable, EmptyState, StatusBadge, formatLongDate } from '@hms/ui';
import { PdfPreviewDialog } from '../../../components/PdfPreviewDialog.jsx';
import { inrExact } from '../../../lib/money.js';

const TONES = { PAID: 'success', ISSUED: 'warning', VOID: 'neutral', CANCELLED: 'neutral' };

/** Platform invoices (GST invoices from the platform company) with their PDF. */
export function InvoicesCard({ invoices = [], id }) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'hi' ? 'hi-IN' : 'en-IN';
  const [open, setOpen] = useState(null);
  const columns = useMemo(
    () => [
      {
        id: 'number',
        header: t('subscription.invoices.number'),
        meta: { mono: true },
        cell: ({ row }) => row.original.number,
      },
      {
        id: 'kind',
        header: t('subscription.invoices.kind'),
        cell: ({ row }) =>
          t(`subscription.invoices.kinds.${row.original.kind}`, {
            defaultValue: row.original.kind,
          }),
      },
      {
        id: 'period',
        header: t('subscription.invoices.period'),
        cell: ({ row }) =>
          row.original.period?.start
            ? `${formatLongDate(row.original.period.start, locale)} – ${formatLongDate(row.original.period.end, locale)}`
            : formatLongDate(row.original.issuedAt, locale),
      },
      {
        id: 'subtotal',
        header: t('subscription.invoices.amount'),
        meta: { align: 'right' },
        cell: ({ row }) => inrExact(row.original.subtotal),
      },
      {
        id: 'gst',
        header: t('subscription.invoices.gst'),
        meta: { align: 'right' },
        cell: ({ row }) => inrExact(row.original.gst),
      },
      {
        id: 'total',
        header: t('subscription.invoices.total'),
        meta: { align: 'right' },
        cell: ({ row }) => <strong>{inrExact(row.original.total)}</strong>,
      },
      {
        id: 'status',
        header: t('common.status'),
        cell: ({ row }) => (
          <span className="flex flex-col items-start gap-0.5">
            <StatusBadge
              tone={TONES[row.original.status] ?? 'neutral'}
              label={t(`subscription.invoices.status.${row.original.status}`, {
                defaultValue: row.original.status,
              })}
            />
            {row.original.status === 'ISSUED' && row.original.dueAt && (
              <span className="text-xs text-muted">
                {t('subscription.invoices.due', {
                  date: formatLongDate(row.original.dueAt, locale),
                })}
              </span>
            )}
          </span>
        ),
      },
      {
        id: 'pdf',
        header: <span className="sr-only">{t('subscription.invoices.pdf')}</span>,
        meta: { align: 'right' },
        cell: ({ row }) => (
          <Button
            size="sm"
            variant="secondary"
            icon={<FileText size={14} aria-hidden="true" />}
            aria-label={t('subscription.invoices.pdfFor', { number: row.original.number })}
            onClick={() => setOpen(row.original)}
          >
            {t('subscription.invoices.pdf')}
          </Button>
        ),
      },
    ],
    [t, locale],
  );
  return (
    <Card id={id} title={t('subscription.invoices.title')} headingLevel={2} padding={false}>
      <DataTable
        className="p-4"
        columns={columns}
        data={invoices}
        caption={t('subscription.invoices.title')}
        empty={
          <EmptyState icon={FileText} bordered={false} title={t('subscription.invoices.empty')} />
        }
      />
      {open && (
        <PdfPreviewDialog
          open
          onOpenChange={(o) => !o && setOpen(null)}
          url={`/subscription/invoices/${open.id}/pdf`}
          title={t('subscription.invoices.pdfTitle', { number: open.number })}
          number={open.number}
        />
      )}
    </Card>
  );
}
