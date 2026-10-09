import { useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog } from '../primitives/Dialog.jsx';
import { Button } from '../primitives/Button.jsx';
import { FormField } from '../primitives/FormField.jsx';
import { Textarea } from '../primitives/Textarea.jsx';

function ConfirmBody({
  description,
  confirmLabel,
  cancelLabel,
  reasonLabel,
  reasonHint,
  requireReason,
  destructive,
  onConfirm,
  onOpenChange,
}) {
  const { t } = useTranslation();
  const [reason, setReason] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const ref = useRef(null);
  const formId = useId();

  const submit = async (e) => {
    e.preventDefault();
    const trimmed = reason.trim();
    if (requireReason && !trimmed) {
      setError(t('states.confirmReasonError'));
      ref.current?.focus();
      return;
    }
    setBusy(true);
    try {
      await onConfirm?.(trimmed);
      onOpenChange?.(false);
    } catch {
      // The caller shows the error (an ErrorState or toast); the dialog stays open with the reason.
    } finally {
      setBusy(false);
    }
  };

  return (
    <form id={formId} onSubmit={submit} noValidate className="flex flex-col gap-4">
      {description && <p className="text-base text-muted">{description}</p>}
      {requireReason !== null && (
        <FormField
          label={reasonLabel ?? t('states.confirmReason')}
          hint={reasonHint}
          error={error}
          required={requireReason}
        >
          <Textarea
            ref={ref}
            rows={3}
            value={reason}
            onChange={(e) => {
              setReason(e.target.value);
              if (error && e.target.value.trim()) setError(null);
            }}
          />
        </FormField>
      )}
      <div className="flex flex-wrap justify-end gap-2 pt-1">
        <Button variant="secondary" onClick={() => onOpenChange?.(false)} disabled={busy}>
          {cancelLabel ?? t('common.cancel')}
        </Button>
        <Button type="submit" variant={destructive ? 'danger' : 'primary'} loading={busy}>
          {confirmLabel}
        </Button>
      </div>
    </form>
  );
}

/**
 * Confirms a risky action. Name the object in the title ("Cancel bill OP/26-27/000155?"), make
 * the confirm button state the action ("Request cancellation", never "OK"). A reason is required
 * by default and goes to the audit log; pass `requireReason={false}` to make it optional or
 * `null` to hide it. `onConfirm(reason)` may return a promise: the button shows a spinner and the
 * dialog closes when it resolves.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel,
  reasonLabel,
  reasonHint,
  requireReason = true,
  destructive = true,
  onConfirm,
  trigger,
}) {
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      trigger={trigger}
      title={title}
      size="sm"
      role="alertdialog"
    >
      <ConfirmBody
        description={description}
        confirmLabel={confirmLabel}
        cancelLabel={cancelLabel}
        reasonLabel={reasonLabel}
        reasonHint={reasonHint}
        requireReason={requireReason}
        destructive={destructive}
        onConfirm={onConfirm}
        onOpenChange={onOpenChange}
      />
    </Dialog>
  );
}
