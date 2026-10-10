import { baseApi } from '../../app/baseApi.js';

/**
 * Platform console API (/api/platform, answered only on the console.<root> host). The calls use
 * absolute URLs, so the hospital's /api/v1 base, branch header and token refresh do not apply;
 * the console signs in with its own cookie (`platform_token`, 30 minutes).
 *
 * Real today: sign-in, plans, metrics, tenants, tenant status, Sales plan, invoices, payments,
 * invoice PDF. The rest (marked "planned") are contracts answered by src/preview/console.preview.js
 * until the API lands.
 */
export const CONSOLE_BASE = `${globalThis.location?.origin ?? 'http://localhost'}/api/platform`;
const u = (path) => `${CONSOLE_BASE}${path}`;
const qs = (params = {}) => {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v != null && v !== '') p.set(k, String(v));
  const s = p.toString();
  return s ? `?${s}` : '';
};

export const consoleApi = baseApi.injectEndpoints({
  endpoints: (b) => ({
    // ---- sign-in (real)
    consoleMe: b.query({ query: () => u('/auth/me'), providesTags: ['PlatformSession'] }),
    consoleLogin: b.mutation({
      query: (body) => ({ url: u('/auth/login'), method: 'POST', body }),
    }),
    consoleVerify: b.mutation({
      query: (body) => ({ url: u('/auth/2fa/verify'), method: 'POST', body }),
      invalidatesTags: ['PlatformSession'],
    }),
    consoleLogout: b.mutation({ query: () => ({ url: u('/auth/logout'), method: 'POST' }) }),

    // ---- catalogue, metrics, tenants (real)
    platformPlans: b.query({ query: () => u('/plans'), providesTags: ['PlatformPlans'] }),
    platformMetrics: b.query({ query: () => u('/metrics'), providesTags: ['PlatformTenants'] }),
    platformTenants: b.query({
      query: (params) => u(`/tenants${qs(params)}`),
      providesTags: ['PlatformTenants'],
    }),
    platformTenant: b.query({
      query: (id) => u(`/tenants/${id}`),
      providesTags: (_r, _e, id) => [{ type: 'PlatformTenants', id }],
    }),
    tenantStatus: b.mutation({
      query: ({ id, ...body }) => ({ url: u(`/tenants/${id}/status`), method: 'POST', body }),
      invalidatesTags: ['PlatformTenants', 'PlatformInsights'],
    }),
    setTenantPlan: b.mutation({
      query: ({ id, ...body }) => ({ url: u(`/tenants/${id}/subscription`), method: 'POST', body }),
      invalidatesTags: ['PlatformTenants', 'PlatformInvoices'],
    }),
    platformInvoices: b.query({
      query: (params) => u(`/invoices${qs(params)}`),
      providesTags: ['PlatformInvoices'],
    }),
    recordInvoicePayment: b.mutation({
      query: ({ id, ...body }) => ({ url: u(`/invoices/${id}/payments`), method: 'POST', body }),
      invalidatesTags: ['PlatformInvoices', 'PlatformTenants', 'PlatformDunning'],
    }),

    // ---- planned contracts (preview data until the API is built)
    mrrHistory: b.query({ query: () => u('/metrics/history'), providesTags: ['PlatformTenants'] }),
    platformAlerts: b.query({ query: () => u('/alerts'), providesTags: ['PlatformInsights'] }),
    tenantStats: b.query({
      query: (ids) => u(`/tenant-stats${qs({ ids: ids.join(',') })}`),
      providesTags: ['PlatformInsights'],
    }),
    tenantInsights: b.query({
      query: (id) => u(`/tenants/${id}/insights`),
      providesTags: ['PlatformInsights', 'PlatformFlags'],
    }),
    createTenant: b.mutation({
      query: (body) => ({ url: u('/tenants'), method: 'POST', body }),
      invalidatesTags: ['PlatformTenants', 'PlatformLeads'],
    }),
    leads: b.query({
      query: (params) => u(`/leads${qs(params)}`),
      providesTags: ['PlatformLeads'],
    }),
    updateLead: b.mutation({
      query: ({ id, ...body }) => ({ url: u(`/leads/${id}`), method: 'PATCH', body }),
      invalidatesTags: ['PlatformLeads'],
    }),
    priceBookDrafts: b.query({
      query: () => u('/price-book/drafts'),
      providesTags: ['PlatformPlans'],
    }),
    savePriceBookDraft: b.mutation({
      query: (body) => ({ url: u('/price-book/drafts'), method: 'POST', body }),
      invalidatesTags: ['PlatformPlans'],
    }),
    publishPriceBookDraft: b.mutation({
      query: (id) => ({ url: u(`/price-book/drafts/${id}/publish`), method: 'POST' }),
      invalidatesTags: ['PlatformPlans'],
    }),
    coupons: b.query({ query: () => u('/coupons'), providesTags: ['PlatformCoupons'] }),
    createCoupon: b.mutation({
      query: (body) => ({ url: u('/coupons'), method: 'POST', body }),
      invalidatesTags: ['PlatformCoupons'],
    }),
    disableCoupon: b.mutation({
      query: ({ id, reason }) => ({
        url: u(`/coupons/${id}/disable`),
        method: 'POST',
        body: { reason },
      }),
      invalidatesTags: ['PlatformCoupons'],
    }),
    dunning: b.query({ query: () => u('/dunning'), providesTags: ['PlatformDunning'] }),
    dunningAction: b.mutation({
      query: ({ id, action, ...body }) => ({
        url: u(`/dunning/${id}/${action}`),
        method: 'POST',
        body,
      }),
      invalidatesTags: ['PlatformDunning'],
    }),
    usage: b.query({
      query: (params) => u(`/usage${qs(params)}`),
      providesTags: ['PlatformUsage'],
    }),
    supportSessions: b.query({
      query: (params) => u(`/support-sessions${qs(params)}`),
      providesTags: ['PlatformSupport'],
    }),
    requestSupportSession: b.mutation({
      query: (body) => ({ url: u('/support-sessions'), method: 'POST', body }),
      invalidatesTags: ['PlatformSupport', 'PlatformInsights'],
    }),
    endSupportSession: b.mutation({
      query: ({ id, reason }) => ({
        url: u(`/support-sessions/${id}/end`),
        method: 'POST',
        body: { reason },
      }),
      invalidatesTags: ['PlatformSupport', 'PlatformInsights'],
    }),
    releases: b.query({ query: () => u('/releases'), providesTags: ['PlatformFlags'] }),
    setRollout: b.mutation({
      query: ({ id, ...body }) => ({ url: u(`/releases/${id}/rollout`), method: 'POST', body }),
      invalidatesTags: ['PlatformFlags'],
    }),
    flags: b.query({ query: () => u('/flags'), providesTags: ['PlatformFlags'] }),
    saveFlag: b.mutation({
      query: ({ key, ...body }) => ({ url: u(`/flags/${key}`), method: 'PUT', body }),
      invalidatesTags: ['PlatformFlags'],
    }),
    setTenantFlag: b.mutation({
      query: ({ id, key, ...body }) => ({
        url: u(`/tenants/${id}/flags/${key}`),
        method: 'PUT',
        body,
      }),
      invalidatesTags: ['PlatformFlags', 'PlatformInsights'],
    }),
    platformUsers: b.query({ query: () => u('/users'), providesTags: ['PlatformUsers'] }),
    savePlatformUser: b.mutation({
      query: ({ id, ...body }) =>
        id
          ? { url: u(`/users/${id}`), method: 'PATCH', body }
          : { url: u('/users'), method: 'POST', body },
      invalidatesTags: ['PlatformUsers'],
    }),
  }),
});

