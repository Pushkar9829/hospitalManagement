import { useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { Printer } from 'lucide-react';
import { Banner, Button, Dialog, QrCode } from '@hms/ui';
import { selectSession } from '../../../../app/session.js';
import { fmtDate, fmtDateTime } from '../../../dx-kit/format.js';
import { useOpdDoctorsQuery } from '../../api.js';
import { ymdInstant } from '../../opd.js';

/** Morning – noon – night pattern for the print (1 – 0 – 1). */
const PATTERN = {
  OD: '1 – 0 – 0',
  OD_MORNING: '1 – 0 – 0',
  BD: '1 – 0 – 1',
  TDS: '1 – 1 – 1',
  QID: '1 – 1 – 1 – 1',
  HS: '0 – 0 – 1',
};

/**
 * The A5 prescription (board PrintRx): doctor and hospital header, patient, vitals, diagnosis,
 * medicines with the dosing pattern, investigations, advice, follow-up and the signature with a
 * QR to verify. Printed in the language chosen on the prescription (English or Hindi; Marathi
 * falls back to English until its strings land). The server renders the final PDF.
 */
export function RxPrintDialog({ open, onOpenChange, visit, consultation }) {
  const { t, i18n } = useTranslation();
  const lang = consultation.printLanguage === 'hi' ? 'hi' : 'en';
  const p = i18n.getFixedT(lang);
  const locale = lang === 'hi' ? 'hi-IN' : 'en-IN';
  const hospital = useSelector((s) => selectSession(s).data?.tenant?.name);
  const doctors = useOpdDoctorsQuery(undefined, { skip: !open });
  const doc = doctors.data?.items.find((d) => d.id === visit.doctor?.id) ?? visit.doctor ?? {};
  const v = visit.vitals;
  const signed = consultation.status === 'SIGNED';
  const vitals = [
    v?.bp && `${p('opd.print.bp')} ${v.bp}`,
    v?.pulse && `${p('opd.print.pulse')} ${v.pulse}`,
    v?.weightKg && `${p('opd.print.weight')} ${v.weightKg} kg`,
  ].filter(Boolean);
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={t('opd.print.title')}
      description={t('opd.print.hint')}
      size="lg"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            {t('opd.checkin.close')}
          </Button>
          <Button
            icon={<Printer size={16} aria-hidden="true" />}
            onClick={() => globalThis.print?.()}
          >
            {t('opd.print.print')}
          </Button>
        </div>
      }
    >
      {!signed && (
        <Banner tone="warning" className="mb-3" title={t('opd.print.draft')}>
          {t('opd.print.draftBody')}
        </Banner>
      )}
      <article
        lang={lang}
        aria-label={t('opd.print.title')}
        className="mx-auto flex w-full max-w-[148mm] flex-col gap-3 border border-line bg-surface px-6 py-5 text-sm text-ink shadow-card"
      >
        <header className="flex items-start justify-between gap-4 border-b-2 border-primary pb-3">
          <div>
            <p className="text-lg font-bold text-primary">{doc.name}</p>
            {doc.qualification && (
              <p>
                {doc.qualification}
                {doc.regNo && (
                  <>
                    {' · '}
                    {p('opd.print.reg')} <span className="font-mono">{doc.regNo}</span>
                  </>
                )}
              </p>
            )}
            <p className="text-muted">
              {[doc.designation, doc.room && p('opd.cal.room', { room: doc.room })]
                .filter(Boolean)
                .join(' · ')}
            </p>
          </div>
          <div className="text-right">
            <p className="font-semibold">{hospital}</p>
          </div>
        </header>
        <p className="flex flex-wrap justify-between gap-2">
          <span>
            <strong>{visit.patient.name}</strong> · {visit.patient.age} · {visit.patient.gender} ·{' '}
            <span className="font-mono">{visit.patient.uhid}</span>
          </span>
          <span>{fmtDate(signed ? consultation.signedAt : new Date(), locale)}</span>
        </p>
        {(vitals.length > 0 || visit.patient.allergies?.length > 0) && (
          <p>
            {vitals.join(' · ')}
            {visit.patient.allergies?.length > 0 && (
              <>
                {vitals.length ? ' · ' : ''}
                <strong>{p('opd.print.allergy')}</strong> {visit.patient.allergies.join(', ')}
              </>
            )}
          </p>
        )}
        {consultation.diagnoses?.length > 0 && (
          <p>
            <strong>{p('opd.print.diagnosis')}</strong>{' '}
            {consultation.diagnoses.map((d) => `${d.name} (${d.code})`).join(' · ')}
          </p>
        )}
        <p className="font-serif text-2xl font-bold text-primary italic" aria-hidden="true">
          Rx
        </p>
        <table className="w-full">
          <caption className="sr-only">{p('opd.print.medicines')}</caption>
          <tbody>
            {(consultation.rx ?? []).map((r, i) => (
              <tr key={r.id} className="border-b border-line align-top">
                <td className="py-1.5 pr-2">
                  <strong>
                    {i + 1}. {r.brand}
                  </strong>
                  <div className="text-muted">{r.generic}</div>
                </td>
                <td className="py-1.5 pr-2">
                  {PATTERN[r.frequency] ?? p(`opd.freq.${r.frequency}`)}
                  {r.instructions ? ` · ${r.instructions}` : ''}
                </td>
                <td className="py-1.5 text-right whitespace-nowrap">
                  {r.frequency === 'SOS' ? 'SOS' : p('opd.print.days', { n: r.days })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {consultation.orders?.length > 0 && (
          <p>
            <strong>{p('opd.print.investigations')}</strong>{' '}
            {consultation.orders.map((o) => o.name).join(', ')}
          </p>
        )}
        {consultation.advice && (
          <p>
            <strong>{p('opd.print.advice')}</strong> {consultation.advice}
          </p>
        )}
        {consultation.followUp?.date && (
          <p>
            <strong>{p('opd.print.followUp')}</strong>{' '}
            {fmtDate(ymdInstant(consultation.followUp.date), locale)}
          </p>
        )}
        <footer className="mt-2 flex items-end justify-between gap-4 border-t border-line pt-3">
          <QrCode
            value={`${globalThis.location?.origin ?? ''}/verify/rx/${visit.visitNo ?? visit.id}`}
            label={p('opd.print.verify')}
            size={72}
          />
          <div className="text-right">
            <p className="font-serif text-lg italic">{signed ? doc.name : '—'}</p>
            <p className="text-muted">
              {signed
                ? p('opd.print.signed', { at: fmtDateTime(consultation.signedAt, locale) })
                : p('opd.print.unsigned')}
            </p>
          </div>
        </footer>
      </article>
    </Dialog>
  );
}
