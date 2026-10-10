import { useTranslation } from 'react-i18next';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import {
  Banner,
  Button,
  Card,
  ErrorState,
  Loading,
  Page,
  PageHeader,
  SplitView,
  cn,
  useToast,
} from '@hms/ui';
import { apiError } from '../../../app/apiError.js';
import { useCan } from '../../../lib/useCan.js';
import { useUrlState } from '../../../lib/useUrlState.js';
import { PendingApprovalNotice } from '../../../components/PendingApprovalNotice.jsx';
import { Status } from '../../../components/Status.jsx';
import { usePermissionCatalogQuery, useRolesQuery } from '../api.js';
import { RoleEditor } from '../components/RoleEditor.jsx';
import { useAdminStrings } from '../../../lib/useAdminStrings.js';

/**
 * Roles and access (design board "Roles", spec 4.4): system roles (read-only) and custom roles
 * copied from them. Permission changes are maker-checker: they apply after Super Admin approval.
 */
export default function RolesPage() {
  useAdminStrings();
  const { t } = useTranslation();
  const { toast } = useToast();
  const can = useCan();
  const { data: roles = [], isLoading, isError, error, refetch } = useRolesQuery();
  const { data: catalog = [], isLoading: loadingCatalog } = usePermissionCatalogQuery();
  const [selected, setSelected] = useUrlState('role', '');
  const [from, setFrom] = useUrlState('from', '');
  const [notice, setNotice] = useState(null);
  const systemRoles = roles.filter((r) => r.isSystem);
  const isNew = selected === 'new';
  const role = isNew ? null : (roles.find((r) => r.id === selected) ?? roles[0] ?? null);
  const base = isNew ? systemRoles.find((r) => r.code === from) : null;

  const onDone = ({ name, approvalId, created, id, deactivated }) => {
    if (approvalId)
      setNotice({ approvalId, text: t(created ? 'roles.sentNew' : 'roles.sentChange', { name }) });
    else
      toast({
        title: t(deactivated ? 'roles.deactivated' : 'roles.saved', { name }),
        tone: 'success',
      });
    if (created && id) {
      setFrom('');
      setSelected(id);
    }
  };

  const copy = (r) => {
    setFrom(r.code);
    setSelected('new');
  };

  if (isError)
    return (
      <Page>
        <ErrorState
          title={t('roles.loadFailed')}
          requestId={apiError(error)?.requestId}
          onRetry={refetch}
        />
      </Page>
    );

  return (
    <Page>
      <PageHeader
        title={t('roles.title')}
        description={t('roles.description')}
        actions={
          can('settings:role:create') && (
            <Button
              variant="secondary"
              icon={<Plus size={16} aria-hidden="true" />}
              onClick={() => (setFrom(''), setSelected('new'))}
            >
              {t('roles.new')}
            </Button>
          )
        }
      />
      <Banner tone="warning" title={t('roles.makerChecker')}>
        {t('roles.makerCheckerBody')}
      </Banner>
      {notice && (
        <PendingApprovalNotice approvalId={notice.approvalId}>
          {notice.text} {t('approvalNotice.body', { approver: t('approvalNotice.superAdmin') })}
        </PendingApprovalNotice>
      )}
      {isLoading || loadingCatalog ? (
        <Loading rows={6} />
      ) : (
        <SplitView
          list={
            <Card title={t('roles.list')} padding={false}>
              <ul className="flex max-h-[70vh] flex-col gap-0.5 overflow-y-auto p-2">
                {roles.map((r) => {
                  const active = !isNew && role?.id === r.id;
                  return (
                    <li key={r.id}>
                      <button
                        type="button"
                        aria-current={active ? 'true' : undefined}
                        onClick={() => (setFrom(''), setSelected(r.id))}
                        className={cn(
                          'flex w-full cursor-pointer items-center justify-between gap-2 rounded-control px-3 py-2 text-left',
                          active ? 'bg-info-bg font-semibold' : 'hover:bg-surface-2',
                        )}
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-ink">{r.name}</span>
                          <span className="block text-xs text-muted">
                            {r.isSystem ? t('roles.system') : t('roles.custom')} ·{' '}
                            {t('roles.users', { count: r.userCount })}
                          </span>
                        </span>
                        {r.status !== 'ACTIVE' && <Status kind="role" code={r.status} />}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </Card>
          }
          detail={
            (role || isNew) && (
              <RoleEditor
                key={isNew ? `new-${from}` : `${role.id}-${role.version}`}
                role={role}
                base={base}
                systemRoles={systemRoles}
                catalog={catalog}
                onCopy={copy}
                onDone={onDone}
                onReload={refetch}
              />
            )
          }
        />
      )}
    </Page>
  );
}
