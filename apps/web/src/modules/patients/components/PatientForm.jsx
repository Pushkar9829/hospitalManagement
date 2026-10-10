import { Controller, useFieldArray, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Plus, X } from 'lucide-react';
import { BLOOD_GROUPS, GENDERS, LANGUAGES, RELATIONS, TITLES } from '@hms/shared';
import { ALLERGY_SEVERITY, ID_TYPES, PATIENT_CATEGORIES } from '@hms/shared/schemas';
import { translateValidation } from '@hms/i18n';
import {
  Button,
  Checkbox,
  FormField,
  IconButton,
  Input,
  Select,
  StatusBadge,
  Textarea,
  cn,
  formatLongDate,
} from '@hms/ui';
import { FileField } from '../../files/FileField.jsx';
import { ageFacts, formDob } from '../patientForm.js';
import { AadhaarInput } from './AadhaarInput.jsx';

const MARITAL = ['SINGLE', 'MARRIED', 'WIDOWED', 'DIVORCED', 'UNKNOWN'];

function Section({ title, children, className }) {
  return (
    <fieldset
      className={cn(
        'grid min-w-0 grid-cols-1 gap-4 rounded-card border border-line bg-surface p-4 sm:grid-cols-2 lg:grid-cols-4',
        className,
      )}
    >
      <legend className="px-1 text-md font-semibold text-ink">{title}</legend>
      {children}
    </fieldset>
  );
}

/** Radio buttons in a fieldset, as large tap targets (gender, age or date of birth). */
function RadioRow({ legend, name, options, register, error, required, className }) {
  const { t } = useTranslation();
  return (
    <fieldset
      className={cn('flex min-w-0 flex-col gap-1.5', className)}
      aria-invalid={error ? true : undefined}
    >
      <legend className="mb-1.5 text-sm font-semibold text-ink">
        {legend}
        {required && (
          <span className="text-critical" aria-hidden="true">
            {' '}
            *
          </span>
        )}
        {required && <span className="sr-only"> ({t('common.required')})</span>}
      </legend>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <label
            key={o.value}
            className="flex min-h-tap cursor-pointer items-center gap-2 rounded-control border border-line-strong bg-surface px-3 has-[:checked]:border-primary has-[:checked]:bg-info-bg has-[:checked]:font-semibold"
          >
            <input
              type="radio"
              value={o.value}
              className="size-4 accent-primary"
              {...register(name)}
            />
            <span className="text-base text-ink">{o.label}</span>
          </label>
        ))}
      </div>
      {error && (
        <p role="alert" className="text-sm text-critical">
          {error}
        </p>
      )}
    </fieldset>
  );
}

/**
 * Patient registration and edit form (design board "Patients", spec 5.4). Quick registration
 * asks only name, gender, age and mobile; full registration adds contact, address, relation,
 * guardian (required under 18), IDs with Aadhaar masked after entry, ABHA, allergies, blood
 * group, category and flags. `form` is the react-hook-form instance; the page submits it.
 */
