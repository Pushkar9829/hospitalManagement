import { baseApi } from '../../app/baseApi.js';

/** Auth endpoints (spec "Authentication"). Cookies are httpOnly; the client never sees tokens. */
export const authApi = baseApi.injectEndpoints({
  endpoints: (b) => ({
    me: b.query({ query: () => '/auth/me', providesTags: ['Session'] }),
    login: b.mutation({ query: (body) => ({ url: '/auth/login', method: 'POST', body }) }),
    verifyTwoFactor: b.mutation({
      query: (body) => ({ url: '/auth/2fa/verify', method: 'POST', body }),
    }),
    requestOtp: b.mutation({
      query: (body) => ({ url: '/auth/otp/request', method: 'POST', body }),
    }),
    verifyOtp: b.mutation({ query: (body) => ({ url: '/auth/otp/verify', method: 'POST', body }) }),
    logout: b.mutation({ query: () => ({ url: '/auth/logout', method: 'POST' }) }),
    switchBranch: b.mutation({
      query: (body) => ({ url: '/auth/branch', method: 'POST', body }),
    }),
    setupTwoFactor: b.mutation({ query: () => ({ url: '/auth/2fa/setup', method: 'POST' }) }),
    enableTwoFactor: b.mutation({
      query: (body) => ({ url: '/auth/2fa/enable', method: 'POST', body }),
    }),
  }),
});

export const {
  useMeQuery,
  useLoginMutation,
  useVerifyTwoFactorMutation,
  useRequestOtpMutation,
  useVerifyOtpMutation,
  useLogoutMutation,
  useSwitchBranchMutation,
  useSetupTwoFactorMutation,
  useEnableTwoFactorMutation,
} = authApi;
