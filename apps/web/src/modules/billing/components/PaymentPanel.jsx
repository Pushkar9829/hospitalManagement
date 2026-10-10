import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, X } from 'lucide-react';
import { CASH_LIMIT_PAISE } from '@hms/shared/schemas';
import { Banner, Button, Card, FormField, IconButton, Input, Select, useToast } from '@hms/ui';
import { ApiErrorNotice } from '../../../components/ApiErrorNotice.jsx';
import { inr, parseRupees, rupeesForApi, rupeesText } from '../../../lib/money.js';
import { newIdempotencyKey } from '../../../lib/useIdempotencyKey.js';
import { useDepositsQuery, useReceivePaymentMutation } from '../api.js';
import { usePaymentModes } from '../usePaymentModes.js';
import { MoneyInput } from './MoneyInput.jsx';

let rowSeq = 0;
const newRow = (amount = '', mode = 'CASH') => ({
  id: ++rowSeq,
  mode,
  amount,
  reference: '',
  depositId: '',
  key: newIdempotencyKey(),
});

/**
 * Take payment for a final bill (design board "Billing", rules R7, R13, R17): one or more modes
 * (split payment), amounts typed in rupees and kept as paise, the reference each mode needs, an
 * open deposit for "Advance". Each mode is one receipt with its own Idempotency-Key, kept until
 * that receipt succeeds, so a retry after a network error never charges twice. Cash of
 * ₹2,00,000 or more from one person in a day is refused (section 269ST).
 */
