import { useId, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CircleCheck, Download, FileSpreadsheet, Upload } from 'lucide-react';
import { MASTERS } from '@hms/shared/schemas';
import {
  Banner,
  Button,
  Checkbox,
  Dialog,
  FormField,
  StatTile,
  Stepper,
  StatusBadge,
  Textarea,
} from '@hms/ui';
import { apiError } from '../../../app/apiError.js';
import { ApiErrorNotice } from '../../../components/ApiErrorNotice.jsx';
import { PendingApprovalNotice } from '../../../components/PendingApprovalNotice.jsx';
import { checkFile, useUpload } from '../../files/upload.js';
import { useDownloadTemplateMutation, useImportMasterMutation } from '../api.js';

const ROW_TONES = { NEW: 'success', UPDATE: 'info', ERROR: 'critical' };

function PreviewTable({ rows, onlyErrors }) {
  const { t } = useTranslation();
  const shown = onlyErrors ? rows.filter((r) => r.status === 'ERROR') : rows;
  return (
    <div className="max-h-80 overflow-auto rounded-card border border-line">
      <table className="w-full border-collapse text-left text-base">
        <caption className="sr-only">{t('import.previewCaption')}</caption>
        <thead>
          <tr className="bg-surface-2 text-sm text-muted">
            <th
              scope="col"
              className="sticky top-0 border-b border-line bg-surface-2 px-3 py-2 font-semibold"
            >
              {t('import.row')}
            </th>
            <th
              scope="col"
              className="sticky top-0 border-b border-line bg-surface-2 px-3 py-2 font-semibold"
            >
              {t('common.status')}
            </th>
            <th
              scope="col"
              className="sticky top-0 border-b border-line bg-surface-2 px-3 py-2 font-semibold"
            >
              {t('masters.fields.code')}
            </th>
            <th
              scope="col"
              className="sticky top-0 border-b border-line bg-surface-2 px-3 py-2 font-semibold"
            >
              {t('masters.fields.name')}
            </th>
            <th
              scope="col"
              className="sticky top-0 border-b border-line bg-surface-2 px-3 py-2 font-semibold"
            >
              {t('import.problems')}
            </th>
          </tr>
        </thead>
        <tbody>
          {shown.map((r) => (
            <tr key={r.row} className="border-b border-line align-top last:border-b-0">
              <td className="tabular px-3 py-2 text-muted">{r.row}</td>
              <td className="px-3 py-2">
                <StatusBadge tone={ROW_TONES[r.status]} label={t(`import.status.${r.status}`)} />
              </td>
              <td className="px-3 py-2 font-mono text-sm">{r.code ?? '-'}</td>
              <td className="px-3 py-2">{r.name ?? '-'}</td>
              <td className="px-3 py-2 text-sm text-critical">
                {r.errors?.length ? (
                  <ul className="flex flex-col gap-0.5">
                    {r.errors.map((e, i) => (
                      <li key={i}>
                        {e.path && <code className="font-mono">{e.path}</code>} {e.message}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <span className="text-muted">-</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Excel import (spec 5.2): download the template, upload the filled file, check the preview
 * (new, update and error rows), confirm with a reason, see the result. Nothing is saved until
 * the user confirms, and a sheet with errors is never saved. Service tariffs go for approval.
 */
export function ImportWizard({ type, open, onOpenChange }) {
  const { t } = useTranslation();
  const typeLabel = t(`masters.types.${type}`, { defaultValue: MASTERS[type].label });
  const [step, setStep] = useState(0);
  const [file, setFile] = useState(null); // { id, name }
  const [preview, setPreview] = useState(null);
  const [result, setResult] = useState(null);
  const [failure, setFailure] = useState(null);
  const [fileError, setFileError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [onlyErrors, setOnlyErrors] = useState(false);
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState(null);
  const inputRef = useRef(null);
  const inputId = useId();
  const upload = useUpload();
  const [importMaster] = useImportMasterMutation();
  const [downloadTemplate, { isLoading: downloading }] = useDownloadTemplateMutation();

  const steps = useMemo(
    () => [
      t('import.steps.template'),
      t('import.steps.upload'),
      t('import.steps.preview'),
      t('import.steps.confirm'),
      t('import.steps.result'),
    ],
    [t],
  );

  const getTemplate = async () => {
    setFailure(null);
    try {
      await downloadTemplate(type).unwrap();
    } catch (err) {
      setFailure(apiError(err));
    }
  };

  const pick = async (e) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    const bad = checkFile(f, 'master-import');
    if (bad) {
      setFileError(t(bad.key, bad.values));
      return;
    }
    setFileError(null);
    setFailure(null);
    setBusy(true);
    try {
      const id = await upload(f, 'master-import');
      const res = await importMaster({ type, fileId: id, commit: false }).unwrap();
      setFile({ id, name: f.name });
      setPreview(res);
      setOnlyErrors(res.summary.error > 0);
      setStep(2);
    } catch (err) {
      const ae = apiError(err);
      if (ae?.code === 'VALIDATION_FAILED' && ae.details.length)
        setFileError(ae.details.map((d) => d.message).join(' '));
      else setFailure(ae);
    } finally {
      setBusy(false);
    }
  };

  const commit = async () => {
    if (!reason.trim()) {
      setReasonError(t('states.confirmReasonError'));
      return;
    }
    setReasonError(null);
    setFailure(null);
    setBusy(true);
    try {
      const res = await importMaster({
        type,
        fileId: file.id,
        commit: true,
        reason: reason.trim(),
      }).unwrap();
      setResult(res);
      setStep(4);
    } catch (err) {
      setFailure(apiError(err));
    } finally {
      setBusy(false);
    }
  };

  const restart = () => {
    setFile(null);
    setPreview(null);
    setFailure(null);
    setStep(1);
  };

  const s = preview?.summary;
  const saveCount = s ? s.new + s.update : 0;

  let body;
  let footer;
  if (step === 0) {
    body = (
      <div className="flex flex-col gap-3">
        <p className="text-base text-ink">{t('import.templateBody', { type: typeLabel })}</p>
        <ul className="list-disc pl-5 text-sm text-muted">
          <li>{t('import.tipCodes')}</li>
          <li>{t('import.tipRupees')}</li>
          <li>{t('import.tipNothingSaved')}</li>
        </ul>
        <div>
          <Button
            variant="secondary"
            icon={<Download size={16} aria-hidden="true" />}
            loading={downloading}
            onClick={getTemplate}
          >
            {t('import.download')}
          </Button>
        </div>
      </div>
    );
    footer = <Button onClick={() => setStep(1)}>{t('import.haveFile')}</Button>;
  } else if (step === 1) {
    body = (
      <FormField
        label={t('import.file')}
        id={inputId}
        hint={t('import.fileHint')}
        error={fileError}
        required
      >
        <div className="flex flex-col items-center gap-3 rounded-card border border-dashed border-line-strong bg-surface-2 px-4 py-8 text-center">
          <FileSpreadsheet size={32} strokeWidth={1.5} aria-hidden="true" className="text-muted" />
          <input
            ref={inputRef}
            id={inputId}
            type="file"
            accept=".xlsx,.csv"
            className="sr-only"
            onChange={pick}
            disabled={busy}
          />
          <Button
            loading={busy}
            icon={<Upload size={16} aria-hidden="true" />}
            onClick={() => inputRef.current?.click()}
          >
            {busy ? t('import.checking') : t('import.chooseFile')}
          </Button>
        </div>
      </FormField>
    );
    footer = (
      <Button variant="secondary" onClick={() => setStep(0)}>
        {t('common.back')}
      </Button>
    );
  } else if (step === 2) {
    body = (
      <div className="flex flex-col gap-3">
        <p className="text-sm text-muted">{t('import.fromFile', { name: file?.name })}</p>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatTile label={t('import.rows')} value={s.rows} />
          <StatTile label={t('import.new')} value={s.new} />
          <StatTile label={t('import.update')} value={s.update} />
          <StatTile
            label={t('import.errors')}
            value={s.error}
            subTone={s.error ? 'critical' : 'neutral'}
            sub={s.error ? t('import.mustFix') : undefined}
          />
        </div>
        {s.error > 0 && (
          <Banner
            tone="critical"
            role="alert"
            title={t('import.hasErrorsTitle', { count: s.error })}
          >
            {t('import.hasErrorsBody')}
          </Banner>
        )}
        {s.rows === 0 && <Banner tone="warning">{t('import.emptyFile')}</Banner>}
        <Checkbox
          label={t('import.onlyErrors')}
          checked={onlyErrors}
          onChange={(e) => setOnlyErrors(e.target.checked)}
        />
        <PreviewTable rows={preview.rows} onlyErrors={onlyErrors} />
      </div>
    );
    footer = (
      <>
        <Button variant="secondary" onClick={restart}>
          {t('import.uploadAnother')}
        </Button>
        <Button onClick={() => setStep(3)} disabled={s.error > 0 || saveCount === 0}>
          {t('common.continue')}
        </Button>
      </>
    );
  } else if (step === 3) {
    body = (
      <form
        id="import-confirm"
        noValidate
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          commit();
        }}
      >
        <p className="text-base text-ink">
          {t('import.confirmBody', {
            count: saveCount,
            new: s.new,
            update: s.update,
            type: typeLabel,
          })}
        </p>
        {type === 'services' && <Banner tone="warning">{t('import.servicesApproval')}</Banner>}
        <FormField
          label={t('states.confirmReason')}
          hint={t('import.reasonHint')}
          error={reasonError}
          required
        >
          <Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
        </FormField>
      </form>
    );
    footer = (
      <>
        <Button variant="secondary" onClick={() => setStep(2)} disabled={busy}>
          {t('common.back')}
        </Button>
        <Button type="submit" form="import-confirm" loading={busy}>
          {t('import.save', { count: saveCount })}
        </Button>
      </>
    );
  } else {
    body = result?.approvalId ? (
      <PendingApprovalNotice approvalId={result.approvalId}>
        {t('import.sentForApproval', { count: saveCount })}{' '}
        {t('approvalNotice.body', { approver: t('approvalNotice.superAdmin') })}
      </PendingApprovalNotice>
    ) : (
      <div role="status" className="flex flex-col items-center gap-2 py-6 text-center">
        <CircleCheck size={36} aria-hidden="true" className="text-success" />
        <p className="text-md font-semibold text-ink">
          {t('import.done', { count: saveCount, type: typeLabel })}
        </p>
        <p className="text-sm text-muted">
          {t('import.doneBody', { new: s.new, update: s.update })}
        </p>
      </div>
    );
    footer = <Button onClick={() => onOpenChange(false)}>{t('common.close')}</Button>;
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      size="xl"
      title={t('import.title', { type: typeLabel })}
      footer={footer}
    >
      <div className="flex flex-col gap-4">
        <Stepper steps={steps} current={step} />
        <ApiErrorNotice error={failure} title={t('import.failed')} />
        {body}
      </div>
    </Dialog>
  );
}
