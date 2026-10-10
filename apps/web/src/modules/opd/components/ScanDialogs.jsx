import { useState } from 'react';
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { Button, Dialog, FormField, Input, StatusBadge } from '@hms/ui';
import { QueryView } from '../../dx-kit/QueryView.jsx';
import { fmtTime, localeOf } from '../../dx-kit/format.js';
import { useScanShareQuery } from '../../patients/api.js';

/**
 * QR pass at the desk: the scanner types the booking number into the focused field and presses
 * Enter, so this is a plain form; `onFound(text)` searches the arrivals for it.
 */
export function ScanQrDialog({ open, onOpenChange, onFound }) {
  const { t } = useTranslation();
  const [code, setCode] = useState('');
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={t('opd.checkin.scanTitle')}
      description={t('opd.checkin.scanHint')}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            {t('opd.checkin.close')}
          </Button>
          <Button type="submit" form="opd-scan-qr" disabled={!code.trim()}>
            {t('opd.checkin.find')}
          </Button>
        </div>
      }
    >
      <form
        id="opd-scan-qr"
        onSubmit={(e) => {
          e.preventDefault();
          onFound(code.trim());
          setCode('');
          onOpenChange(false);
        }}
      >
        <FormField label={t('opd.checkin.qrCode')}>
          <Input
            mono
            autoFocus
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="AP/26-27/000401"
          />
        </FormField>
      </form>
    </Dialog>
  );
}

const MATCH_TONE = { NEW: 'info', LINKED: 'success', REVIEW: 'warning' };

/** ABHA Scan and Share arrivals today (ABDM): link to a booking, or register a new patient. */
export function AbhaDialog({ open, onOpenChange, onFound }) {
  const { t, i18n } = useTranslation();
  const query = useScanShareQuery({ limit: 10 }, { skip: !open });
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={t('opd.checkin.abhaTitle')}
      description={t('opd.checkin.abhaHint')}
      size="lg"
    >
      <QueryView query={query} empty={t('opd.checkin.abhaEmpty')} isEmpty={(d) => !d.items.length}>
        {(data) => (
          <ul className="flex flex-col divide-y divide-line rounded-control border border-line">
            {data.items.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center gap-3 px-3 py-2.5">
                <span className="font-mono text-sm text-muted">
                  {fmtTime(s.at, localeOf(i18n))}
                </span>
                <span className="min-w-0 flex-1">
                  <strong className="block font-semibold text-ink">{s.name}</strong>
                  <span className="block font-mono text-sm text-muted">
                    {s.abhaAddress} · {s.age} · {s.gender}
                  </span>
                </span>
                <StatusBadge
                  tone={MATCH_TONE[s.match] ?? 'neutral'}
                  label={t(`opd.checkin.abhaMatch.${s.match}`)}
                />
                {s.match === 'NEW' ? (
                  <Link
                    to="/patients/new"
                    className="text-sm font-semibold text-info underline underline-offset-2"
                  >
                    {t('opd.checkin.register')}
                  </Link>
                ) : (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      onFound(s.name);
                      onOpenChange(false);
                    }}
                  >
                    {t('opd.checkin.findBooking')}
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </QueryView>
    </Dialog>
  );
}
