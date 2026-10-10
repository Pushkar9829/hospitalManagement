import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { FilePlus2 } from 'lucide-react';
import { billCreateInput } from '@hms/shared/schemas';
import { translateValidation } from '@hms/i18n';
import {
  Banner,
  Button,
  Card,
  EmptyState,
  FormField,
  Input,
  Loading,
  PatientBanner,
} from '@hms/ui';
import { ApiErrorNotice } from '../../../components/ApiErrorNotice.jsx';
import { useCan } from '../../../lib/useCan.js';
import { useUrlState } from '../../../lib/useUrlState.js';
import { PatientPicker } from '../../patients/components/PatientPicker.jsx';
import { bannerAllergies, patientFlags } from '../../patients/flags.js';
import { usePatient } from '../../patients/hooks.js';
import { usePricing } from '../usePricing.js';
import { useCreateBillMutation } from '../api.js';
import { estimate, priceListFor } from '../billing.js';
import { LinesEditor, TotalsList } from './LinesEditor.jsx';
import { ServicePicker } from './ServicePicker.jsx';

/**
 * New OPD or miscellaneous bill (design board "Billing", rule R1): pick the patient, add services
 * at the rate of the patient's price list, see GST (healthcare services are exempt) and the
 * rupee-rounded total, then save the draft. The draft opens to finalise and take payment.
 */
export function NewBillTab() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const can = useCan();
  const [patientId, setPatientId] = useUrlState('patient', '');
  const { data: patient, isFetching: loadingPatient } = usePatient(patientId);
  const [type, setType] = useState('OP');
  const [lines, setLines] = useState([]);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState(null);
  const [failure, setFailure] = useState(null);
  const [create, { isLoading }] = useCreateBillMutation();
  const { priceLists, taxRates } = usePricing();
  const list = priceListFor(patient?.category, priceLists);
  const totals = estimate(lines);
  const canCreate = can('billing:bill:create');

  const add = (line) =>
    setLines((ls) => {
      const i = ls.findIndex((l) => l.serviceId === line.serviceId);
      if (i < 0) return [...ls, line];
      return ls.map((l, j) => (j === i ? { ...l, qty: Math.min(999, l.qty + 1) } : l));
    });

  const save = async () => {
    setFailure(null);
    const parsed = billCreateInput.safeParse({
      patientId: patient?.id,
      type,
      lines: lines.map((l) => ({ serviceId: l.serviceId, qty: l.qty })),
      notes: notes.trim() || undefined,
    });
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      setError(
        issue.path[0] === 'patientId'
          ? t('billing.newBill.pickPatient')
          : translateValidation(t, issue.message),
      );
      return;
    }
    setError(null);
    try {
      const bill = await create(parsed.data).unwrap();
      navigate(`/billing/bills/${bill.id}`);
    } catch (err) {
      setFailure(err);
    }
  };

  if (!canCreate) return <Banner tone="info">{t('billing.newBill.readOnly')}</Banner>;

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_22rem]">
      <div className="flex min-w-0 flex-col gap-4">
        <Card title={t('billing.newBill.patient')} headingLevel={2}>
          {patientId && loadingPatient && !patient ? (
            <Loading rows={1} />
          ) : patient ? (
            <div className="flex flex-col gap-3">
              <PatientBanner
                name={patient.name.full}
                age={patient.age}
                sex={patient.gender}
                uhid={patient.uhid}
                allergies={bannerAllergies(patient)}
                noKnownAllergies={patient.noKnownAllergies}
                flags={patientFlags(patient, t)}
              />
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm text-muted">
                  {t('billing.newBill.priceList', {
                    list: list?.name ?? '-',
                    category: t(`patients.categories.${patient.category}`, {
                      defaultValue: patient.category,
                    }),
                  })}
                </p>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    setPatientId('');
                    setLines([]);
                  }}
                >
                  {t('billing.newBill.changePatient')}
                </Button>
              </div>
            </div>
          ) : (
            <PatientPicker
              label={t('billing.newBill.findPatient')}
              value={null}
              onChange={(p) => p && setPatientId(p.id)}
              autoFocus
            />
          )}
        </Card>
        <Card title={t('billing.newBill.services')} headingLevel={2}>
          <div className="flex flex-col gap-4">
            <fieldset className="flex flex-wrap gap-2">
              <legend className="mb-1.5 text-sm font-semibold text-ink">
                {t('billing.bill.type')}
              </legend>
              {['OP', 'MISC'].map((v) => (
                <label
                  key={v}
                  className="flex min-h-tap cursor-pointer items-center gap-2 rounded-control border border-line-strong px-3 has-[:checked]:border-primary has-[:checked]:bg-info-bg has-[:checked]:font-semibold"
                >
                  <input
                    type="radio"
                    name="bill-type"
                    value={v}
                    checked={type === v}
                    onChange={() => setType(v)}
                    className="size-4 accent-primary"
                  />
                  {t(`billing.types.${v}`)}
                </label>
              ))}
            </fieldset>
            <ServicePicker
              priceList={list}
              priceLists={priceLists}
              taxRates={taxRates}
              onAdd={add}
              disabled={!patient}
            />
            {lines.length ? (
              <LinesEditor lines={lines} onChange={setLines} />
            ) : (
              <EmptyState
                icon={FilePlus2}
                title={patient ? t('billing.newBill.noLines') : t('billing.newBill.patientFirst')}
              />
            )}
            <FormField label={t('billing.newBill.notes')} optional>
              <Input maxLength={300} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </FormField>
          </div>
        </Card>
      </div>
      <Card
        title={t('billing.newBill.summary')}
        headingLevel={2}
        className="self-start xl:sticky xl:top-4"
      >
        <div className="flex flex-col gap-4">
          <TotalsList totals={totals} estimate />
          <p className="text-sm text-muted">{t('billing.newBill.estimateHint')}</p>
          {error && (
            <p role="alert" className="text-sm text-critical">
              {error}
            </p>
          )}
          <ApiErrorNotice error={failure} />
          <Button size="lg" loading={isLoading} onClick={save} className="w-full">
            {t('billing.newBill.create')}
          </Button>
        </div>
      </Card>
    </div>
  );
}
