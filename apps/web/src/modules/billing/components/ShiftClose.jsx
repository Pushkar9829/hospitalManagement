import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DENOMINATIONS, SHIFT_VARIANCE_PAISE } from '@hms/shared/schemas';
import { Banner, Button, Card, FormField, Input, Textarea, cn } from '@hms/ui';
import { ApiErrorNotice } from '../../../components/ApiErrorNotice.jsx';
import { inr, inrExact, parseRupees, rupeesForApi, rupeesText } from '../../../lib/money.js';
import { useCloseShiftMutation } from '../api.js';
import { countedCash, shiftVariances } from '../billing.js';
import { MoneyInput } from './MoneyInput.jsx';

/** A signed amount with its direction in words, so a variance is never told by colour alone. */
export function Variance({ paise }) {
  const { t } = useTranslation();
  const big = Math.abs(paise) > SHIFT_VARIANCE_PAISE;
  const word = paise === 0 ? 'exact' : paise > 0 ? 'over' : 'short';
  return (
    <span
      className={cn(
        'tabular font-semibold',
        big ? 'text-critical' : paise ? 'text-warning' : 'text-success',
      )}
    >
      {paise > 0 ? '+' : ''}
      {inrExact(paise)}{' '}
      <span className="text-sm font-normal">({t(`billing.shift.variance.${word}`)})</span>
    </span>
  );
}

/**
 * Close my shift (rule R11, design board "BillShift"): count the drawer note by note, enter the
 * card machine and UPI settlement totals, see the variance per mode; a variance above ₹100 needs
 * a reason and goes to the Billing Manager for verification.
 */
export function ShiftClose({ shift, onClosed }) {
  const { t } = useTranslation();
  const [close, { isLoading }] = useCloseShiftMutation();
  const [notes, setNotes] = useState({});
  const expected = shift.expected ?? { CASH: shift.openingCash };
  const nonCashModes = Object.keys(expected).filter((m) => m !== 'CASH');
  const [nonCash, setNonCash] = useState(() =>
    Object.fromEntries(nonCashModes.map((m) => [m, rupeesText(expected[m])])),
  );
  const [reason, setReason] = useState('');
  const [errors, setErrors] = useState({});
  const [failure, setFailure] = useState(null);
  const cash = countedCash(notes);
  const nonCashPaise = Object.fromEntries(
    Object.entries(nonCash).map(([m, v]) => [m, parseRupees(v) ?? 0]),
  );
  const { byMode, needsReason } = shiftVariances(expected, cash, nonCashPaise);

  const submit = async (e) => {
    e.preventDefault();
    setFailure(null);
    const next = {};
    for (const [m, p] of Object.entries(nonCashPaise))
      if (!Number.isFinite(p)) next[m] = t('billing.pay.amountError');
    if (needsReason && reason.trim().length < 3) next.reason = t('billing.shift.reasonError');
    setErrors(next);
    if (Object.keys(next).length) return;
    try {
      const res = await close({
        id: shift.id,
        version: shift.version,
        notes: Object.fromEntries(
          Object.entries(notes)
            .map(([d, n]) => [d, Number(n) || 0])
            .filter(([, n]) => n > 0),
        ),
        nonCash: Object.fromEntries(
          Object.entries(nonCashPaise).map(([m, p]) => [m, rupeesForApi(p)]),
        ),
        varianceReason: reason.trim() || undefined,
      }).unwrap();
      onClosed(res);
    } catch (err) {
      setFailure(err);
    }
  };

  return (
    <form onSubmit={submit} noValidate className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      <Card
        title={t('billing.shift.countTitle')}
        description={t('billing.shift.expectedLine', {
          expected: inr(expected.CASH ?? 0),
          opening: inr(shift.openingCash),
        })}
        headingLevel={2}
      >
        <table className="w-full border-collapse text-base">
          <caption className="sr-only">{t('billing.shift.countTitle')}</caption>
          <thead>
            <tr className="text-left text-sm text-muted">
              <th scope="col" className="py-1.5 font-semibold">
                {t('billing.shift.note')}
              </th>
              <th scope="col" className="py-1.5 font-semibold">
                {t('billing.shift.count')}
              </th>
              <th scope="col" className="py-1.5 text-right font-semibold">
                {t('billing.pay.amount')}
              </th>
            </tr>
          </thead>
          <tbody>
            {DENOMINATIONS.map((d) => (
              <tr key={d} className="border-t border-line">
                <th scope="row" className="tabular py-1.5 text-left font-medium">
                  ₹{d}
                </th>
                <td className="py-1.5">
                  <Input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    className="w-24"
                    aria-label={t('billing.shift.countOf', { note: d })}
                    value={notes[String(d)] ?? ''}
                    onChange={(e) =>
                      setNotes((n) => ({
                        ...n,
                        [String(d)]: e.target.value.replace(/\D/g, '').slice(0, 6),
                      }))
                    }
                  />
                </td>
                <td className="tabular py-1.5 text-right">
                  {inrExact(d * 100 * (Number(notes[String(d)]) || 0))}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-line-strong">
              <th scope="row" colSpan={2} className="py-2 text-left">
                {t('billing.shift.counted')}
              </th>
              <td className="tabular py-2 text-right font-semibold">{inrExact(cash)}</td>
            </tr>
            <tr>
              <th scope="row" colSpan={2} className="py-1 text-left font-normal text-muted">
                {t('billing.shift.varianceCash')}
              </th>
              <td className="py-1 text-right" aria-live="polite">
                <Variance paise={byMode.CASH} />
              </td>
            </tr>
          </tfoot>
        </table>
      </Card>
      <div className="flex flex-col gap-4">
        <Card
          title={t('billing.shift.devices')}
          description={t('billing.shift.devicesHint')}
          headingLevel={2}
        >
          {nonCashModes.length ? (
            <div className="flex flex-col gap-3">
              {nonCashModes.map((m) => (
                <div key={m} className="grid grid-cols-1 items-end gap-2 sm:grid-cols-[1fr_auto]">
                  <FormField
                    label={t('billing.shift.deviceTotal', {
                      mode: t(`billing.modeKinds.${m}`, { defaultValue: m }),
                    })}
                    hint={t('billing.shift.system', { amount: inr(expected[m]) })}
                    error={errors[m]}
                  >
                    <MoneyInput
                      value={nonCash[m] ?? ''}
                      onChange={(e) => setNonCash((v) => ({ ...v, [m]: e.target.value }))}
                    />
                  </FormField>
                  <span className="pb-3" aria-live="polite">
                    <Variance paise={byMode[m] ?? 0} />
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-base text-muted">{t('billing.shift.noDevices')}</p>
          )}
        </Card>
        <Card headingLevel={2} title={t('billing.shift.closeTitle')}>
          <div className="flex flex-col gap-4">
            {needsReason ? (
              <Banner tone="warning">{t('billing.shift.needsReason')}</Banner>
            ) : (
              <Banner tone="success">{t('billing.shift.withinTolerance')}</Banner>
            )}
            <FormField
              label={t('billing.shift.reason')}
              error={errors.reason}
              required={needsReason}
              optional={!needsReason}
            >
              <Textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
            </FormField>
            <ApiErrorNotice error={failure} />
            <Button type="submit" size="lg" loading={isLoading}>
              {t('billing.shift.close')}
            </Button>
          </div>
        </Card>
      </div>
    </form>
  );
}
