import { baseApi } from '../../app/baseApi.js';

/**
 * The hospital's own subscription (spec 3.5, 3.15): plan, modules, limits and usage, platform
 * invoices; a priced preview of a module change, the change itself, and the trial conversion.
 * Allowed even while the hospital is suspended, so the Super Admin can pay and reactivate.
 */
export const subscriptionApi = baseApi.injectEndpoints({
  endpoints: (b) => ({
    subscription: b.query({ query: () => '/subscription', providesTags: ['Subscription'] }),
    /** A read with a body: prorated charge now, next invoice estimate, what blocks the change. */
    previewChange: b.query({
      query: (body) => ({ url: '/subscription/preview', method: 'POST', body }),
    }),
    changeModules: b.mutation({
      query: (body) => ({ url: '/subscription/changes', method: 'POST', body }),
      invalidatesTags: ['Subscription', 'Session'],
    }),
    convertTrial: b.mutation({
      query: (body) => ({ url: '/subscription/convert', method: 'POST', body }),
      invalidatesTags: ['Subscription'],
    }),
  }),
});

export const {
  useSubscriptionQuery,
  usePreviewChangeQuery,
  useChangeModulesMutation,
  useConvertTrialMutation,
} = subscriptionApi;
