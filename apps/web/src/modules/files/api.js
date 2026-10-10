import { baseApi } from '../../app/baseApi.js';

/** Files: a 5-minute upload URL, then confirm; downloads get a 5-minute link (audited). */
export const filesApi = baseApi.injectEndpoints({
  endpoints: (b) => ({
    createUpload: b.mutation({
      query: (body) => ({ url: '/files/upload-url', method: 'POST', body }),
    }),
    completeUpload: b.mutation({
      query: (id) => ({ url: `/files/${id}/complete`, method: 'POST' }),
    }),
    downloadUrl: b.mutation({ query: (id) => ({ url: `/files/${id}/download-url` }) }),
  }),
});

export const { useCreateUploadMutation, useCompleteUploadMutation, useDownloadUrlMutation } =
  filesApi;
