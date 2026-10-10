import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import { IconButton, Input } from '@hms/ui';
import { inrExact } from '../../../lib/money.js';

/**
 * Bill lines as a table: service, quantity (editable), rate, GST and amount. `lines` carry
 * { serviceId, code, name, qty, unitPrice, taxRate, gross?, tax?, net? } in paise.
 */
export function LinesEditor({ lines, onChange, readOnly = false, caption }) {
  const { t } = useTranslation();
  const setQty = (i, qty) => onChange(lines.map((l, j) => (j === i ? { ...l, qty } : l)));
  return (
    <div className="overflow-x-auto rounded-card border border-line">
      <table className="w-full border-collapse text-left text-base">
        <caption className="sr-only">{caption ?? t('billing.lines.caption')}</caption>
        <thead>
          <tr className="bg-surface-2 text-sm text-muted">
            <th scope="col" className="px-3 py-2 font-semibold">
              {t('billing.lines.service')}
            </th>
            <th scope="col" className="w-24 px-3 py-2 font-semibold">
              {t('billing.lines.qty')}
            </th>
            <th scope="col" className="px-3 py-2 text-right font-semibold">
              {t('billing.lines.rate')}
            </th>
            <th scope="col" className="px-3 py-2 text-right font-semibold">
              {t('billing.lines.gst')}
            </th>
            <th scope="col" className="px-3 py-2 text-right font-semibold">
              {t('billing.lines.amount')}
            </th>
            {!readOnly && (
              <th scope="col" className="w-12 px-3 py-2">
                <span className="sr-only">{t('common.actions')}</span>
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {lines.map((l, i) => {
            const gross = l.gross ?? l.unitPrice * l.qty;
            const tax =
              l.cgst != null ? l.cgst + l.sgst : Math.round((gross * (l.taxRate ?? 0)) / 100);
            return (
              <tr key={`${l.serviceId}-${i}`} className="border-t border-line align-middle">
                <th scope="row" className="px-3 py-2 font-normal">
                  <span className="block font-medium text-ink">{l.name}</span>
                  <span className="block font-mono text-sm text-muted">{l.code}</span>
                </th>
                <td className="px-3 py-2">
                  {readOnly ? (
                    <span className="tabular">{l.qty}</span>
                  ) : (
                    <Input
                      type="number"
                      inputMode="numeric"
                      min={1}
                      max={999}
                      aria-label={t('billing.lines.qtyFor', { name: l.name })}
                      className="w-20"
                      value={l.qty}
                      onChange={(e) =>
                        setQty(i, Math.max(1, Math.min(999, Number(e.target.value) || 1)))
                      }
                    />
                  )}
                </td>
                <td className="tabular px-3 py-2 text-right">{inrExact(l.unitPrice)}</td>
                <td className="px-3 py-2 text-right text-sm">
                  {l.taxRate ? (
                    <span className="tabular">
                      {t('billing.gstRate', { rate: l.taxRate })}
                      <span className="block text-muted">{inrExact(tax)}</span>
                    </span>
                  ) : (
                    <span className="text-muted">{t('billing.exempt')}</span>
                  )}
                </td>
                <td className="tabular px-3 py-2 text-right font-semibold">
                  {inrExact(l.net ?? gross + tax)}
                  {l.discount > 0 && (
                    <span className="block text-sm font-normal text-muted">
                      {t('billing.lines.lessDiscount', { amount: inrExact(l.discount) })}
                    </span>
                  )}
                </td>
                {!readOnly && (
                  <td className="px-3 py-2">
                    <IconButton
                      size="sm"
                      label={t('billing.lines.remove', { name: l.name })}
                      icon={<X size={16} aria-hidden="true" />}
                      onClick={() => onChange(lines.filter((_, j) => j !== i))}
                    />
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** Gross, discount, GST (CGST + SGST), round-off and the total as printed on Indian bills. */
export function TotalsList({ totals, estimate = false }) {
  const { t } = useTranslation();
  const rows = [
    [t('billing.totals.gross'), totals.gross],
    totals.discount ? [t('billing.totals.discount'), -totals.discount] : null,
    totals.cgst != null
      ? totals.tax
        ? [
            t('billing.totals.cgstSgst', {
              cgst: inrExact(totals.cgst),
              sgst: inrExact(totals.sgst),
            }),
            totals.tax,
          ]
        : [t('billing.totals.taxExempt'), 0]
      : [t('billing.totals.tax'), totals.tax],
    [t('billing.totals.roundOff'), totals.roundOff],
  ].filter(Boolean);
  return (
    <dl className="flex flex-col gap-1.5 text-base">
      {rows.map(([k, v]) => (
        <div key={k} className="flex justify-between gap-4">
          <dt className="text-muted">{k}</dt>
          <dd className="tabular text-ink">{inrExact(v)}</dd>
        </div>
      ))}
      <div className="mt-1 flex justify-between gap-4 border-t border-line pt-2 text-lg font-semibold">
        <dt>{estimate ? t('billing.totals.estimate') : t('billing.totals.total')}</dt>
        <dd className="tabular">{inrExact(totals.total)}</dd>
      </div>
      {totals.paid != null && totals.paid > 0 && (
        <>
          <div className="flex justify-between gap-4">
            <dt className="text-muted">{t('billing.totals.paid')}</dt>
            <dd className="tabular text-ink">{inrExact(totals.paid)}</dd>
          </div>
          {totals.refunded > 0 && (
            <div className="flex justify-between gap-4">
              <dt className="text-muted">{t('billing.totals.refunded')}</dt>
              <dd className="tabular text-ink">{inrExact(totals.refunded)}</dd>
            </div>
          )}
        </>
      )}
      {totals.balance != null && (
        <div className="flex justify-between gap-4 font-semibold">
          <dt>{t('billing.totals.balance')}</dt>
          <dd className="tabular">{inrExact(totals.balance)}</dd>
        </div>
      )}
    </dl>
  );
}
