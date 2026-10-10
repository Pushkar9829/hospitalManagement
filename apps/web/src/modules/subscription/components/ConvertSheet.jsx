import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PRICE_BOOK, quote } from '@hms/shared';
import { Button, FormField, Input, Sheet } from '@hms/ui';
import { ApiErrorNotice } from '../../../components/ApiErrorNotice.jsx';
import { inr, inrExact } from '../../../lib/money.js';
import { useConvertTrialMutation } from '../api.js';

const PLANS = ['CLINIC', 'HOSPITAL', 'ENTERPRISE'];
const QTY = ['branches', 'beds', 'entities', 'users'];

/**
 * End the trial with a plan (spec 3.4): plan, monthly or annual (two months free), quantities.
 * The price is worked out from the shared price book as you choose; confirming issues the first
 * invoice, and the plan starts when it is paid. Enterprise is priced by Sales.
 */
export function ConvertSheet({ sub, onOpenChange, onInvoice }) {
  const { t } = useTranslation();
  const [convert, { isLoading }] = useConvertTrialMutation();
  const [plan, setPlan] = useState(sub.plan && sub.plan !== 'ENTERPRISE' ? sub.plan : 'HOSPITAL');
  const [cycle, setCycle] = useState(sub.cycle ?? 'MONTHLY');
  const [qty, setQty] = useState({
    branches: String(Math.max(1, sub.usage?.branches ?? 1)),
    beds: String(sub.usage?.beds ?? 0),
    entities: '1',
    users: String(Math.max(1, sub.usage?.users ?? 1)),
  });
  const [failure, setFailure] = useState(null);
  const quantities = Object.fromEntries(
    QTY.map((k) => [k, Math.max(k === 'beds' ? 0 : 1, Number(qty[k]) || 0)]),
  );
  let priced = null;
  try {
    priced = plan === 'ENTERPRISE' ? null : quote({ plan, cycle, quantities });
  } catch {
    priced = null;
  }
  const limits = PRICE_BOOK.plans[plan]?.limits;

  const submit = async (e) => {
    e.preventDefault();
    setFailure(null);
    try {
      const inv = await convert({ plan, cycle, quantities }).unwrap();
      onInvoice(inv);
      onOpenChange(false);
    } catch (err) {
      setFailure(err);
    }
  };

  return (
    <Sheet
      open
      onOpenChange={onOpenChange}
      size="lg"
      title={t('subscription.convert.title')}
      description={t('subscription.convert.hint')}
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" form="convert-form" loading={isLoading} disabled={!priced}>
            {priced
              ? t('subscription.convert.submit', { amount: inr(priced.total) })
              : t('subscription.convert.contactSales')}
          </Button>
        </>
      }
    >
      <form id="convert-form" onSubmit={submit} noValidate className="flex flex-col gap-5">
        <ApiErrorNotice error={failure} />
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1.5 text-sm font-semibold text-ink">
            {t('subscription.convert.plan')}
          </legend>
          {PLANS.map((p) => {
            const def = PRICE_BOOK.plans[p];
            return (
              <label
                key={p}
                className="flex min-h-tap cursor-pointer items-start gap-3 rounded-control border border-line-strong px-3 py-2 has-[:checked]:border-primary has-[:checked]:bg-info-bg"
              >
                <input
                  type="radio"
                  name="plan"
                  checked={plan === p}
                  onChange={() => setPlan(p)}
                  className="mt-1 size-4 accent-primary"
                />
                <span className="flex-1">
                  <span className="block font-semibold text-ink">{def.name}</span>
                  <span className="block text-sm text-muted">
                    {def.monthly == null
                      ? t('subscription.convert.byQuote')
                      : t('subscription.convert.perMonth', { amount: inr(def.monthly) })}
                    {' · '}
                    {def.limits.users >= 100000
                      ? t('subscription.convert.unlimited')
                      : t('subscription.convert.limits', {
                          users: def.limits.users,
                          branches: def.limits.branches,
                          beds: def.limits.beds,
                        })}
                  </span>
                </span>
              </label>
            );
          })}
        </fieldset>
        <fieldset className="flex flex-wrap gap-2">
          <legend className="mb-1.5 text-sm font-semibold text-ink">
            {t('subscription.convert.cycle')}
          </legend>
          {['MONTHLY', 'ANNUAL'].map((c) => (
            <label
              key={c}
              className="flex min-h-tap cursor-pointer items-center gap-2 rounded-control border border-line-strong px-3 has-[:checked]:border-primary has-[:checked]:bg-info-bg has-[:checked]:font-semibold"
            >
              <input
                type="radio"
                name="cycle"
                checked={cycle === c}
                onChange={() => setCycle(c)}
                className="size-4 accent-primary"
              />
              {t(`subscription.cycles.${c}`)}
            </label>
          ))}
        </fieldset>
        <fieldset className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <legend className="mb-1.5 text-sm font-semibold text-ink">
            {t('subscription.convert.quantities')}
          </legend>
          {QTY.map((k) => (
            <FormField
              key={k}
              label={t(`subscription.usage.${k}`)}
              hint={
                limits && limits[k] != null
                  ? t('subscription.convert.upTo', { count: limits[k] })
                  : undefined
              }
            >
              <Input
                type="number"
                inputMode="numeric"
                min={k === 'beds' ? 0 : 1}
                value={qty[k]}
                onChange={(e) => setQty((q) => ({ ...q, [k]: e.target.value }))}
              />
            </FormField>
          ))}
        </fieldset>
        {priced ? (
          <section
            aria-labelledby="convert-price"
            className="flex flex-col gap-2 rounded-card border border-line bg-surface-2 p-4"
            aria-live="polite"
          >
            <h3 id="convert-price" className="text-md font-semibold text-ink">
              {t('subscription.convert.price')}
            </h3>
            <ul className="flex flex-col gap-1 text-sm">
              {priced.lines.map((l) => (
                <li key={l.item} className="flex justify-between gap-3">
                  <span className="text-muted">{l.description}</span>
                  <span className="tabular">{inrExact(l.amount)}</span>
                </li>
              ))}
            </ul>
            <dl className="flex flex-col gap-1 text-base">
              <div className="flex justify-between gap-3">
                <dt className="text-muted">
                  {t('subscription.change.gst', { rate: PRICE_BOOK.gstRate })}
                </dt>
                <dd className="tabular">{inrExact(priced.gst)}</dd>
              </div>
              <div className="flex justify-between gap-3 border-t border-line pt-1.5 font-semibold">
                <dt>
                  {t(
                    cycle === 'ANNUAL'
                      ? 'subscription.convert.totalYear'
                      : 'subscription.convert.totalMonth',
                  )}
                </dt>
                <dd className="tabular">{inrExact(priced.total)}</dd>
              </div>
            </dl>
          </section>
        ) : (
          <p className="text-base text-muted">{t('subscription.convert.enterprise')}</p>
        )}
      </form>
    </Sheet>
  );
}
