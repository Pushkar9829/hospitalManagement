import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { patientUpdateInput } from '@hms/shared/schemas';
import { Button, Sheet, useToast } from '@hms/ui';
import { ApiErrorNotice } from '../../../components/ApiErrorNotice.jsx';
import { useCan } from '../../../lib/useCan.js';
import { useUpdatePatientMutation } from '../api.js';
import { fromPatient, patientResolver, showFieldErrors } from '../patientForm.js';
import { PatientForm } from './PatientForm.jsx';

/**
 * Edit a patient with the version read. 409 VERSION_CONFLICT: "Reload" takes the latest record
 * for every field the user has not touched and keeps their edits.
 */
export function EditPatientSheet({ patient, open, onOpenChange, onReload }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const can = useCan();
  const [update] = useUpdatePatientMutation();
  const [failure, setFailure] = useState(null);
  const form = useForm({
    resolver: patientResolver(patientUpdateInput, 'edit'),
    defaultValues: fromPatient(patient),
  });
  const {
    handleSubmit,
    reset,
    setError,
    formState: { isSubmitting },
  } = form;

  useEffect(() => {
    reset(fromPatient(patient), { keepDirtyValues: true });
  }, [patient, reset]);

  const onSubmit = async (body) => {
    setFailure(null);
    try {
      const saved = await update({ id: patient.id, ...body }).unwrap();
      toast({ title: t('patients.profile.saved', { uhid: saved.uhid }), tone: 'success' });
      onOpenChange(false);
    } catch (err) {
      setFailure(showFieldErrors(err, setError));
    }
  };

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      size="xl"
      title={t('patients.profile.editTitle', { name: patient.name.full })}
      description={t('patients.profile.editHint', { uhid: patient.uhid })}
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" form="patient-edit" loading={isSubmitting}>
            {t('common.save')}
          </Button>
        </>
      }
    >
      <form
        id="patient-edit"
        onSubmit={handleSubmit(onSubmit)}
        noValidate
        className="flex flex-col gap-4"
      >
        <ApiErrorNotice
          error={failure}
          onReload={async () => {
            setFailure(null);
            const fresh = await onReload();
            if (fresh?.data) reset(fromPatient(fresh.data), { keepDirtyValues: true });
          }}
        />
        <PatientForm form={form} canUpload={can('patients:patient:update')} />
      </form>
    </Sheet>
  );
}
