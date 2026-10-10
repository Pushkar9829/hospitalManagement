import { baseApi } from '../../app/baseApi.js';
import { cleanParams } from '../../lib/params.js';

/** Records an approval decision can change (it applies the request in the same transaction). */
const DECIDED = [
  'Approvals',
  'ApprovalCount',
  'Departments',
  'Branches',
  'Masters',
  'Users',
  'Roles',
  'Audit',
];

/** Maker-checker inbox (spec 4.5): list, one request, count for the menu badge, decide, withdraw. */
export const approvalsApi = baseApi.injectEndpoints({
  endpoints: (b) => ({
    approvals: b.query({
      query: (params) => ({ url: '/approvals', params: cleanParams(params) }),
      providesTags: ['Approvals'],
    }),
    approval: b.query({
      query: (id) => `/approvals/${id}`,
      providesTags: (_r, _e, id) => [{ type: 'Approvals', id }],
    }),
    /** Polled every 60 s; `x-background: 1` so polling never keeps an idle session alive. */
    approvalCount: b.query({
      query: () => ({ url: '/approvals/count', headers: { 'x-background': '1' } }),
      providesTags: ['ApprovalCount'],
    }),
    decideApproval: b.mutation({
      query: ({ id, ...body }) => ({ url: `/approvals/${id}/decision`, method: 'POST', body }),
      invalidatesTags: DECIDED,
    }),
    withdrawApproval: b.mutation({
      query: ({ id, ...body }) => ({ url: `/approvals/${id}/withdraw`, method: 'POST', body }),
      invalidatesTags: DECIDED,
    }),
  }),
});

export const {
  useApprovalsQuery,
  useApprovalQuery,
  useApprovalCountQuery,
  useDecideApprovalMutation,
  useWithdrawApprovalMutation,
} = approvalsApi;
