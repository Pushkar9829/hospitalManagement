import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { patientMergeInput } from '@hms/shared/schemas';
import { translateValidation } from '@hms/i18n';
import { Button, Dialog, FormField, PatientCell, Textarea } from '@hms/ui';
import { ApiErrorNotice } from '../../../components/ApiErrorNotice.jsx';
import { useRequestMergeMutation } from '../api.js';
import { PatientPicker } from './PatientPicker.jsx';

/**
 * Merge two UHIDs of the same person (spec 5.4, maker-checker): pick the other record, choose
 * the one that stays, give a reason. The request waits for the Hospital Admin (202); nothing
 * moves until it is approved, then the merged UHID redirects to the surviving one.
 */
export function MergeDialog({ patient, open, onOpenChange, onDone }) {
  const { t } = useTranslation();
  const [merge, { isLoading }] = useRequestMergeMutation();
  const [other, setOther] = useState(null);
  const [keep, setKeep] = useState('this');
  const [reason, setReason] = useState('');
  const [errors, setErrors] = useState({});
  const [failure, setFailure] = useState(null);
  const me = {
    id: patient.id,
    uhid: patient.uhid,
    name: patient.name.full,
    age: patient.age,
    gender: patient.gender,
  };

  const submit = async (e) => {
    e.preventDefault();
    setFailure(null);
    const survivor = keep === 'this' ? me : other;
    const merged = keep === 'this' ? other : me;
    const parsed = patientMergeInput.safeParse({
      survivorId: survivor?.id,
      mergedId: merged?.id,
      reason,
    });
    if (!other || !parsed.success) {
      const next = {};
      if (!other) next.other = t('patients.merge.pickOther');
      for (const i of parsed.error?.issues ?? [])
        if (i.path[0] === 'reason') next.reason = translateValidation(t, i.message);
      setErrors(next);
      return;
    }
    setErrors({});
    try {
      const res = await merge(parsed.data).unwrap();
      onDone({ approvalId: res?.approvalId ?? null, survivor, merged });
      onOpenChange(false);
    } catch (err) {
      setFailure(err);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      size="lg"
      title={t('patients.merge.title', { uhid: patient.uhid })}
      description={t('patients.merge.body')}
    >
      <form onSubmit={submit} noValidate className="flex flex-col gap-4">
        <ApiErrorNotice error={failure} />
        <PatientPicker
          label={t('patients.merge.other')}
          value={other}
          onChange={setOther}
          exclude={patient.id}
          error={errors.other}
          autoFocus
        />
        {other && (
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-sm font-semibold text-ink">
              {t('patients.merge.keep')}
            </legend>
            {[
              ['this', me],
              ['other', other],
            ].map(([value, p]) => (
              <label
                key={value}
                className="flex min-h-tap cursor-pointer items-center gap-3 rounded-control border border-line-strong px-3 py-2 has-[:checked]:border-primary has-[:checked]:bg-info-bg"
              >
                <input
                  type="radio"
                  name="keep"
                  value={value}
                  checked={keep === value}
                  onChange={() => setKeep(value)}
                  className="size-4 accent-primary"
                />
                <PatientCell
                  name={p.name}
                  uhid={p.uhid}
                  age={p.age}
                  sex={p.gender}
                  className="flex-1"
                />
              </label>
            ))}
            <p className="text-sm text-muted">{t('patients.merge.keepHint')}</p>
          </fieldset>
        )}
        <FormField
          label={t('patients.merge.reason')}
          hint={t('patients.merge.reasonHint')}
          error={errors.reason}
          required
        >
          <Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
        </FormField>
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" loading={isLoading}>
            {t('patients.merge.submit')}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
