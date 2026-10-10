import { useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { Ellipsis, Plus, Search, Users } from 'lucide-react';
import {
  Button,
  ConfirmDialog,
  DataTable,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  EmptyState,
  ErrorState,
  FormField,
  IconButton,
  Input,
  Page,
  PageHeader,
  Select,
  StatusBadge,
  formatDateTime,
  useToast,
} from '@hms/ui';
import { apiError } from '../../../app/apiError.js';
import { selectSession } from '../../../app/session.js';
import { useCan } from '../../../lib/useCan.js';
import { useDebounced } from '../../../lib/useDebounced.js';
import { useUrlState } from '../../../lib/useUrlState.js';
import { ApiErrorNotice } from '../../../components/ApiErrorNotice.jsx';
import { PendingApprovalNotice } from '../../../components/PendingApprovalNotice.jsx';
import { Status } from '../../../components/Status.jsx';
import { useBranchesQuery, useDepartmentsQuery } from '../../setup/api.js';
import { useRolesQuery, useUserActionMutation, useUsersQuery } from '../api.js';
import { UserSheet } from '../components/UserSheet.jsx';
import { ResetPasswordDialog } from '../components/ResetPasswordDialog.jsx';
import { useAdminStrings } from '../../../lib/useAdminStrings.js';

const LIMIT = 25;
const STATUSES = ['ACTIVE', 'PENDING_APPROVAL', 'INVITED', 'LOCKED', 'DISABLED'];

/** What an admin can do to one login, by its state. */
function rowActions(u, me) {
  const locked = u.status === 'LOCKED' || Boolean(u.lockedUntil);
  return [
    u.status === 'INVITED' && 'resend-invite',
    locked && 'unlock',
    ['ACTIVE', 'LOCKED'].includes(u.status) && 'reset-password',
    ['ACTIVE', 'LOCKED'].includes(u.status) && u.id !== me && 'sign-out',
    u.status === 'DISABLED' && 'activate',
    u.status !== 'DISABLED' && u.status !== 'PENDING_APPROVAL' && u.id !== me && 'deactivate',
  ].filter(Boolean);
}

/**
 * Users and logins (design board "Users", spec 4.4): search and filter, add a login by
 * invitation or temporary password, edit roles and branches (privileged roles need approval),
 * and the admin actions: deactivate, activate, unlock, reset password, resend invite, sign out.
 */
export default function UsersPage() {
  useAdminStrings();
  const { t, i18n } = useTranslation();
  const { toast } = useToast();
  const can = useCan();
  const me = useSelector(selectSession).data?.user.id;
  const canUpdate = can('settings:user:update');
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [role, setRole] = useState('');
  const [branchId, setBranchId] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [page, setPage] = useState(1);
  const query = useDebounced(q.trim());
  const [openId, setOpenId] = useUrlState('user', '');
  const [notice, setNotice] = useState(null);
  const [failure, setFailure] = useState(null);
  const [confirm, setConfirm] = useState(null); // { user, action }
  const [resetting, setResetting] = useState(null);
  const { data: roles = [] } = useRolesQuery();
  const { data: branches = [] } = useBranchesQuery();
  const { data: depts } = useDepartmentsQuery({ status: 'ACTIVE', limit: 100 });
  const [run] = useUserActionMutation();
  const { data, isLoading, isFetching, isError, error, refetch } = useUsersQuery({
    q: query,
    status,
    role,
    branchId,
    departmentId,
    page,
    limit: LIMIT,
  });
  const items = useMemo(() => data?.items ?? [], [data]);
  const user = openId && openId !== 'new' ? items.find((u) => u.id === openId) : null;
  const locale = i18n.language === 'hi' ? 'hi-IN' : 'en-IN';
  const branchName = useMemo(() => new Map(branches.map((b) => [b.id, b.name])), [branches]);
  const roleName = useMemo(() => new Map(roles.map((r) => [r.code, r.name])), [roles]);

  const perform = async (u, action, body) => {
    setFailure(null);
    try {
      await run({ id: u.id, action, body }).unwrap();
      toast({ title: t(`users.actionDone.${action}`, { name: u.name }), tone: 'success' });
    } catch (err) {
      setFailure(apiError(err));
    }
  };

  const choose = (u, action) => {
    if (action === 'reset-password') setResetting(u);
    else if (action === 'unlock' || action === 'resend-invite') perform(u, action);
    else setConfirm({ user: u, action });
  };

  const onDone = ({ name, approvalId, created, mode }) => {
    if (approvalId)
      setNotice({ approvalId, text: t(created ? 'users.sentNew' : 'users.sentRoles', { name }) });
    else
      toast({
        title: t(
          created ? (mode === 'INVITE' ? 'users.invited' : 'users.created') : 'users.saved',
          { name },
        ),
        tone: 'success',
      });
  };

  const columns = useMemo(
    () => [
      {
        id: 'name',
        header: t('users.name'),
        cell: ({ row }) => (
          <span className="flex flex-col">
            <span className="font-semibold">{row.original.name}</span>
            {row.original.designation && (
              <span className="text-sm text-muted">{row.original.designation}</span>
            )}
          </span>
        ),
      },
      {
        id: 'username',
        header: t('users.username'),
        meta: { mono: true },
        cell: ({ row }) => row.original.username,
      },
      {
        id: 'roles',
        header: t('users.roles'),
        cell: ({ row }) => (
          <span className="flex flex-col gap-0.5">
            <span>{row.original.roles.map((r) => r.name).join(', ') || '-'}</span>
            {row.original.pendingRoleCodes?.length > 0 && (
              <span className="text-sm text-warning">
                {t('users.pendingRoles', {
                  roles: row.original.pendingRoleCodes.map((c) => roleName.get(c) ?? c).join(', '),
                })}
              </span>
            )}
          </span>
        ),
      },
      {
        id: 'branches',
        header: t('users.branches'),
        cell: ({ row }) =>
          row.original.branchIds.map((id) => branchName.get(id) ?? '?').join(', ') || '-',
      },
      {
        id: 'twoFactor',
        header: t('users.twoFactor'),
        cell: ({ row }) =>
          row.original.twoFactorEnabled ? (
            <StatusBadge tone="success" label={t('users.on')} />
          ) : (
            <StatusBadge tone="neutral" label={t('users.off')} />
          ),
      },
      {
        id: 'lastLogin',
        header: t('users.lastLogin'),
        cell: ({ row }) =>
          row.original.lastLoginAt ? (
            formatDateTime(row.original.lastLoginAt, locale)
          ) : (
            <span className="text-muted">-</span>
          ),
      },
      {
        id: 'status',
        header: t('common.status'),
        cell: ({ row }) => (
          <span className="flex flex-col items-start gap-1">
            <Status kind="user" code={row.original.status} />
            {row.original.mustChangePassword && (
              <span className="text-xs text-muted">{t('users.mustChange')}</span>
            )}
          </span>
        ),
      },
      ...(canUpdate
        ? [
            {
              id: 'actions',
              header: <span className="sr-only">{t('common.actions')}</span>,
              meta: { align: 'right' },
              cell: ({ row }) => {
                const actions = rowActions(row.original, me);
                if (!actions.length) return null;
                return (
                  <span
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => e.stopPropagation()}
                    role="presentation"
                  >
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <IconButton
                          size="sm"
                          label={t('users.actionsFor', { name: row.original.name })}
                          icon={<Ellipsis size={16} aria-hidden="true" />}
                        />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        {actions.map((a) => (
                          <DropdownMenuItem
                            key={a}
                            onSelect={() => choose(row.original, a)}
                            className={a === 'deactivate' ? 'text-critical' : undefined}
                          >
                            {t(`users.action.${a}`)}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </span>
                );
              },
            },
          ]
        : []),
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t, locale, branchName, roleName, canUpdate, me],
  );

  const filtered = Boolean(query || status || role || branchId || departmentId);
  const c = confirm;

  return (
    <Page>
      <PageHeader
        title={t('users.title')}
        description={t('users.description')}
        actions={
          can('settings:user:create') && (
            <Button icon={<Plus size={16} aria-hidden="true" />} onClick={() => setOpenId('new')}>
              {t('users.add')}
            </Button>
          )
        }
      />
      {notice && (
        <PendingApprovalNotice approvalId={notice.approvalId}>
          {notice.text} {t('approvalNotice.body', { approver: t('approvalNotice.superAdmin') })}
        </PendingApprovalNotice>
      )}
      <ApiErrorNotice error={failure} onReload={() => (setFailure(null), refetch())} />
      <div className="flex flex-wrap items-end gap-3">
        <FormField label={t('common.search')} className="w-full sm:w-60">
          <div className="relative">
            <Search
              size={16}
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted"
            />
            <Input
              type="search"
              className="pl-9"
              placeholder={t('users.searchPlaceholder')}
              value={q}
              onChange={(e) => (setQ(e.target.value), setPage(1))}
            />
          </div>
        </FormField>
        <FormField label={t('common.status')} className="w-full sm:w-44">
          <Select
            value={status}
            onChange={(e) => (setStatus(e.target.value), setPage(1))}
            placeholder={t('common.all')}
            options={STATUSES.map((s) => ({ value: s, label: t(`status.${s}`) }))}
          />
        </FormField>
        <FormField label={t('users.role')} className="w-full sm:w-48">
          <Select
            value={role}
            onChange={(e) => (setRole(e.target.value), setPage(1))}
            placeholder={t('common.all')}
            options={roles.map((r) => ({ value: r.code, label: r.name }))}
          />
        </FormField>
        <FormField label={t('users.branch')} className="w-full sm:w-40">
          <Select
            value={branchId}
            onChange={(e) => (setBranchId(e.target.value), setPage(1))}
            placeholder={t('common.all')}
            options={branches.map((b) => ({ value: b.id, label: b.name }))}
          />
        </FormField>
        <FormField label={t('users.department')} className="w-full sm:w-44">
          <Select
            value={departmentId}
            onChange={(e) => (setDepartmentId(e.target.value), setPage(1))}
            placeholder={t('common.all')}
            options={(depts?.items ?? []).map((d) => ({ value: d.id, label: d.name }))}
          />
        </FormField>
      </div>
      {isError ? (
        <ErrorState
          title={t('users.loadFailed')}
          requestId={apiError(error)?.requestId}
          onRetry={refetch}
        />
      ) : (
        <DataTable
          columns={columns}
          data={items}
          total={data?.total}
          page={page}
          limit={LIMIT}
          onPageChange={setPage}
          loading={isLoading || (isFetching && !items.length)}
          caption={t('users.title')}
          onRowClick={(u) => setOpenId(u.id)}
          empty={
            <EmptyState
              icon={Users}
              bordered={false}
              title={filtered ? t('users.noMatch') : t('users.emptyTitle')}
            />
          }
        />
      )}
      {(openId === 'new' || user) && (
        <UserSheet
          key={openId}
          user={user}
          open
          onOpenChange={(o) => !o && setOpenId('')}
          onDone={onDone}
          onReload={refetch}
        />
      )}
      {resetting && (
        <ResetPasswordDialog user={resetting} onOpenChange={(o) => !o && setResetting(null)} />
      )}
      <ConfirmDialog
        open={Boolean(c)}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={c ? t(`users.confirm.${c.action}.title`, { name: c.user.name }) : ''}
        description={c ? t(`users.confirm.${c.action}.body`) : undefined}
        confirmLabel={c ? t(`users.action.${c.action}`) : ''}
        destructive={c?.action !== 'activate'}
        requireReason={c?.action === 'deactivate' ? true : null}
        onConfirm={(reason) =>
          perform(
            c.user,
            c.action,
            c.action === 'deactivate'
              ? { version: c.user.version, reason }
              : c.action === 'activate'
                ? { version: c.user.version }
                : undefined,
          )
        }
      />
    </Page>
  );
}
