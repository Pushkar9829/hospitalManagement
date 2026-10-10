import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { ReceiptIndianRupee, Save } from 'lucide-react';
import { patientCreateInput } from '@hms/shared/schemas';
import { addAdminStrings } from '@hms/i18n/admin';
import { addPatientsStrings } from '@hms/i18n/patients';
import {
  Banner,
  Button,
  Page,
  PageHeader,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  usePageAction,
  useToast,
} from '@hms/ui';
import { apiError } from '../../../app/apiError.js';
import { ApiErrorNotice } from '../../../components/ApiErrorNotice.jsx';
import { useCan } from '../../../lib/useCan.js';
import { useFormDraft } from '../../../lib/useDraft.js';
import { useIdempotencyKey } from '../../../lib/useIdempotencyKey.js';
import { useStrings } from '../../../lib/useStrings.js';
import { useUrlState } from '../../../lib/useUrlState.js';
import { useRegisterPatientMutation } from '../api.js';
import { DuplicateMatches } from '../components/DuplicateMatches.jsx';
import { PatientForm } from '../components/PatientForm.jsx';
import {
  duplicateMatches,
  emptyForm,
  patientResolver,
  prefillFromSearch,
  showFieldErrors,
} from '../patientForm.js';

/**
 * Patient registration (design board "Patients", spec 5.4): quick (name, gender, age, mobile)
 * or full. The draft is kept on this device without ID numbers. A likely duplicate (409
 * POSSIBLE_DUPLICATE) lists the matches with their scores: open one, or register anyway.
 */
export default function RegisterPatientPage() {
  useStrings(addAdminStrings, addPatientsStrings);
  const { t } = useTranslation();
  const { toast } = useToast();
  const navigate = useNavigate();
  const can = useCan();
  const [params] = useSearchParams();
  const [type, setType] = useUrlState('type', 'full');
  const [register, { isLoading: saving }] = useRegisterPatientMutation();
  const [key, renewKey] = useIdempotencyKey();
  const [failure, setFailure] = useState(null);
  const [dupes, setDupes] = useState(null);
  const [pending, setPending] = useState(null); // 'save' | 'bill' while saving
  const registrationType = type === 'quick' ? 'QUICK' : 'FULL';
  const form = useForm({
    resolver: patientResolver(patientCreateInput, 'create'),
    defaultValues: emptyForm({ registrationType, prefill: prefillFromSearch(params.get('q')) }),
  });
  const { handleSubmit, setValue, setError, reset } = form;
  const { clear, restored } = useFormDraft('patient-register', form, { omit: ['ids'] });
  const canBill = can('billing:bill:create');

  const done = (patient, bill) => {
    clear();
    renewKey();
    toast({ title: t('patients.registered', { uhid: patient.uhid }), tone: 'success' });
    navigate(bill ? `/billing?tab=new&patient=${patient.id}` : `/patients/${patient.id}`);
  };

  const send = async (body, bill) => {
    setFailure(null);
    setPending(bill ? 'bill' : 'save');
    try {
      done(await register({ ...body, idempotencyKey: key() }).unwrap(), bill);
    } catch (err) {
      renewKey();
      const e = apiError(err);
      if (e?.code === 'POSSIBLE_DUPLICATE') {
        setDupes({ matches: duplicateMatches(err), body, bill });
        return;
      }
      setFailure(showFieldErrors(err, setError));
    } finally {
      setPending(null);
    }
  };

  const submit = (bill) =>
    handleSubmit((body) => {
      setDupes(null);
      return send(body, bill);
    });
  usePageAction('save', submit(false));

  return (
    <Page width="medium">
      <PageHeader
        title={t('patients.registerTitle')}
        description={t('patients.registerHint')}
        breadcrumb={[
          { label: t('patients.search.title'), href: '/patients' },
          { label: t('patients.registerTitle') },
        ]}
      />
      <Tabs
        value={type === 'quick' ? 'quick' : 'full'}
        onValueChange={(v) => {
          setType(v);
          setValue('registrationType', v === 'quick' ? 'QUICK' : 'FULL');
        }}
      >
        <TabsList aria-label={t('patients.typeLabel')}>
          <TabsTrigger value="quick">{t('patients.quick')}</TabsTrigger>
          <TabsTrigger value="full">{t('patients.full')}</TabsTrigger>
        </TabsList>
        <TabsContent value={type === 'quick' ? 'quick' : 'full'} className="flex flex-col gap-4">
          <p className="text-sm text-muted">
            {t(type === 'quick' ? 'patients.quickHint' : 'patients.fullHint')}
          </p>
          {restored && (
            <Banner
              tone="info"
              action={
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    clear();
                    reset(emptyForm({ registrationType }));
                  }}
                >
                  {t('patients.discardDraft')}
                </Button>
              }
            >
              {t('patients.draftRestored')}
            </Banner>
          )}
          {dupes?.matches.length > 0 && (
            <DuplicateMatches
              matches={dupes.matches}
              confirming={saving}
              onConfirm={() => send({ ...dupes.body, confirmNotDuplicate: true }, dupes.bill)}
            />
          )}
          <ApiErrorNotice error={failure} />
          <form onSubmit={submit(false)} noValidate className="flex flex-col gap-4">
            <PatientForm form={form} canUpload={can('patients:patient:update')} />
            <div className="sticky bottom-0 -mx-4 flex flex-wrap justify-end gap-2 border-t border-line bg-ground/95 px-4 py-3 md:-mx-6 md:px-6">
              <Button variant="secondary" onClick={() => navigate('/patients')}>
                {t('common.cancel')}
              </Button>
              {canBill && (
                <Button
                  variant="secondary"
                  loading={pending === 'bill'}
                  disabled={saving}
                  icon={<ReceiptIndianRupee size={16} aria-hidden="true" />}
                  onClick={submit(true)}
                >
                  {t('patients.saveAndBill')}
                </Button>
              )}
              <Button
                type="submit"
                loading={pending === 'save'}
                disabled={saving}
                icon={<Save size={16} aria-hidden="true" />}
              >
                {t('patients.save')}
              </Button>
            </div>
          </form>
        </TabsContent>
      </Tabs>
    </Page>
  );
}
