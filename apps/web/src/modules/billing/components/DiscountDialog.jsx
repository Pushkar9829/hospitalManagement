import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { discountRequestInput } from '@hms/shared/schemas';
import { translateValidation } from '@hms/i18n';
import { Banner, Button, Dialog, FormField, Input, Textarea } from '@hms/ui';
import { ApiErrorNotice } from '../../../components/ApiErrorNotice.jsx';
import { inr } from '../../../lib/money.js';
import { useRequestDiscountMutation } from '../api.js';
import { DISCOUNT_L2, discountPaise } from '../billing.js';

/**
 * Ask for a discount on a final bill before payment (rule R5: cashiers cannot give discounts).
 * Shows the amount and who decides: the Billing Manager, and the Super Admin as well above 10%
 * or ₹10,000. The bill is held until the request is decided (202).
 */
export function DiscountDialog({ bill, onOpenChange, onDone }) {
  const { t } = useTranslation();
  const [request, { isLoading }] = useRequestDiscountMutation();
  const [kind, setKind] = useState('PERCENT');
  const [value, setValue] = useState('');
  const [reason, setReason] = useState('');
  const [errors, setErrors] = useState({});
  const [failure, setFailure] = useState(null);
  const gross = bill.totals.gross;
  const amount = Math.min(discountPaise(kind, value, gross), gross);
  const percent = gross ? Math.round((amount * 10000) / gross) / 100 : 0;
  const secondLevel = percent > DISCOUNT_L2.percent || amount > DISCOUNT_L2.amount;

  const submit = async (e) => {
    e.preventDefault();
    setFailure(null);
    const parsed = discountRequestInput.safeParse({
      version: bill.version,
      kind,
      value: Number(value),
      reason,
    });
    if (!parsed.success) {
      const next = {};
      for (const i of parsed.error.issues)
        next[i.path[0]] ??=
          i.path[0] === 'value' && !Number(value)
            ? t('billing.discount.valueError')
            : translateValidation(t, i.message);
      setErrors(next);
      return;
    }
    setErrors({});
    try {
      const res = await request({ id: bill.id, ...parsed.data }).unwrap();
      onDone(res);
      onOpenChange(false);
    } catch (err) {
      setFailure(err);
    }
  };

  return (
    <Dialog
      open
      onOpenChange={onOpenChange}
      size="md"
      title={t('billing.discount.title', { no: bill.billNo })}
      description={t('billing.discount.body')}
    >
      <form onSubmit={submit} noValidate className="flex flex-col gap-4">
        <ApiErrorNotice error={failure} />
        <fieldset className="flex flex-wrap gap-2">
          <legend className="mb-1.5 text-sm font-semibold text-ink">
            {t('billing.discount.kind')}
          </legend>
          {['PERCENT', 'AMOUNT'].map((k) => (
            <label
              key={k}
              className="flex min-h-tap cursor-pointer items-center gap-2 rounded-control border border-line-strong px-3 has-[:checked]:border-primary has-[:checked]:bg-info-bg has-[:checked]:font-semibold"
            >
              <input
                type="radio"
                name="discount-kind"
                checked={kind === k}
                onChange={() => setKind(k)}
                className="size-4 accent-primary"
              />
              {t(`billing.discount.kinds.${k}`)}
            </label>
          ))}
        </fieldset>
        <FormField
          label={kind === 'PERCENT' ? t('billing.discount.percent') : t('billing.discount.amount')}
          error={errors.value}
          required
        >
          <Input
            type="text"
            inputMode="decimal"
            className="tabular"
            value={value}
            onChange={(e) => setValue(e.target.value.replace(/[^\d.]/g, ''))}
          />
        </FormField>
        <div aria-live="polite">
          {amount > 0 && (
            <Banner tone={secondLevel ? 'warning' : 'info'}>
              {t('billing.discount.preview', {
                amount: inr(amount),
                percent,
                total: inr(gross),
              })}{' '}
              {secondLevel ? t('billing.discount.twoLevels') : t('billing.discount.oneLevel')}
            </Banner>
          )}
        </div>
        <FormField
          label={t('billing.discount.reason')}
          hint={t('billing.discount.reasonHint')}
          error={errors.reason}
          required
        >
          <Textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
        </FormField>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" loading={isLoading}>
            {t('billing.discount.submit')}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
