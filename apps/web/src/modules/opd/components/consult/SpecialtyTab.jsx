import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Banner, Button, Dialog, FormField, Input, Select, Textarea, cn, useToast } from '@hms/ui';
import { ApiErrorNotice } from '../../../../components/ApiErrorNotice.jsx';
import { fmtDate, fmtDateTime, localeOf } from '../../../dx-kit/format.js';
import { useIssueCertificateMutation } from '../../api.js';
import { addDaysYmd, todayIST, ymdInstant } from '../../opd.js';

/** Fields each specialty form adds to the consultation (stored in `specialtyData`). */
const SPECIALTIES = {
  DENTAL: ['teeth', 'findings', 'plan'],
  OPHTHAL: ['acuityRight', 'acuityLeft', 'iopRight', 'iopLeft', 'refraction'],
  ANTENATAL: ['lmp', 'gravida', 'fundalHeight', 'fetalHeart'],
  PAEDIATRICS: ['weightKg', 'heightCm', 'headCm', 'vaccinesDue'],
  DERMATOLOGY: ['site', 'lesion', 'photos'],
  PHYSIOTHERAPY: ['sessions', 'goals', 'progress'],
};
const DATE_FIELDS = new Set(['lmp']);

/** Expected date of delivery: LMP + 280 days (Naegele's rule). */
function eddOf(lmp) {
  return lmp ? addDaysYmd(lmp, 280) : '';
}

/**
 * Specialty templates switch the form for dental, eye, pregnancy care, child growth and
 * vaccination, skin and physiotherapy. The chosen form's fields are saved with the draft.
 */
export function SpecialtyTab({ draft, change, readOnly }) {
  const { t, i18n } = useTranslation();
  const current = draft.specialty;
  const data = draft.specialtyData ?? {};
  const set = (k, v) => change({ specialtyData: { ...data, [k]: v } });
  return (
    <div className="flex flex-col gap-4">
      <p className="text-base text-muted">{t('opd.spec.intro')}</p>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        {Object.keys(SPECIALTIES).map((s) => (
          <button
            key={s}
            type="button"
            aria-pressed={current === s}
            disabled={readOnly}
            onClick={() => change({ specialty: current === s ? null : s })}
            className={cn(
              'flex cursor-pointer flex-col items-start gap-1 rounded-card border-2 px-4 py-3 text-left',
              current === s ? 'border-primary bg-info-bg' : 'border-line bg-surface hover:bg-surface-2',
            )}
          >
            <strong className="text-base text-ink">{t(`opd.spec.names.${s}`)}</strong>
            <span className="text-sm text-muted">{t(`opd.spec.desc.${s}`)}</span>
          </button>
        ))}
      </div>
      {current && (
        <fieldset className="flex flex-col gap-3 rounded-card border border-line p-4">
          <legend className="px-1 text-md font-semibold">{t(`opd.spec.names.${current}`)}</legend>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {SPECIALTIES[current].map((f) => (
              <FormField key={f} label={t(`opd.spec.fields.${f}`)}>
                <Input
                  type={DATE_FIELDS.has(f) ? 'date' : 'text'}
                  value={data[f] ?? ''}
                  readOnly={readOnly}
                  onChange={(e) => set(f, e.target.value)}
                />
              </FormField>
            ))}
            {current === 'ANTENATAL' && data.lmp && (
              <p className="text-base md:col-span-2" aria-live="polite">
                {t('opd.spec.edd', { date: fmtDate(ymdInstant(eddOf(data.lmp)), localeOf(i18n)) })}
              </p>
            )}
          </div>
        </fieldset>
      )}
    </div>
  );
}

const CERT_TYPES = ['SICK_LEAVE', 'FITNESS', 'MEDICAL'];