export function PaymentPanel({ bill, onPaid }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { modes } = usePaymentModes();
  const [pay] = useReceivePaymentMutation();
  const [rows, setRows] = useState(() => [newRow(rupeesText(bill.totals.balance))]);
  const [errors, setErrors] = useState({});
  const [failure, setFailure] = useState(null);
  const [busy, setBusy] = useState(false);
  const { data: deposits } = useDepositsQuery({
    patientId: bill.patient.id,
    status: 'OPEN',
    limit: 50,
  });
  const openDeposits = useMemo(
    () => (deposits?.items ?? []).filter((d) => d.balance > 0),
    [deposits],
  );
  const usable = modes.filter((m) => m.kind !== 'ADVANCE' || openDeposits.length > 0);
  const modeOf = (code) => modes.find((m) => m.code === code);
  const paise = rows.map((r) => parseRupees(r.amount));
  const sum = paise.reduce((s, p) => s + (Number.isFinite(p) ? p : 0), 0);
  const left = bill.totals.balance - sum;
  const cashToday = rows.reduce(
    (s, r, i) => s + (modeOf(r.mode)?.kind === 'CASH' && Number.isFinite(paise[i]) ? paise[i] : 0),
    0,
  );

  const update = (id, patch) =>
    setRows((rs) =>
      rs.map((r) =>
        r.id === id
          ? {
              ...r,
              ...patch,
              ...('amount' in patch || 'mode' in patch ? { key: newIdempotencyKey() } : {}),
            }
          : r,
      ),
    );

  const validate = () => {
    const next = {};
    rows.forEach((r, i) => {
      const m = modeOf(r.mode);
      if (!paise[i] || !Number.isFinite(paise[i]) || paise[i] <= 0)
        next[`${r.id}.amount`] = t('billing.pay.amountError');
      if (m?.requiresReference && !r.reference.trim())
        next[`${r.id}.reference`] = t('billing.pay.referenceError', { mode: m.name });
      if (m?.kind === 'ADVANCE') {
        const d = openDeposits.find((x) => x.id === r.depositId);
        if (!d) next[`${r.id}.depositId`] = t('billing.pay.depositError');
        else if (paise[i] > d.balance)
          next[`${r.id}.amount`] = t('billing.pay.overDeposit', { amount: inr(d.balance) });
      }
    });
    if (sum > bill.totals.balance)
      next.total = t('billing.pay.overBalance', { amount: inr(bill.totals.balance) });
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const submit = async (e) => {
    e.preventDefault();
    setFailure(null);
    if (!validate()) return;
    setBusy(true);
    const receipts = [];
    let remaining = rows;
    try {
      for (const r of rows) {
        const amount = rupeesForApi(parseRupees(r.amount));
        const receipt = await pay({
          patientId: bill.patient.id,
          mode: r.mode,
          amount,
          reference: r.reference.trim() || undefined,
          depositId: modeOf(r.mode)?.kind === 'ADVANCE' ? r.depositId : undefined,
          allocations: [{ billId: bill.id, amount }],
          idempotencyKey: r.key,
        }).unwrap();
        receipts.push(receipt);
        remaining = remaining.filter((x) => x.id !== r.id);
      }
      setRows([newRow('')]);
      toast({
        title: t('billing.pay.received', {
          count: receipts.length,
          amount: inr(receipts.reduce((s, x) => s + x.amount, 0)),
        }),
        tone: 'success',
      });
    } catch (err) {
      setRows(remaining.length ? remaining : [newRow('')]);
      setFailure(err);
    } finally {
      setBusy(false);
      if (receipts.length) onPaid?.(receipts);
    }
  };

  return (
    <Card title={t('billing.pay.title')} headingLevel={2}>
      <form onSubmit={submit} noValidate className="flex flex-col gap-4">
        <p className="text-base text-ink">
          {t('billing.pay.due')}{' '}
          <strong className="tabular text-lg">{inr(bill.totals.balance)}</strong>
        </p>
        <ApiErrorNotice error={failure} />
        {rows.map((r) => {
          const m = modeOf(r.mode);
          return (
            <fieldset
              key={r.id}
              className="grid grid-cols-1 items-end gap-3 rounded-control border border-line bg-surface-2 p-3 sm:grid-cols-2"
            >
              <legend className="sr-only">
                {t('billing.pay.row', { n: rows.indexOf(r) + 1 })}
              </legend>
              <FormField label={t('billing.pay.mode')}>
                <Select
                  value={r.mode}
                  onChange={(e) => update(r.id, { mode: e.target.value, depositId: '' })}
                  options={usable.map((x) => ({ value: x.code, label: x.name }))}
                />
              </FormField>
              <FormField label={t('billing.pay.amount')} error={errors[`${r.id}.amount`]} required>
                <MoneyInput
                  value={r.amount}
                  onChange={(e) => update(r.id, { amount: e.target.value })}
                />
              </FormField>
              {m?.kind === 'ADVANCE' && (
                <FormField
                  label={t('billing.pay.deposit')}
                  error={errors[`${r.id}.depositId`]}
                  required
                >
                  <Select
                    value={r.depositId}
                    placeholder={t('billing.pay.chooseDeposit')}
                    onChange={(e) => update(r.id, { depositId: e.target.value })}
                    options={openDeposits.map((d) => ({
                      value: d.id,
                      label: t('billing.pay.depositOption', {
                        no: d.depositNo,
                        amount: inr(d.balance),
                      }),
                    }))}
                  />
                </FormField>
              )}
              {m?.requiresReference && (
                <FormField
                  label={t(
                    m.kind === 'UPI' || m.kind === 'BANK_TRANSFER'
                      ? 'billing.pay.utr'
                      : 'billing.pay.reference',
                  )}
                  error={errors[`${r.id}.reference`]}
                  required
                >
                  <Input
                    mono
                    value={r.reference}
                    onChange={(e) => update(r.id, { reference: e.target.value })}
                  />
                </FormField>
              )}
              {m?.kind === 'PAYMENT_LINK' && (
                <p className="text-sm text-muted sm:col-span-2">{t('billing.pay.linkHint')}</p>
              )}
              {rows.length > 1 && (
                <IconButton
                  className="justify-self-end sm:col-span-2"
                  size="sm"
                  label={t('billing.pay.removeRow', { n: rows.indexOf(r) + 1 })}
                  icon={<X size={16} aria-hidden="true" />}
                  onClick={() => setRows((rs) => rs.filter((x) => x.id !== r.id))}
                />
              )}
            </fieldset>
          );
        })}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button
            size="sm"
            variant="secondary"
            icon={<Plus size={14} aria-hidden="true" />}
            disabled={rows.length >= 4 || left <= 0}
            onClick={() =>
              setRows((rs) => [...rs, newRow(left > 0 ? rupeesText(left) : '', 'UPI')])
            }
          >
            {t('billing.pay.split')}
          </Button>
          <p className="text-sm text-muted" aria-live="polite">
            {left > 0
              ? t('billing.pay.leftAfter', { amount: inr(left) })
              : left === 0
                ? t('billing.pay.fullyPaid')
                : null}
          </p>
        </div>
        {errors.total && (
          <p role="alert" className="text-sm text-critical">
            {errors.total}
          </p>
        )}
        {cashToday >= CASH_LIMIT_PAISE && (
          <Banner tone="critical" title={t('errors.cashLimitTitle')}>
            {t('billing.pay.cashLimitHint')}
          </Banner>
        )}
        <Button type="submit" size="lg" loading={busy} disabled={cashToday >= CASH_LIMIT_PAISE}>
          {t('billing.pay.submit', { amount: inr(sum) })}
        </Button>
      </form>
    </Card>
  );
}
