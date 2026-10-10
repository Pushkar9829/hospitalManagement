import { useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ExternalLink, Upload, X } from 'lucide-react';
import { Button, FormField, useToast } from '@hms/ui';
import { apiError } from '../../app/apiError.js';
import { useDownloadUrlMutation } from './api.js';
import { PURPOSES, checkFile, useUpload } from './upload.js';

/**
 * A file picked, checked and uploaded straight away; the form keeps only the file id
 * (`value` / `onChange`). Shows the current file with a "View" link that asks for a
 * 5-minute download link.
 */
export function FileField({ label, purpose, value, onChange, hint, disabled = false }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const upload = useUpload();
  const [download, { isLoading: opening }] = useDownloadUrlMutation();
  const inputRef = useRef(null);
  const inputId = useId();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [name, setName] = useState(null);
  const rule = PURPOSES[purpose];

  const pick = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const bad = checkFile(file, purpose);
    if (bad) {
      setError(t(bad.key, bad.values));
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const id = await upload(file, purpose);
      setName(file.name);
      onChange?.(id);
    } catch (err) {
      const ae = apiError(err);
      setError(ae?.details?.[0]?.message ?? ae?.message ?? t('upload.failed'));
    } finally {
      setBusy(false);
    }
  };

  const view = async () => {
    try {
      const res = await download(value).unwrap();
      window.open(res.url, '_blank', 'noopener');
    } catch {
      toast({ title: t('upload.openFailed'), tone: 'critical' });
    }
  };

  return (
    <FormField
      label={label}
      id={inputId}
      hint={hint ?? t('upload.hint', { types: rule.ext.join(', '), mb: rule.maxMb })}
      error={error}
      optional
    >
      <div className="flex flex-wrap items-center gap-2 rounded-control border border-dashed border-line-strong bg-surface-2 p-3">
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          className="sr-only"
          accept={rule.ext.map((x) => `.${x}`).join(',')}
          onChange={pick}
          disabled={disabled || busy}
        />
        <Button
          size="sm"
          variant="secondary"
          loading={busy}
          disabled={disabled}
          icon={<Upload size={14} aria-hidden="true" />}
          onClick={() => inputRef.current?.click()}
        >
          {value ? t('upload.replace') : t('upload.choose')}
        </Button>
        {value ? (
          <>
            <span className="min-w-0 truncate text-sm text-ink">{name ?? t('upload.saved')}</span>
            <Button
              size="sm"
              variant="ghost"
              loading={opening}
              icon={<ExternalLink size={14} aria-hidden="true" />}
              onClick={view}
            >
              {t('upload.view')}
            </Button>
            {!disabled && (
              <Button
                size="sm"
                variant="ghost"
                icon={<X size={14} aria-hidden="true" />}
                onClick={() => {
                  setName(null);
                  onChange?.(undefined);
                }}
              >
                {t('upload.remove')}
              </Button>
            )}
          </>
        ) : (
          <span className="text-sm text-muted">{t('upload.none')}</span>
        )}
      </div>
    </FormField>
  );
}
