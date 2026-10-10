import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Download, Printer } from 'lucide-react';
import { Button, Dialog, FormField, Loading, Textarea } from '@hms/ui';
import { pdfName, usePdfFetch } from '../lib/pdf.js';
import { ApiErrorNotice } from './ApiErrorNotice.jsx';

/**
 * Print preview for a server PDF (bill A4, receipt 80 mm, platform invoice): the PDF is fetched
 * with the session and shown in a frame with Print and Download. Documents the API counts
 * (rule R18: the first print is the original) ask for a reprint reason when `reprint` is set;
 * the copy then carries a DUPLICATE watermark. `onPrinted` runs after a successful fetch.
 */
export function PdfPreviewDialog({ open, onOpenChange, url, title, number, reprint, onPrinted }) {
  const { t } = useTranslation();
  const fetchPdf = usePdfFetch();
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState(null);
  const [state, setState] = useState({ status: reprint ? 'reason' : 'idle' });
  const frame = useRef(null);
  const started = useRef(false);

  const load = async (why) => {
    setState({ status: 'loading' });
    const res = await fetchPdf(url, why ? { reason: why } : undefined);
    if (res.error) return setState({ status: 'error', error: res.error });
    setState({ status: 'ready', src: URL.createObjectURL(res.blob) });
    onPrinted?.();
  };

  useEffect(() => {
    if (!open || reprint || started.current) return;
    started.current = true;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, reprint]);

  useEffect(
    () => () => {
      if (state.src) URL.revokeObjectURL(state.src);
    },
    [state.src],
  );

  const submitReason = (e) => {
    e.preventDefault();
    if (reason.trim().length < 3) {
      setReasonError(t('pdf.reasonError'));
      return;
    }
    load(reason.trim());
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      size="xl"
      footer={
        state.status === 'ready' && (
          <>
            <a
              href={state.src}
              download={pdfName(number)}
              className="inline-flex min-h-tap items-center gap-2 rounded-control border border-line-strong bg-surface px-4 font-semibold text-ink hover:bg-surface-2"
            >
              <Download size={16} aria-hidden="true" />
              {t('pdf.download')}
            </a>
            <Button
              icon={<Printer size={16} aria-hidden="true" />}
              onClick={() => frame.current?.contentWindow?.print()}
            >
              {t('pdf.print')}
            </Button>
          </>
        )
      }
    >
      {state.status === 'reason' && (
        <form onSubmit={submitReason} noValidate className="flex flex-col gap-4">
          <p className="text-base text-muted">{t('pdf.reprintBody')}</p>
          <FormField label={t('pdf.reason')} error={reasonError} required>
            <Textarea
              rows={2}
              value={reason}
              onChange={(e) => {
                setReason(e.target.value);
                setReasonError(null);
              }}
            />
          </FormField>
          <div className="flex justify-end">
            <Button type="submit">{t('pdf.reprint')}</Button>
          </div>
        </form>
      )}
      {(state.status === 'loading' || state.status === 'idle') && (
        <Loading rows={4} label={t('pdf.loading')} />
      )}
      {state.status === 'error' && <ApiErrorNotice error={state.error} title={t('pdf.failed')} />}
      {state.status === 'ready' && (
        <iframe
          ref={frame}
          src={state.src}
          title={title}
          className="h-[70dvh] w-full rounded-control border border-line bg-surface-2"
        />
      )}
    </Dialog>
  );
}
