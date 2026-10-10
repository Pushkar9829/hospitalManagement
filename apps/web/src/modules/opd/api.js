import { baseApi } from '../../app/baseApi.js';
import { cleanParams } from '../../lib/params.js';

/*
 * OPD and front office (docs/modules/OPD.md, docs/ui-design/screens.md). The OPD API is not
 * built yet: these endpoints follow the planned contract (paths under /api/v1, lists as
 * { items, total, page, limit }, money in paise, ISO dates) and are answered by
 * src/preview/opd.preview.js and src/preview/frontoffice.preview.js in development.
 */

const LISTS = ['OpdAppointments', 'OpdSlots', 'OpdQueue'];

const post = (url, body) => ({ url, method: 'POST', body });

export const opdApi = baseApi.injectEndpoints({
  endpoints: (b) => ({
    // Masters
    opdDoctors: b.query({
      query: (params = {}) => ({ url: '/opd/doctors', params: cleanParams(params) }),
      providesTags: ['OpdMasters'],
    }),
    opdDepartments: b.query({
      query: () => '/opd/departments',
      providesTags: ['OpdMasters'],
    }),

    // Appointments and slots
    opdSlots: b.query({
      query: (params) => ({ url: '/opd/slots', params: cleanParams(params) }),
      providesTags: ['OpdSlots'],
    }),
    opdAppointments: b.query({
      query: (params) => ({ url: '/opd/appointments', params: cleanParams(params) }),
      providesTags: ['OpdAppointments'],
    }),
    opdAppointment: b.query({
      query: (id) => `/opd/appointments/${id}`,
      providesTags: (_r, _e, id) => [{ type: 'OpdAppointments', id }],
    }),
    bookAppointment: b.mutation({
      query: (body) => post('/opd/appointments', body),
      invalidatesTags: [...LISTS, 'OpdVisits'],
    }),
    checkIn: b.mutation({
      query: ({ id, ...body }) => post(`/opd/appointments/${id}/check-in`, body),
      invalidatesTags: [...LISTS, 'OpdVisits'],
    }),
    rescheduleAppointment: b.mutation({
      query: ({ id, ...body }) => post(`/opd/appointments/${id}/reschedule`, body),
      invalidatesTags: LISTS,
    }),
    cancelAppointment: b.mutation({
      query: ({ id, ...body }) => post(`/opd/appointments/${id}/cancel`, body),
      invalidatesTags: LISTS,
    }),
    markNoShow: b.mutation({
      query: ({ id }) => post(`/opd/appointments/${id}/no-show`, {}),
      invalidatesTags: LISTS,
    }),
    bulkMoveAppointments: b.mutation({
      query: (body) => post('/opd/appointments/bulk-move', body),
      invalidatesTags: LISTS,
    }),

    // Queue and visits
    opdQueue: b.query({
      query: (params = {}) => ({ url: '/opd/queue', params: cleanParams(params) }),
      providesTags: ['OpdQueue'],
    }),
    queueDisplay: b.query({
      query: () => '/opd/queue/display',
      providesTags: ['OpdQueue'],
    }),
    opdVisit: b.query({
      query: (id) => `/opd/visits/${id}`,
      providesTags: (_r, _e, id) => [{ type: 'OpdVisits', id }],
    }),
    startTriage: b.mutation({
      query: ({ id }) => post(`/opd/visits/${id}/start-triage`, {}),
      invalidatesTags: (_r, _e, { id }) => ['OpdQueue', { type: 'OpdVisits', id }],
    }),
    saveVitals: b.mutation({
      query: ({ id, ...body }) => post(`/opd/visits/${id}/vitals`, body),
      invalidatesTags: (_r, _e, { id }) => ['OpdQueue', { type: 'OpdVisits', id }],
    }),
    skipTriage: b.mutation({
      query: ({ id, ...body }) => post(`/opd/visits/${id}/skip-triage`, body),
      invalidatesTags: (_r, _e, { id }) => ['OpdQueue', { type: 'OpdVisits', id }],
    }),
    recordProcedure: b.mutation({
      query: ({ id, ...body }) => post(`/opd/visits/${id}/procedures`, body),
      invalidatesTags: (_r, _e, { id }) => [{ type: 'OpdVisits', id }],
    }),
    callVisit: b.mutation({
      query: ({ id }) => post(`/opd/visits/${id}/call`, {}),
      invalidatesTags: (_r, _e, { id }) => [...LISTS, { type: 'OpdVisits', id }],
    }),
    skipVisit: b.mutation({
      query: ({ id, ...body }) => post(`/opd/visits/${id}/skip`, body),
      invalidatesTags: (_r, _e, { id }) => ['OpdQueue', { type: 'OpdVisits', id }],
    }),
    moveVisit: b.mutation({
      query: ({ id, ...body }) => post(`/opd/visits/${id}/move`, body),
      invalidatesTags: (_r, _e, { id }) => ['OpdQueue', { type: 'OpdVisits', id }],
    }),

    // Consultation
    consultation: b.query({
      query: (id) => `/opd/visits/${id}/consultation`,
      providesTags: (_r, _e, id) => [{ type: 'OpdConsultation', id }],
    }),
    saveConsultation: b.mutation({
      query: ({ id, ...body }) => ({ url: `/opd/visits/${id}/consultation`, method: 'PUT', body }),
      // The draft is kept in the form; refetching on every auto-save would fight the typing.
      async onQueryStarted({ id }, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          dispatch(opdApi.util.updateQueryData('consultation', id, () => data));
        } catch {
          // The form shows the save error.
        }
      },
    }),
    completeVisit: b.mutation({
      query: ({ id, ...body }) => post(`/opd/visits/${id}/complete`, body),
      invalidatesTags: (_r, _e, { id }) => [
        ...LISTS,
        { type: 'OpdVisits', id },
        { type: 'OpdConsultation', id },
      ],
    }),
    addAddendum: b.mutation({
      query: ({ id, ...body }) => post(`/opd/visits/${id}/addenda`, body),
      invalidatesTags: (_r, _e, { id }) => [{ type: 'OpdConsultation', id }],
    }),
    shareVisit: b.mutation({
      query: ({ id, ...body }) => post(`/opd/visits/${id}/share`, body),
    }),
    requestAdmission: b.mutation({
      query: ({ id, ...body }) => post(`/opd/visits/${id}/admission-request`, body),
      invalidatesTags: (_r, _e, { id }) => [{ type: 'OpdVisits', id }],
    }),
    referVisit: b.mutation({
      query: ({ id, ...body }) => post(`/opd/visits/${id}/referral`, body),
    }),
    issueCertificate: b.mutation({
      query: ({ id, ...body }) => post(`/opd/visits/${id}/certificates`, body),
      invalidatesTags: (_r, _e, { id }) => [{ type: 'OpdConsultation', id }],
    }),
    visitCharges: b.query({
      query: (id) => `/opd/visits/${id}/charges`,
      providesTags: (_r, _e, id) => [{ type: 'OpdConsultation', id }],
    }),
    closeVisit: b.mutation({
      query: ({ id, ...body }) => post(`/opd/visits/${id}/close`, body),
      invalidatesTags: (_r, _e, { id }) => [
        ...LISTS,
        { type: 'OpdVisits', id },
        { type: 'OpdConsultation', id },
      ],
    }),

    // Look-ups for the consultation
    icd10: b.query({
      query: (q) => ({ url: '/opd/icd10', params: { q } }),
    }),
    formulary: b.query({
      query: (q) => ({ url: '/opd/formulary', params: { q } }),
    }),
    orderables: b.query({
      query: (params) => ({ url: '/opd/orderables', params: cleanParams(params) }),
    }),
    opdTemplates: b.query({
      query: (params = {}) => ({ url: '/opd/templates', params: cleanParams(params) }),
      providesTags: ['OpdTemplates'],
    }),
    createTemplate: b.mutation({
      query: (body) => post('/opd/templates', body),
      invalidatesTags: ['OpdTemplates'],
    }),

    // Schedules and settings
    opdSchedules: b.query({
      query: (params = {}) => ({ url: '/opd/schedules', params: cleanParams(params) }),
      providesTags: ['OpdSchedules'],
    }),
    opdSchedule: b.query({
      query: (doctorId) => `/opd/schedules/${doctorId}`,
      providesTags: (_r, _e, id) => [{ type: 'OpdSchedules', id }],
    }),
    saveSchedule: b.mutation({
      query: ({ doctorId, ...body }) => ({
        url: `/opd/schedules/${doctorId}`,
        method: 'PUT',
        body,
      }),
      invalidatesTags: ['OpdSchedules', 'OpdSlots', 'OpdMasters'],
    }),
    blockDates: b.mutation({
      query: ({ doctorId, ...body }) => post(`/opd/schedules/${doctorId}/blocks`, body),
      invalidatesTags: ['OpdSchedules', 'OpdSlots'],
    }),
    opdSettings: b.query({
      query: () => '/opd/settings',
      providesTags: ['OpdSettings'],
    }),
    saveOpdSettings: b.mutation({
      query: (body) => ({ url: '/opd/settings', method: 'PUT', body }),
      invalidatesTags: ['OpdSettings'],
    }),
    tokenSeries: b.query({
      query: () => '/opd/token-series',
      providesTags: ['OpdSettings'],
    }),
    addTokenSeries: b.mutation({
      query: (body) => post('/opd/token-series', body),
      invalidatesTags: ['OpdSettings'],
    }),
    messageTemplates: b.query({
      query: () => '/opd/message-templates',
      providesTags: ['OpdSettings'],
    }),
    saveMessageTemplate: b.mutation({
      query: ({ id, ...body }) => ({ url: `/opd/message-templates/${id}`, method: 'PUT', body }),
      invalidatesTags: ['OpdSettings'],
    }),
    visitTypes: b.query({
      query: () => '/opd/visit-types',
      providesTags: ['OpdSettings'],
    }),
    addVisitType: b.mutation({
      query: (body) => post('/opd/visit-types', body),
      invalidatesTags: ['OpdSettings'],
    }),

    // The other appointment tabs
    healthCheckups: b.query({
      query: (params = {}) => ({ url: '/opd/health-checkups', params: cleanParams(params) }),
      providesTags: ['OpdLists'],
    }),
    bookCheckup: b.mutation({
      query: (body) => post('/opd/health-checkups', body),
      invalidatesTags: ['OpdLists'],
    }),
    importCheckups: b.mutation({
      query: (body) => post('/opd/health-checkups/import', body),
      invalidatesTags: ['OpdLists'],
    }),
    teleConsults: b.query({
      query: () => '/opd/tele-consults',
      providesTags: ['OpdLists', 'OpdAppointments'],
    }),
    startTeleConsult: b.mutation({
      query: ({ id }) => post(`/opd/tele-consults/${id}/start`, {}),
      invalidatesTags: ['OpdLists', ...LISTS],
    }),
    treatmentPlans: b.query({
      query: (params = {}) => ({ url: '/opd/treatment-plans', params: cleanParams(params) }),
      providesTags: ['OpdLists'],
    }),
    addTreatmentPlan: b.mutation({
      query: (body) => post('/opd/treatment-plans', body),
      invalidatesTags: ['OpdLists'],
    }),
    opdResources: b.query({
      query: (params = {}) => ({ url: '/opd/resources', params: cleanParams(params) }),
      providesTags: ['OpdLists'],
    }),
    addResource: b.mutation({
      query: (body) => post('/opd/resources', body),
      invalidatesTags: ['OpdLists'],
    }),

    // Analytics
    opdWaitTimes: b.query({
      query: (params) => ({ url: '/reports/opd-wait-times', params: cleanParams(params) }),
      providesTags: ['OpdReports'],
    }),
    opdDoctorPerformance: b.query({
      query: (params) => ({
        url: '/reports/opd-doctor-performance',
        params: cleanParams(params),
      }),
      providesTags: ['OpdReports'],
    }),

    // Front office (planned: /front-office/*)
    foCounters: b.query({
      query: () => '/front-office/counters',
      providesTags: ['FrontOffice'],
    }),
    issueCounterToken: b.mutation({
      query: (body) => post('/front-office/tokens', body),
      invalidatesTags: ['FrontOffice'],
    }),
    callNextToken: b.mutation({
      query: ({ id }) => post(`/front-office/counters/${id}/call-next`, {}),
      invalidatesTags: ['FrontOffice'],
    }),
    enquiries: b.query({
      query: (params = {}) => ({ url: '/front-office/enquiries', params: cleanParams(params) }),
      providesTags: ['FrontOffice'],
    }),
    logEnquiry: b.mutation({
      query: (body) => post('/front-office/enquiries', body),
      invalidatesTags: ['FrontOffice'],
    }),
    enquirySummary: b.query({
      query: (params = {}) => ({
        url: '/front-office/enquiries/summary',
        params: cleanParams(params),
      }),
      providesTags: ['FrontOffice'],
    }),
    visitorPasses: b.query({
      query: (params = {}) => ({ url: '/front-office/passes', params: cleanParams(params) }),
      providesTags: ['FrontOffice'],
    }),
    issuePass: b.mutation({
      query: (body) => post('/front-office/passes', body),
      invalidatesTags: ['FrontOffice'],
    }),
    markPassOut: b.mutation({
      query: ({ id }) => post(`/front-office/passes/${id}/out`, {}),
      invalidatesTags: ['FrontOffice'],
    }),
    visitorLog: b.query({
      query: (params = {}) => ({ url: '/front-office/visitor-log', params: cleanParams(params) }),
      providesTags: ['FrontOffice'],
    }),
    locatePatient: b.query({
      query: (params) => ({ url: '/front-office/locator', params: cleanParams(params) }),
      providesTags: ['FrontOffice'],
    }),
  }),
});