/** Certificates: sick leave, fitness or medical, previewed, then signed and numbered. */
export function CertificatesTab({ visit, consultation, readOnly }) {
  const { t, i18n } = useTranslation();
  const { toast } = useToast();
  const [issue, { isLoading }] = useIssueCertificateMutation();
  const [form, setForm] = useState({
    type: 'SICK_LEAVE',
    from: todayIST(),
    to: addDaysYmd(todayIST(), 2),
    remarks: '',
  });
  const [preview, setPreview] = useState(false);
  const [failure, setFailure] = useState(null);
  const issued = consultation?.certificate;
  const locale = localeOf(i18n);
  const days =
    form.from && form.to
      ? Math.round((ymdInstant(form.to) - ymdInstant(form.from)) / 86_400_000) + 1
      : 0;
  const valid = form.type !== 'SICK_LEAVE' || (days >= 1 && form.to >= form.from);
  const body = t(`opd.cert.body.${form.type}`, {
    name: visit.patient.name,
    days,
    from: fmtDate(ymdInstant(form.from), locale),
    to: fmtDate(ymdInstant(form.to), locale),
    diagnosis: (consultation?.diagnoses ?? []).map((d) => d.name).join(', ') || '-',
  });
  return (
    <div className="flex flex-col gap-4">
      {issued && (
        <Banner tone="success" title={t('opd.cert.issued', { no: issued.no })}>
          {t('opd.cert.issuedBody', {
            type: t(`opd.cert.types.${issued.type}`),
            by: issued.signedBy,
            at: fmtDateTime(issued.signedAt, locale),
          })}
        </Banner>
      )}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <FormField label={t('opd.cert.type')}>
          <Select
            value={form.type}
            disabled={readOnly}
            onChange={(e) => setForm({ ...form, type: e.target.value })}
            options={CERT_TYPES.map((c) => ({ value: c, label: t(`opd.cert.types.${c}`) }))}
          />
        </FormField>
        <FormField label={t('opd.cert.from')}>
          <Input
            type="date"
            value={form.from}
            readOnly={readOnly}
            onChange={(e) => setForm({ ...form, from: e.target.value })}
          />
        </FormField>
        <FormField
          label={t('opd.cert.to')}
          error={valid ? undefined : t('opd.block.errors.order')}
          hint={form.type === 'SICK_LEAVE' && valid ? t('opd.cert.days', { days }) : undefined}
        >
          <Input
            type="date"
            value={form.to}
            readOnly={readOnly}
            onChange={(e) => setForm({ ...form, to: e.target.value })}
          />
        </FormField>
      </div>
      <FormField label={t('opd.cert.remarks')} optional>
        <Textarea
          rows={2}
          value={form.remarks}
          readOnly={readOnly}
          onChange={(e) => setForm({ ...form, remarks: e.target.value })}
        />
      </FormField>
      <Button
        className="self-start"
        disabled={!valid || readOnly}
        onClick={() => {
          setFailure(null);
          setPreview(true);
        }}
      >
        {t('opd.cert.preview')}
      </Button>
      <Dialog
        open={preview}
        onOpenChange={setPreview}
        title={t(`opd.cert.types.${form.type}`)}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setPreview(false)}>
              {t('opd.cert.edit')}
            </Button>
            <Button
              loading={isLoading}
              onClick={async () => {
                try {
                  const r = await issue({ id: visit.id, ...form, days, text: body }).unwrap();
                  setPreview(false);
                  toast({ tone: 'success', title: t('opd.cert.issued', { no: r.no }) });
                } catch (e) {
                  setFailure(e);
                }
              }}
            >
              {t('opd.cert.sign')}
            </Button>
          </div>
        }
      >
        <ApiErrorNotice error={failure} />
        <article className="flex flex-col gap-3 rounded-control border border-line bg-surface px-5 py-4 text-base">
          <p className="text-sm text-muted">
            {visit.doctor?.name} · {fmtDate(new Date(), locale)}
          </p>
          <p>{body}</p>
          {form.remarks && <p>{form.remarks}</p>}
          <p className="text-sm text-muted">
            {visit.patient.name} · <span className="font-mono">{visit.patient.uhid}</span>
          </p>
        </article>
      </Dialog>
    </div>
  );
}
