import { baseApi } from '../../app/baseApi.js';
import { cleanParams } from '../../lib/params.js';

const withApprovals = (...tags) => [...tags, 'Approvals', 'ApprovalCount'];

/**
 * Users and roles (spec 4.4): staff logins with invitation or temporary password, and custom
 * roles copied from system roles. Privileged roles and permission changes answer 202.
 */
export const usersApi = baseApi.injectEndpoints({
  endpoints: (b) => ({
    users: b.query({
      query: (params) => ({ url: '/users', params: cleanParams(params) }),
      providesTags: ['Users'],
    }),
    saveUser: b.mutation({
      query: ({ id, ...body }) =>
        id ? { url: `/users/${id}`, method: 'PUT', body } : { url: '/users', method: 'POST', body },
      invalidatesTags: withApprovals('Users', 'Roles'),
    }),
    /** deactivate {version, reason} · activate {version} · unlock · reset-password · resend-invite · sign-out */
    userAction: b.mutation({
      query: ({ id, action, body }) => ({
        url: `/users/${id}/${action}`,
        method: 'POST',
        ...(body ? { body } : {}),
      }),
      invalidatesTags: ['Users', 'Roles'],
    }),
    roles: b.query({ query: () => '/roles', providesTags: ['Roles'] }),
    permissionCatalog: b.query({ query: () => '/roles/permissions' }),
    saveRole: b.mutation({
      query: ({ id, ...body }) =>
        id ? { url: `/roles/${id}`, method: 'PUT', body } : { url: '/roles', method: 'POST', body },
      invalidatesTags: withApprovals('Roles'),
    }),
    deactivateRole: b.mutation({
      query: ({ id, ...body }) => ({ url: `/roles/${id}/deactivate`, method: 'POST', body }),
      invalidatesTags: ['Roles'],
    }),
  }),
});

export const {
  useUsersQuery,
  useSaveUserMutation,
  useUserActionMutation,
  useRolesQuery,
  usePermissionCatalogQuery,
  useSaveRoleMutation,
  useDeactivateRoleMutation,
} = usersApi;