export const {
  useOpdDoctorsQuery,
  useOpdDepartmentsQuery,
  useOpdSlotsQuery,
  useOpdAppointmentsQuery,
  useOpdAppointmentQuery,
  useBookAppointmentMutation,
  useCheckInMutation,
  useRescheduleAppointmentMutation,
  useCancelAppointmentMutation,
  useMarkNoShowMutation,
  useBulkMoveAppointmentsMutation,
  useOpdQueueQuery,
  useQueueDisplayQuery,
  useOpdVisitQuery,
  useStartTriageMutation,
  useSaveVitalsMutation,
  useSkipTriageMutation,
  useRecordProcedureMutation,
  useCallVisitMutation,
  useSkipVisitMutation,
  useMoveVisitMutation,
  useConsultationQuery,
  useSaveConsultationMutation,
  useCompleteVisitMutation,
  useAddAddendumMutation,
  useShareVisitMutation,
  useRequestAdmissionMutation,
  useReferVisitMutation,
  useIssueCertificateMutation,
  useVisitChargesQuery,
  useCloseVisitMutation,
  useIcd10Query,
  useFormularyQuery,
  useOrderablesQuery,
  useOpdTemplatesQuery,
  useCreateTemplateMutation,
  useOpdSchedulesQuery,
  useOpdScheduleQuery,
  useSaveScheduleMutation,
  useBlockDatesMutation,
  useOpdSettingsQuery,
  useSaveOpdSettingsMutation,
  useTokenSeriesQuery,
  useAddTokenSeriesMutation,
  useMessageTemplatesQuery,
  useSaveMessageTemplateMutation,
  useVisitTypesQuery,
  useAddVisitTypeMutation,
  useHealthCheckupsQuery,
  useBookCheckupMutation,
  useImportCheckupsMutation,
  useTeleConsultsQuery,
  useStartTeleConsultMutation,
  useTreatmentPlansQuery,
  useAddTreatmentPlanMutation,
  useOpdResourcesQuery,
  useAddResourceMutation,
  useOpdWaitTimesQuery,
  useOpdDoctorPerformanceQuery,
  useFoCountersQuery,
  useIssueCounterTokenMutation,
  useCallNextTokenMutation,
  useEnquiriesQuery,
  useLogEnquiryMutation,
  useEnquirySummaryQuery,
  useVisitorPassesQuery,
  useIssuePassMutation,
  useMarkPassOutMutation,
  useVisitorLogQuery,
  useLocatePatientQuery,
} = opdApi;
