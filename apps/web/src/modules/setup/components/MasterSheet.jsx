import { useEffect, useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { MASTERS } from '@hms/shared/schemas';
import { translateValidation } from '@hms/i18n';
import { Button, Checkbox, FormField, Input, Select, Sheet } from '@hms/ui';
import { applyFieldErrors } from '../../../lib/forms.js';
import { useCan } from '../../../lib/useCan.js';
import { ApiErrorNotice } from '../../../components/ApiErrorNotice.jsx';
import { CheckboxList } from '../../../components/CheckboxList.jsx';
import { useBranchesQuery, useSaveMasterMutation } from '../api.js';
import { cleanResolver, masterFields, toDateInput, useMasterLabels } from '../masters.js';

/** Record → form values for the generated fields. */
function toForm(fields, record, branchCodeById) {
  const out = {};
  for (const f of fields) {
    const v = record?.[f.name];
    if (f.kind === 'boolean') out[f.name] = v ?? f.defaultValue ?? false;
    else if (f.kind === 'date') out[f.name] = toDateInput(v);
    else if (f.kind === 'list')
      out[f.name] = record?.branchIds?.map((id) => branchCodeById.get(id)).filter(Boolean) ?? [];
    else if (f.kind === 'enum') out[f.name] = v ?? f.options[0];
    else
      out[f.name] =
        v ?? (f.kind === 'number' && f.defaultValue != null ? String(f.defaultValue) : '');
  }
  return out;
}

/**
 * Add or edit a master record with a form generated from the master's shared zod schema:
 * text, number, date, yes/no, choice and (holidays) branch fields. The code cannot change after
 * it is created.
 */
export function MasterSheet({ type, record, open, onOpenChange, onDone, onReload }) {
  const { t } = useTranslation();
  const can = useCan();
  const canWrite = record ? can('settings:master:update') : can('settings:master:create');
  const fields = useMemo(() => masterFields(type), [type]);
  const labels = useMasterLabels(type);
  const { data: branches = [] } = useBranchesQuery(undefined, { skip: type !== 'holidays' });
  const branchCodeById = useMemo(() => new Map(branches.map((b) => [b.id, b.code])), [branches]);
  const [save] = useSaveMasterMutation();
  const [failure, setFailure] = useState(null);
  const {
    register,
    control,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: cleanResolver(MASTERS[type].input),
    defaultValues: toForm(fields, record, branchCodeById),
  });

  useEffect(() => {
    reset(toForm(fields, record, branchCodeById), { keepDirtyValues: true });
  }, [fields, record, branchCodeById, reset]);

  const onSubmit = async (values) => {
    setFailure(null);
    try {
      const res = await save(
        record ? { type, id: record.id, ...values, version: record.version } : { type, ...values },
      ).unwrap();
      onDone({ name: values.name, approvalId: res?.approvalId ?? null, created: !record });
      onOpenChange(false);
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
  const msg = (e) => translateValidation(t, e?.message);
  const formId = `master-form-${type}`;
  const typeLabel = t(`masters.types.${type}`, { defaultValue: MASTERS[type].label });

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={
        record
          ? t('masters.editTitle', { name: record.name })
          : t('masters.addTitle', { type: typeLabel })
      }
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          {canWrite && (
            <Button type="submit" form={formId} loading={isSubmitting}>
              {record ? t('common.save') : t('masters.add')}
            </Button>
          )}
        </>
      }
    >
      <form
        id={formId}
        onSubmit={handleSubmit(onSubmit)}
        noValidate
        className="flex flex-col gap-4"
      >
        <ApiErrorNotice
          error={failure}
          onReload={async () => {
            setFailure(null);
            await onReload();
          }}
        />
        <fieldset disabled={!canWrite} className="flex min-w-0 flex-col gap-4">
          {fields.map((f) => {
            const label = labels.field(f.name);
            const error = msg(errors[f.name]);
            if (f.kind === 'boolean')
              return <Checkbox key={f.name} label={label} {...register(f.name)} />;
            if (f.kind === 'list')
              return (
                <Controller
                  key={f.name}
                  control={control}
                  name={f.name}
                  render={({ field }) => (
                    <CheckboxList
                      legend={label}
                      hint={t('masters.branchesHint')}
                      error={error}
                      value={field.value ?? []}
                      onChange={field.onChange}
                      options={branches.map((b) => ({
                        value: b.code,
                        label: `${b.name} (${b.code})`,
                      }))}
                    />
                  )}
                />
              );
            return (
              <FormField
                key={f.name}
                label={label}
                error={error}
                required={f.required}
                optional={!f.required}
                hint={
                  f.name === 'code'
                    ? record
                      ? t('masters.codeLocked')
                      : t('masters.codeHint')
                    : undefined
                }
              >
                {f.kind === 'enum' ? (
                  <Select
                    options={f.options.map((o) => ({ value: o, label: labels.option(o) }))}
                    {...register(f.name)}
                  />
                ) : (
                  <Input
                    type={f.kind === 'date' ? 'date' : 'text'}
                    inputMode={f.kind === 'number' ? 'decimal' : undefined}
                    mono={f.name === 'code' || f.kind === 'number'}
                    className={f.name === 'code' ? 'uppercase' : undefined}
                    readOnly={f.name === 'code' && Boolean(record)}
                    {...register(f.name)}
                  />
                )}
              </FormField>
            );
          })}
        </fieldset>
      </form>
    </Sheet>
  );
}
