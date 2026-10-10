import { PUBLIC_BASE, baseApi } from '../../app/baseApi.js';

/**
 * Public signup on the marketing host (no hospital, no session): plans and prices, the
 * subdomain check, mobile OTP, and the trial signup (202 with the link to set the first
 * password). Absolute URLs under /api/public, so no session refresh is attempted.
 */
export const signupApi = baseApi.injectEndpoints({
  endpoints: (b) => ({
    plans: b.query({ query: () => `${PUBLIC_BASE}/plans` }),
    subdomain: b.query({
      query: (name) => `${PUBLIC_BASE}/subdomains/${encodeURIComponent(name)}`,
      keepUnusedDataFor: 30,
    }),
    signupOtp: b.mutation({
      query: (body) => ({ url: `${PUBLIC_BASE}/signup/otp`, method: 'POST', body }),
    }),
    verifySignupOtp: b.mutation({
      query: (body) => ({ url: `${PUBLIC_BASE}/signup/otp/verify`, method: 'POST', body }),
    }),
    signup: b.mutation({
      query: (body) => ({ url: `${PUBLIC_BASE}/signup`, method: 'POST', body }),
    }),
  }),
});

export const {
  usePlansQuery,
  useSubdomainQuery,
  useSignupOtpMutation,
  useVerifySignupOtpMutation,
  useSignupMutation,
} = signupApi;