export function PatientForm({ form, canUpload = false }) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'hi' ? 'hi-IN' : 'en-IN';
  const {
    register,
    control,
    formState: { errors },
  } = form;
  const values = useWatch({ control });
  const quick = values.registrationType === 'QUICK';
  const dob = formDob(values);
  const facts = ageFacts(dob);
  const ids = useFieldArray({ control, name: 'ids' });
  const allergies = useFieldArray({ control, name: 'allergies' });
  const msg = (e) => translateValidation(t, e?.message);
  const option = (group) => (v) => ({ value: v, label: t(`patients.${group}.${v}`) });

  const identity = (
    <Section title={t('patients.form.identity')}>
      {!quick && (
        <FormField label={t('patients.form.title')} optional>
          <Select
            placeholder={t('patients.form.none')}
            options={TITLES.map((v) => ({ value: v, label: t(`patients.titles.${v}`) }))}
            {...register('name.title')}
          />
        </FormField>
      )}
      <FormField label={t('patients.form.firstName')} error={msg(errors.name?.first)} required>
        <Input autoComplete="off" {...register('name.first')} />
      </FormField>
      {!quick && (
        <FormField label={t('patients.form.middleName')} optional>
          <Input autoComplete="off" {...register('name.middle')} />
        </FormField>
      )}
      <FormField label={t('patients.form.lastName')} optional>
        <Input autoComplete="off" {...register('name.last')} />
      </FormField>
      {!quick && (
        <FormField
          label={t('patients.form.regionalName')}
          hint={t('patients.form.regionalHint')}
          optional
          className="sm:col-span-2"
        >
          <Input lang="hi" autoComplete="off" {...register('name.regional')} />
        </FormField>
      )}
      <RadioRow
        className="sm:col-span-2"
        legend={t('patients.form.gender')}
        name="gender"
        register={register}
        required
        error={errors.gender && t('patients.form.genderError')}
        options={Object.keys(GENDERS).map((g) => ({ value: g, label: t(`patient.sex.${g}`) }))}
      />
      <div className="flex min-w-0 flex-col gap-3 sm:col-span-2">
        <RadioRow
          legend={t('patients.form.birth')}
          name="birthMode"
          register={register}
          required
          options={[
            { value: 'age', label: t('patients.form.byAge') },
            { value: 'dob', label: t('patients.form.byDob') },
          ]}
        />
        {values.birthMode === 'dob' ? (
          <FormField label={t('patients.form.dob')} error={msg(errors.birth)} required>
            <Input type="date" max={new Date().toISOString().slice(0, 10)} {...register('dob')} />
          </FormField>
        ) : (
          <fieldset className="flex flex-col gap-1.5" aria-describedby="age-hint">
            <legend className="mb-1.5 text-sm font-semibold text-ink">
              {t('patients.form.age')}
              <span className="text-critical" aria-hidden="true">
                {' '}
                *
              </span>
            </legend>
            <div className="grid grid-cols-3 gap-2">
              {['years', 'months', 'days'].map((u) => (
                <FormField key={u} label={t(`patients.form.${u}`)}>
                  <Input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={u === 'years' ? 130 : u === 'months' ? 11 : 30}
                    {...register(`age.${u}`)}
                  />
                </FormField>
              ))}
            </div>
            {errors.birth && (
              <p role="alert" className="text-sm text-critical">
                {msg(errors.birth)}
              </p>
            )}
          </fieldset>
        )}
        <p
          id="age-hint"
          className="flex flex-wrap items-center gap-2 text-sm text-muted"
          aria-live="polite"
        >
          {dob ? (
            <>
              <span>
                {values.birthMode === 'age'
                  ? t('patients.form.estimatedDob', { date: formatLongDate(dob, locale) })
                  : t('patients.form.ageIs', { age: facts.label })}
              </span>
              {facts.senior && (
                <StatusBadge tone="info" icon={false} label={t('patients.flags.senior')} />
              )}
              {facts.minor && (
                <StatusBadge tone="info" icon={false} label={t('patients.flags.minor')} />
              )}
            </>
          ) : (
            t('patients.form.birthHint')
          )}
        </p>
      </div>
    </Section>
  );

  const contact = (
    <Section title={t('patients.form.contact')}>
      <FormField
        label={t('patients.form.mobile')}
        hint={t('patients.form.mobileHint')}
        error={msg(errors.mobile)}
        required
      >
        <Input type="tel" inputMode="numeric" mono autoComplete="off" {...register('mobile')} />
      </FormField>
      {!quick && (
        <FormField label={t('patients.form.altMobile')} error={msg(errors.altMobile)} optional>
          <Input
            type="tel"
            inputMode="numeric"
            mono
            autoComplete="off"
            {...register('altMobile')}
          />
        </FormField>
      )}
      {!quick && (
        <FormField label={t('patients.form.email')} error={msg(errors.email)} optional>
          <Input type="email" autoComplete="off" {...register('email')} />
        </FormField>
      )}
      <FormField label={t('patients.form.language')} hint={t('patients.form.languageHint')}>
        <Select
          options={Object.entries(LANGUAGES).map(([value, label]) => ({ value, label }))}
          {...register('preferredLanguage')}
        />
      </FormField>
      {!quick && (
        <>
          <FormField
            label={t('patients.form.address1')}
            optional
            className="sm:col-span-2"
            error={msg(errors.address?.line1)}
          >
            <Input autoComplete="off" {...register('address.line1')} />
          </FormField>
          <FormField label={t('patients.form.address2')} optional className="sm:col-span-2">
            <Input autoComplete="off" {...register('address.line2')} />
          </FormField>
          <FormField label={t('patients.form.city')} optional>
            <Input autoComplete="off" {...register('address.city')} />
          </FormField>
          <FormField label={t('patients.form.district')} optional>
            <Input autoComplete="off" {...register('address.district')} />
          </FormField>
          <FormField label={t('patients.form.state')} optional>
            <Input autoComplete="off" {...register('address.state')} />
          </FormField>
          <FormField label={t('patients.form.pin')} error={msg(errors.address?.pin)} optional>
            <Input inputMode="numeric" mono autoComplete="off" {...register('address.pin')} />
          </FormField>
        </>
      )}
    </Section>
  );

  if (quick)
    return (
      <div className="flex flex-col gap-4">
        {identity}
        {contact}
      </div>
    );

  return (
    <div className="flex flex-col gap-4">
      {identity}
      {contact}
      <Section title={t('patients.form.family')}>
        <FormField label={t('patients.form.relationType')} optional>
          <Select
            placeholder={t('patients.form.none')}
            options={Object.keys(RELATIONS).map(option('relations'))}
            {...register('relation.type')}
          />
        </FormField>
        <FormField
          label={t('patients.form.relationName')}
          error={msg(errors.relation?.name ?? errors.relation?.type)}
          optional
        >
          <Input autoComplete="off" {...register('relation.name')} />
        </FormField>
        <FormField label={t('patients.form.marital')} optional>
          <Select
            placeholder={t('patients.form.none')}
            options={MARITAL.map(option('marital'))}
            {...register('maritalStatus')}
          />
        </FormField>
        <div className="hidden lg:block" />
        <p className="text-sm font-semibold text-ink sm:col-span-2 lg:col-span-4">
          {t('patients.form.guardian')}
          {facts.minor ? (
            <span className="ml-2 font-normal text-warning">
              {t('patients.form.guardianRequired')}
            </span>
          ) : (
            <span className="ml-2 font-normal text-muted">({t('common.optional')})</span>
          )}
        </p>
        <FormField
          label={t('patients.form.contactName')}
          error={msg(errors.guardian?.name)}
          required={facts.minor}
        >
          <Input autoComplete="off" {...register('guardian.name')} />
        </FormField>
        <FormField
          label={t('patients.form.contactRelation')}
          error={msg(errors.guardian?.relation)}
          required={facts.minor}
        >
          <Input autoComplete="off" {...register('guardian.relation')} />
        </FormField>
        <FormField
          label={t('patients.form.contactMobile')}
          error={msg(errors.guardian?.mobile)}
          required={facts.minor}
        >
          <Input
            type="tel"
            inputMode="numeric"
            mono
            autoComplete="off"
            {...register('guardian.mobile')}
          />
        </FormField>
        <div className="hidden lg:block" />
        <p className="text-sm font-semibold text-ink sm:col-span-2 lg:col-span-4">
          {t('patients.form.emergency')}{' '}
          <span className="font-normal text-muted">({t('common.optional')})</span>
        </p>
        <FormField
          label={t('patients.form.contactName')}
          error={msg(errors.emergencyContact?.name)}
        >
          <Input autoComplete="off" {...register('emergencyContact.name')} />
        </FormField>
        <FormField
          label={t('patients.form.contactRelation')}
          error={msg(errors.emergencyContact?.relation)}
        >
          <Input autoComplete="off" {...register('emergencyContact.relation')} />
        </FormField>
        <FormField
          label={t('patients.form.contactMobile')}
          error={msg(errors.emergencyContact?.mobile)}
        >
          <Input
            type="tel"
            inputMode="numeric"
            mono
            autoComplete="off"
            {...register('emergencyContact.mobile')}
          />
        </FormField>
      </Section>

      <Section title={t('patients.form.idsTitle')}>
        <div className="flex flex-col gap-3 sm:col-span-2 lg:col-span-4">
          <p className="text-sm text-muted">{t('patients.form.idsHint')}</p>
          {ids.fields.map((f, i) => (
            <div
              key={f.id}
              className="grid grid-cols-1 items-end gap-3 rounded-control border border-line bg-surface-2 p-3 sm:grid-cols-[12rem_1fr_auto]"
            >
              <FormField label={t('patients.form.idType')}>
                <Select
                  options={Object.keys(ID_TYPES).map(option('idTypes'))}
                  {...register(`ids.${i}.type`)}
                />
              </FormField>
              <FormField
                label={t('patients.form.idNumber')}
                hint={
                  values.ids?.[i]?.type === 'AADHAAR' ? t('patients.form.aadhaarHint') : undefined
                }
                error={msg(errors.ids?.[i]?.number)}
              >
                {values.ids?.[i]?.type === 'AADHAAR' ? (
                  <Controller
                    control={control}
                    name={`ids.${i}.number`}
                    render={({ field }) => (
                      <AadhaarInput
                        name={field.name}
                        value={field.value}
                        onChange={field.onChange}
                        onBlur={field.onBlur}
                      />
                    )}
                  />
                ) : (
                  <Input mono autoComplete="off" {...register(`ids.${i}.number`)} />
                )}
              </FormField>
              <IconButton
                label={t('patients.form.removeId', { n: i + 1 })}
                icon={<X size={16} aria-hidden="true" />}
                onClick={() => ids.remove(i)}
              />
              {canUpload && (
                <div className="sm:col-span-3">
                  <Controller
                    control={control}
                    name={`ids.${i}.fileId`}
                    render={({ field }) => (
                      <FileField
                        label={t('patients.form.idScan')}
                        purpose="patient-document"
                        value={field.value || undefined}
                        onChange={(v) => field.onChange(v ?? '')}
                      />
                    )}
                  />
                </div>
              )}
            </div>
          ))}
          {ids.fields.length < 5 && (
            <Button
              variant="secondary"
              size="sm"
              className="self-start"
              icon={<Plus size={14} aria-hidden="true" />}
              onClick={() =>
                ids.append({ type: ids.fields.length ? 'PAN' : 'AADHAAR', number: '', fileId: '' })
              }
            >
              {t('patients.form.addId')}
            </Button>
          )}
        </div>
        <FormField
          label={t('patients.form.abhaNumber')}
          hint={t('patients.form.abhaHint')}
          error={msg(errors.abhaNumber)}
          optional
        >
          <Input inputMode="numeric" mono autoComplete="off" {...register('abhaNumber')} />
        </FormField>
        <FormField label={t('patients.form.abhaAddress')} error={msg(errors.abhaAddress)} optional>
          <Input mono autoComplete="off" spellCheck={false} {...register('abhaAddress')} />
        </FormField>
      </Section>

      <Section title={t('patients.form.clinical')}>
        <FormField label={t('patients.form.bloodGroup')} optional>
          <Select
            placeholder={t('patients.form.notKnown')}
            options={BLOOD_GROUPS.map((v) => ({
              value: v,
              label: v === 'Unknown' ? t('patients.form.bloodUnknown') : v,
            }))}
            {...register('bloodGroup')}
          />
        </FormField>
        <FormField
          label={t('patients.form.conditions')}
          hint={t('patients.form.conditionsHint')}
          optional
          className="sm:col-span-1 lg:col-span-3"
        >
          <Textarea rows={1} {...register('chronicConditions')} />
        </FormField>
        <div className="flex flex-col gap-3 sm:col-span-2 lg:col-span-4">
          <p className="text-sm font-semibold text-ink">{t('patients.form.allergies')}</p>
          {allergies.fields.map((f, i) => (
            <div
              key={f.id}
              className="grid grid-cols-1 items-end gap-3 rounded-control border border-line bg-surface-2 p-3 sm:grid-cols-[1fr_1fr_10rem_auto]"
            >
              <FormField
                label={t('patients.form.substance')}
                error={msg(errors.allergies?.[i]?.substance)}
                required
              >
                <Input autoComplete="off" {...register(`allergies.${i}.substance`)} />
              </FormField>
              <FormField label={t('patients.form.reaction')} optional>
                <Input autoComplete="off" {...register(`allergies.${i}.reaction`)} />
              </FormField>
              <FormField label={t('patients.form.severity')}>
                <Select
                  options={Object.keys(ALLERGY_SEVERITY).map(option('severity'))}
                  {...register(`allergies.${i}.severity`)}
                />
              </FormField>
              <IconButton
                label={t('patients.form.removeAllergy', { n: i + 1 })}
                icon={<X size={16} aria-hidden="true" />}
                onClick={() => allergies.remove(i)}
              />
            </div>
          ))}
          <div className="flex flex-wrap items-center gap-4">
            <Button
              variant="secondary"
              size="sm"
              icon={<Plus size={14} aria-hidden="true" />}
              disabled={values.noKnownAllergies}
              onClick={() =>
                allergies.append({ substance: '', reaction: '', severity: 'MODERATE' })
              }
            >
              {t('patients.form.addAllergy')}
            </Button>
            <Checkbox
              label={t('patients.form.nka')}
              disabled={allergies.fields.length > 0}
              {...register('noKnownAllergies')}
            />
          </div>
          {errors.noKnownAllergies && (
            <p role="alert" className="text-sm text-critical">
              {msg(errors.noKnownAllergies)}
            </p>
          )}
        </div>
      </Section>

      <Section title={t('patients.form.billingFlags')}>
        <FormField
          label={t('patients.form.category')}
          error={msg(errors.category)}
          hint={facts.senior ? t('patients.form.seniorHint') : undefined}
        >
          <Select
            options={Object.keys(PATIENT_CATEGORIES).map(option('categories'))}
            {...register('category')}
          />
        </FormField>
        <FormField label={t('patients.form.referredBy')} optional>
          <Input autoComplete="off" {...register('referralDoctor')} />
        </FormField>
        <div className="flex flex-wrap gap-x-6 sm:col-span-2">
          <Checkbox
            label={t('patients.flags.vip')}
            description={t('patients.form.vipHint')}
            {...register('flags.vip')}
          />
          <Checkbox
            label={t('patients.flags.mlc')}
            description={t('patients.form.mlcHint')}
            {...register('flags.mlc')}
          />
        </div>
        {canUpload && (
          <div className="sm:col-span-2 lg:col-span-4">
            <Controller
              control={control}
              name="photoFileId"
              render={({ field }) => (
                <FileField
                  label={t('patients.form.photo')}
                  purpose="patient-photo"
                  value={field.value || undefined}
                  onChange={(v) => field.onChange(v ?? '')}
                />
              )}
            />
          </div>
        )}
      </Section>
    </div>
  );
}
