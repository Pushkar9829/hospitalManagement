import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { addPatientsStrings } from '@hms/i18n/patients';
import { addDxkitStrings } from '@hms/i18n/dxkit';
import { Button, Checkbox, Dialog, FormField, Input, Select, Textarea, cn } from '@hms/ui';
import { ApiErrorNotice } from '../../components/ApiErrorNotice.jsx';
import { applyFieldErrors, cleanResolver } from '../../lib/forms.js';
import { useStrings } from '../../lib/useStrings.js';
import { PatientPicker } from '../patients/components/PatientPicker.jsx';

/**
 * A form in a dialog, described by its fields (React Hook Form + Zod): validated on blur and on
 * submit, errors under the fields, server field errors (422) placed under their fields, other
 * failures in a notice at the top. `onSubmit(values)` returns the API result; on success the
 * dialog closes and `onDone(result, values)` runs (the caller shows the toast or the 202 notice).
 *
 * fields: [{ name, label, type: text|number|date|time|select|textarea|checkbox|patient,
 *            options, hint, required, optional, span: 2, mono, placeholder, rows, onChange }]
 * `children(form)` renders extra content under the fields (line editors, summaries).
 */
export function FormDialog({
  open,
  onOpenChange,
  title,
  description,
  fields,
  schema,
  defaultValues,
  submitLabel,
  onSubmit,
  onDone,
  size = 'md',
  destructive = false,
  children,
  intro,
}) {
  useStrings(addPatientsStrings, addDxkitStrings);
  const { t } = useTranslation();
  const [failure, setFailure] = useState(null);
  const form = useForm({
    resolver: cleanResolver(schema),
    defaultValues,
    mode: 'onBlur',
  });
  const {
    register,
    control,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = form;

  useEffect(() => {
    // A previous error is cleared when the dialog closes (see onOpenChange below).
    if (open) reset(defaultValues);
    // Reset only when the dialog opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const close = (next) => {
    if (!next) setFailure(null);
    onOpenChange(next);
  };

  const submit = async (values) => {
    setFailure(null);
    try {
      const result = await onSubmit(values);
      close(false);
      onDone?.(result, values);
    } catch (err) {
      setFailure(
        applyFieldErrors(
          err,
          setError,
          fields.map((f) => f.name),
        ),
      );
    }
  };

  const errorOf = (name) => {
    const e = name.split('.').reduce((a, k) => a?.[k], errors);
    return e?.message ? String(e.message) : undefined;
  };
  const formId = `dx-form-${title.replace(/\W+/g, '-').toLowerCase()}`;
  // A field's own onChange(value) lets the caller update dependent options (e.g. free slots).
  const fieldOpts = (f) =>
    f.onChange ? { onChange: (e) => f.onChange(e.target.value) } : undefined;

  return (
    <Dialog
      open={open}
      onOpenChange={close}
      title={title}
      description={description}
      size={size}
      footer={
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="secondary" onClick={() => close(false)}>
            {t('common.cancel')}
          </Button>
          <Button
            type="submit"
            form={formId}
            loading={isSubmitting}
            variant={destructive ? 'danger' : 'primary'}
          >
            {submitLabel}
          </Button>
        </div>
      }
    >
      <form id={formId} onSubmit={handleSubmit(submit)} noValidate className="flex flex-col gap-4">
        <ApiErrorNotice error={failure} />
        {intro}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {fields.map((f) => {
            const span = f.span === 2 || f.type === 'textarea' || f.type === 'patient';
            const cls = cn(span && 'sm:col-span-2');
            if (f.type === 'patient')
              return (
                <div key={f.name} className={cls}>
                  <Controller
                    control={control}
                    name={f.name}
                    render={({ field }) => (
                      <PatientPicker
                        label={f.label}
                        value={field.value ?? null}
                        onChange={(p) => field.onChange(p)}
                        error={errorOf(f.name)}
                        hint={f.hint}
                      />
                    )}
                  />
                </div>
              );
            if (f.type === 'checkbox')
              return (
                <div key={f.name} className={cls}>
                  <Checkbox label={f.label} description={f.hint} {...register(f.name)} />
                  {errorOf(f.name) && (
                    <p className="text-sm text-critical" role="alert">
                      {errorOf(f.name)}
                    </p>
                  )}
                </div>
              );
            return (
              <FormField
                key={f.name}
                label={f.label}
                hint={f.hint}
                error={errorOf(f.name)}
                required={f.required}
                optional={f.optional}
                className={cls}
              >
                {f.type === 'select' ? (
                  <Select
                    {...register(f.name, fieldOpts(f))}
                    options={f.options}
                    placeholder={f.placeholder ?? t('dxkit.choose')}
                  />
                ) : f.type === 'textarea' ? (
                  <Textarea
                    {...register(f.name, fieldOpts(f))}
                    rows={f.rows ?? 3}
                    placeholder={f.placeholder}
                  />
                ) : (
                  <Input
                    {...register(f.name, fieldOpts(f))}
                    type={f.type === 'number' ? 'text' : (f.type ?? 'text')}
                    inputMode={f.type === 'number' ? 'decimal' : undefined}
                    mono={f.mono}
                    placeholder={f.placeholder}
                    autoComplete="off"
                  />
                )}
              </FormField>
            );
          })}
        </div>
        {children?.(form)}
      </form>
    </Dialog>
  );
}
