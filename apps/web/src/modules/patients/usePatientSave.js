import { patientUpdateInput } from '@hms/shared/schemas';
import { useUpdatePatientMutation } from './api.js';
import { fromPatient, toPayload } from './patientForm.js';

/**
 * Saves one change to a patient without the full form (a document scan, the photo): the
 * record as read, with `patch(formValues)` applied, sent with the version read (409 if someone
 * else saved meanwhile).
 */
export function usePatientSave(patient) {
  const [update, state] = useUpdatePatientMutation();
  const save = async (patch) => {
    const values = patch(fromPatient(patient));
    const body = patientUpdateInput.parse(toPayload(values, 'edit'));
    return update({ id: patient.id, ...body }).unwrap();
  };
  return [save, state];
}