export const {
  useConsoleMeQuery,
  useConsoleLoginMutation,
  useConsoleVerifyMutation,
  useConsoleLogoutMutation,
  usePlatformPlansQuery,
  usePlatformMetricsQuery,
  usePlatformTenantsQuery,
  usePlatformTenantQuery,
  useTenantStatusMutation,
  useSetTenantPlanMutation,
  usePlatformInvoicesQuery,
  useRecordInvoicePaymentMutation,
  useMrrHistoryQuery,
  usePlatformAlertsQuery,
  useTenantStatsQuery,
  useTenantInsightsQuery,
  useCreateTenantMutation,
  useLeadsQuery,
  useUpdateLeadMutation,
  usePriceBookDraftsQuery,
  useSavePriceBookDraftMutation,
  usePublishPriceBookDraftMutation,
  useCouponsQuery,
  useCreateCouponMutation,
  useDisableCouponMutation,
  useDunningQuery,
  useDunningActionMutation,
  useUsageQuery,
  useSupportSessionsQuery,
  useRequestSupportSessionMutation,
  useEndSupportSessionMutation,
  useReleasesQuery,
  useSetRolloutMutation,
  useFlagsQuery,
  useSaveFlagMutation,
  useSetTenantFlagMutation,
  usePlatformUsersQuery,
  useSavePlatformUserMutation,
} = consoleApi;
