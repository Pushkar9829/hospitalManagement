import { baseApi } from '../../app/baseApi.js';
import { cleanParams } from '../../lib/params.js';

/** Saves a downloaded file (the Excel import template). */
function saveBlob(blob, filename) {
  if (typeof URL.createObjectURL !== 'function') return;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** A write that may wait for approval (202) also changes what Approvals shows. */
const withApprovals = (...tags) => [...tags, 'Approvals', 'ApprovalCount'];

/**
 * Setup module (spec 5.1 and 5.2): hospital settings, legal entities, number series, branches,
 * approval rules, departments and masters with Excel import. Writes that need a checker answer
 * 202 with `approvalId`.
 */
export const setupApi = baseApi.injectEndpoints({
  endpoints: (b) => ({
    hospitalSettings: b.query({ query: () => '/settings/hospital', providesTags: ['Settings'] }),
    updateHospitalSettings: b.mutation({
      query: (body) => ({ url: '/settings/hospital', method: 'PUT', body }),
      // The idle timeout is part of the session (GET /auth/me).
      invalidatesTags: ['Settings', 'Session'],
    }),

    entities: b.query({ query: () => '/settings/entities', providesTags: ['Entities'] }),
    saveEntity: b.mutation({
      query: ({ id, ...body }) =>
        id
          ? { url: `/settings/entities/${id}`, method: 'PUT', body }
          : { url: '/settings/entities', method: 'POST', body },
      invalidatesTags: ['Entities'],
    }),

    numberSeries: b.query({
      query: () => '/settings/number-series',
      providesTags: ['NumberSeries'],
    }),
    updateNumberSeries: b.mutation({
      query: ({ series, ...body }) => ({
        url: `/settings/number-series/${series}`,
        method: 'PUT',
        body,
      }),
      invalidatesTags: ['NumberSeries'],
    }),

    branches: b.query({ query: () => '/branches', providesTags: ['Branches'] }),
    saveBranch: b.mutation({
      query: ({ id, ...body }) =>
        id
          ? { url: `/branches/${id}`, method: 'PUT', body }
          : { url: '/branches', method: 'POST', body },
      invalidatesTags: withApprovals('Branches', 'Session'),
    }),
    closeBranch: b.mutation({
      query: ({ id, ...body }) => ({ url: `/branches/${id}/close`, method: 'POST', body }),
      invalidatesTags: withApprovals('Branches'),
    }),

    approvalRules: b.query({ query: () => '/approval-rules', providesTags: ['ApprovalRules'] }),
    updateApprovalRule: b.mutation({
      query: ({ action, ...body }) => ({
        url: `/approval-rules/${action}`,
        method: 'PUT',
        body,
      }),
      invalidatesTags: ['ApprovalRules'],
    }),

    departments: b.query({
      query: (params) => ({ url: '/departments', params: cleanParams(params) }),
      providesTags: ['Departments'],
    }),
    department: b.query({
      query: (id) => `/departments/${id}`,
      providesTags: (_r, _e, id) => [{ type: 'Departments', id }],
    }),
    createDepartment: b.mutation({
      query: (body) => ({ url: '/departments', method: 'POST', body }),
      invalidatesTags: withApprovals('Departments'),
    }),
    updateDepartment: b.mutation({
      query: ({ id, ...body }) => ({ url: `/departments/${id}`, method: 'PUT', body }),
      invalidatesTags: ['Departments'],
    }),
    submitDepartment: b.mutation({
      query: ({ id, ...body }) => ({ url: `/departments/${id}/submit`, method: 'POST', body }),
      invalidatesTags: withApprovals('Departments'),
    }),
    closeDepartment: b.mutation({
      query: ({ id, ...body }) => ({ url: `/departments/${id}/close`, method: 'POST', body }),
      invalidatesTags: withApprovals('Departments'),
    }),

    masters: b.query({
      query: ({ type, ...params }) => ({ url: `/masters/${type}`, params: cleanParams(params) }),
      providesTags: (_r, _e, { type }) => [{ type: 'Masters', id: type }],
    }),
    saveMaster: b.mutation({
      query: ({ type, id, ...body }) =>
        id
          ? { url: `/masters/${type}/${id}`, method: 'PUT', body }
          : { url: `/masters/${type}`, method: 'POST', body },
      invalidatesTags: (_r, _e, { type }) => withApprovals({ type: 'Masters', id: type }),
    }),
    setMasterActive: b.mutation({
      query: ({ type, id, ...body }) => ({
        url: `/masters/${type}/${id}/active`,
        method: 'POST',
        body,
      }),
      invalidatesTags: (_r, _e, { type }) => [{ type: 'Masters', id: type }],
    }),
    importMaster: b.mutation({
      query: ({ type, ...body }) => ({ url: `/masters/${type}/import`, method: 'POST', body }),
      invalidatesTags: (_r, _e, { type, commit }) =>
        commit ? withApprovals({ type: 'Masters', id: type }) : [],
    }),
    downloadTemplate: b.mutation({
      query: (type) => ({
        url: `/masters/${type}/template`,
        responseHandler: async (res) => {
          if (!res.ok) return res.json().catch(() => null);
          saveBlob(await res.blob(), `${type}-template.xlsx`);
          return { saved: true };
        },
      }),
    }),

    /** Active staff for pickers (head of department); needs settings:user:read. */
    staffOptions: b.query({
      query: () => ({ url: '/users', params: { status: 'ACTIVE', limit: 100 } }),
      providesTags: ['Users'],
    }),
  }),
});

export const {
  useHospitalSettingsQuery,
  useUpdateHospitalSettingsMutation,
  useEntitiesQuery,
  useSaveEntityMutation,
  useNumberSeriesQuery,
  useUpdateNumberSeriesMutation,
  useBranchesQuery,
  useSaveBranchMutation,
  useCloseBranchMutation,
  useApprovalRulesQuery,
  useUpdateApprovalRuleMutation,
  useDepartmentsQuery,
  useDepartmentQuery,
  useCreateDepartmentMutation,
  useUpdateDepartmentMutation,
  useSubmitDepartmentMutation,
  useCloseDepartmentMutation,
  useMastersQuery,
  useSaveMasterMutation,
  useSetMasterActiveMutation,
  useImportMasterMutation,
  useDownloadTemplateMutation,
  useStaffOptionsQuery,
} = setupApi;
