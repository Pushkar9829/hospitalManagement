import { baseApi } from '../../app/baseApi.js';
import { cleanParams } from '../../lib/params.js';

/**
 * Patients (spec 5.4): search by UHID, mobile or name; register (409 POSSIBLE_DUPLICATE lists
 * likely matches, resend with confirmNotDuplicate); profile (opening it is logged); edit with
 * the version read; timeline; merge two UHIDs through approval (202).
 */
export const patientsApi = baseApi.injectEndpoints({
  endpoints: (b) => ({
    searchPatients: b.query({
      query: (params) => ({ url: '/patients', params: cleanParams(params) }),
      providesTags: ['Patients'],
    }),
    patient: b.query({
      query: (id) => `/patients/${id}`,
      providesTags: (_r, _e, id) => [{ type: 'Patients', id }],
    }),
    patientTimeline: b.query({
      query: (id) => `/patients/${id}/timeline`,
      providesTags: (_r, _e, id) => [{ type: 'Patients', id: `${id}:timeline` }],
    }),
    registerPatient: b.mutation({
      query: ({ idempotencyKey, ...body }) => ({
        url: '/patients',
        method: 'POST',
        body,
        idempotencyKey,
      }),
      invalidatesTags: ['Patients'],
    }),
    updatePatient: b.mutation({
      query: ({ id, ...body }) => ({ url: `/patients/${id}`, method: 'PUT', body }),
      invalidatesTags: (_r, _e, { id }) => [
        'Patients',
        { type: 'Patients', id },
        { type: 'Patients', id: `${id}:timeline` },
      ],
    }),
    requestMerge: b.mutation({
      query: (body) => ({ url: '/patients/merge', method: 'POST', body }),
      invalidatesTags: ['Patients', 'Approvals', 'ApprovalCount'],
    }),
  }),
});

export const {
  useSearchPatientsQuery,
  usePatientQuery,
  usePatientTimelineQuery,
  useRegisterPatientMutation,
  useUpdatePatientMutation,
  useRequestMergeMutation,
} = patientsApi;
