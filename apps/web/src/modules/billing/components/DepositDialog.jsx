import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Dialog, FormField, Input, Select, useToast } from '@hms/ui';
import { ApiErrorNotice } from '../../../components/ApiErrorNotice.jsx';
import { inr, parseRupees, rupeesForApi } from '../../../lib/money.js';
import { useIdempotencyKey } from '../../../lib/useIdempotencyKey.js';
import { PatientPicker } from '../../patients/components/PatientPicker.jsx';
import { useTakeDepositMutation } from '../api.js';
import { usePaymentModes } from '../usePaymentModes.js';
import { MoneyInput } from './MoneyInput.jsx';

/**
 * Advance deposit (rule R13): cash, card, UPI, cheque or bank transfer, with the reference the
 * mode needs; adjusted later on a bill with payment mode "Advance". Needs an open shift; cash
 * follows the section 269ST limit.
 */
export function DepositDialog({ open, onOpenChange, patient: fixed, onDone }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { modes } = usePaymentModes();
  const [take, { isLoading }] = useTakeDepositMutation();
  const [key, renewKey] = useIdempotencyKey();
  const [patient, setPatient] = useState(fixed ?? null);
  const [mode, setMode] = useState('CASH');
  const [amount, setAmount] = useState('');
  const [reference, setReference] = useState('');
  const [purpose, setPurpose] = useState('');
  const [errors, setErrors] = useState({});
  const [failure, setFailure] = useState(null);
  const usable = modes.filter((m) => !['ADVANCE', 'PAYMENT_LINK'].includes(m.kind));
  const chosen = usable.find((m) => m.code === mode);

  const submit = async (e) => {
    e.preventDefault();
    setFailure(null);
    const paise = parseRupees(amount);
    const next = {};
    if (!patient) next.patient = t('billing.newBill.pickPatient');
    if (!paise || Number.isNaN(paise) || paise <= 0) next.amount = t('billing.pay.amountError');
    if (chosen?.requiresReference && !reference.trim())
      next.reference = t('billing.pay.referenceError', { mode: chosen.name });
    setErrors(next);
    if (Object.keys(next).length) return;
    try {
      const d = await take({
        patientId: patient.id,
        mode,
        amount: rupeesForApi(paise),
        reference: reference.trim() || undefined,
        purpose: purpose.trim() || undefined,
        idempotencyKey: key(),
      }).unwrap();
      renewKey();
      toast({
        title: t('billing.deposits.taken', { no: d.depositNo, amount: inr(d.amount) }),
        tone: 'success',
      });
      onDone?.(d);
      onOpenChange(false);
    } catch (err) {
      setFailure(err);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={t('billing.deposits.collect')} size="md">
      <form onSubmit={submit} noValidate className="flex flex-col gap-4">
        <ApiErrorNotice error={failure} />
        {fixed ? null : (
          <PatientPicker
            label={t('billing.bill.patient')}
            value={patient}
            onChange={setPatient}
            error={errors.patient}
          />
        )}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField label={t('billing.pay.mode')}>
            <Select
              value={mode}
              onChange={(e) => {
                setMode(e.target.value);
                renewKey();
              }}
              options={usable.map((m) => ({ value: m.code, label: m.name }))}
            />
          </FormField>
          <FormField label={t('billing.pay.amount')} error={errors.amount} required>
            <MoneyInput
              value={amount}
              onChange={(e) => {
                setAmount(e.target.value);
                renewKey();
              }}
            />
          </FormField>
          {chosen?.requiresReference && (
            <FormField label={t('billing.pay.reference')} error={errors.reference} required>
              <Input mono value={reference} onChange={(e) => setReference(e.target.value)} />
            </FormField>
          )}
          <FormField label={t('billing.deposits.purpose')} optional>
            <Input value={purpose} maxLength={120} onChange={(e) => setPurpose(e.target.value)} />
          </FormField>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" loading={isLoading}>
            {t('billing.deposits.collect')}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
