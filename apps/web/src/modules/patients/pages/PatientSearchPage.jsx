import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { Search, UserPlus, Users } from 'lucide-react';
import { addAdminStrings } from '@hms/i18n/admin';
import { addPatientsStrings } from '@hms/i18n/patients';
import {
  AllergyChip,
  Button,
  DataTable,
  EmptyState,
  ErrorState,
  FormField,
  Input,
  Page,
  PageHeader,
  PatientCell,
  StatusBadge,
} from '@hms/ui';
import { apiError } from '../../../app/apiError.js';
import { useCan } from '../../../lib/useCan.js';
import { useDebounced } from '../../../lib/useDebounced.js';
import { useStrings } from '../../../lib/useStrings.js';
import { useUrlState } from '../../../lib/useUrlState.js';
import { useSearchPatientsQuery } from '../api.js';
import { searchHint } from '../patientForm.js';

const LIMIT = 20;

/**
 * Patient search (front desk, spec 5.4 step 1: search before registering): UHID, 4+ digits of
 * a mobile, or a name. The query and page are kept in the URL; a row opens the profile.
 */
export default function PatientSearchPage() {
  useStrings(addAdminStrings, addPatientsStrings);
  const { t } = useTranslation();
  const navigate = useNavigate();
  const can = useCan();
  const [q, setQ] = useUrlState('q', '');
  const [pageText, setPage] = useUrlState('page', '1');
  const page = Math.max(1, Number(pageText) || 1);
  const [text, setText] = useState(q);
  const term = useDebounced(text.trim(), 300);
  const problem = searchHint(term);
  // The URL follows the debounced query (a new query starts at page 1).
  useEffect(() => {
    if (term !== q && (term === '' || !problem)) setQ(term, { reset: ['page'] });
  }, [term, q, problem, setQ]);
  const { data, isFetching, isLoading, isError, error, refetch } = useSearchPatientsQuery(
    { q: term, page, limit: LIMIT },
    { skip: Boolean(problem) },
  );
  const items = useMemo(() => (problem ? [] : (data?.items ?? [])), [data, problem]);
  const canCreate = can('patients:patient:create');
  const register = () =>
    navigate(`/patients/new${term && !problem ? `?q=${encodeURIComponent(term)}` : ''}`);

  const columns = useMemo(
    () => [
      {
        id: 'patient',
        header: t('patients.search.patient'),
        cell: ({ row }) => (
          <PatientCell
            name={row.original.name}
            uhid={row.original.uhid}
            age={row.original.age}
            sex={row.original.gender}
          />
        ),
      },
      {
        id: 'mobile',
        header: t('patients.form.mobile'),
        meta: { mono: true },
        cell: ({ row }) => row.original.mobile,
      },
      {
        id: 'allergies',
        header: t('patient.allergies'),
        cell: ({ row }) =>
          row.original.allergies?.length ? (
            <span className="flex flex-wrap gap-1">
              {row.original.allergies.map((a) => (
                <AllergyChip key={a} name={a} />
              ))}
            </span>
          ) : (
            <span className="text-muted">-</span>
          ),
      },
      {
        id: 'flags',
        header: t('patients.search.flags'),
        cell: ({ row }) => {
          const f = row.original.flags ?? {};
          if (!f.vip && !f.mlc) return <span className="text-muted">-</span>;
          return (
            <span className="flex flex-wrap gap-1">
              {f.vip && <StatusBadge tone="info" icon={false} label={t('patients.flags.vip')} />}
              {f.mlc && <StatusBadge tone="warning" label={t('patients.flags.mlc')} />}
            </span>
          );
        },
      },
    ],
    [t],
  );

  let body;
  if (problem === 'empty') {
    body = (
      <EmptyState
        icon={Search}
        title={t('patients.search.startTitle')}
        description={t('patients.search.startBody')}
      />
    );
  } else if (problem) {
    body = (
      <EmptyState
        icon={Search}
        title={t(problem === 'digits' ? 'patients.search.digits' : 'patients.search.short')}
      />
    );
  } else if (isError) {
    body = (
      <ErrorState
        title={t('patients.search.failed')}
        requestId={apiError(error)?.requestId}
        onRetry={refetch}
      />
    );
  } else {
    body = (
      <DataTable
        columns={columns}
        data={items}
        total={data?.total}
        page={page}
        limit={LIMIT}
        onPageChange={(p) => setPage(String(p))}
        loading={isLoading || (isFetching && !items.length)}
        caption={t('patients.search.results')}
        onRowClick={(p) => navigate(`/patients/${p.id}`)}
        empty={
          <EmptyState
            icon={Users}
            bordered={false}
            title={t('patients.search.none', { q: term })}
            description={canCreate ? t('patients.search.noneRegister') : undefined}
            action={
              canCreate && (
                <Button icon={<UserPlus size={16} aria-hidden="true" />} onClick={register}>
                  {t('patients.register')}
                </Button>
              )
            }
          />
        }
      />
    );
  }

  return (
    <Page>
      <PageHeader
        title={t('patients.search.title')}
        description={t('patients.search.description')}
        actions={
          canCreate && (
            <Button icon={<UserPlus size={16} aria-hidden="true" />} onClick={register}>
              {t('patients.register')}
            </Button>
          )
        }
      />
      <form
        role="search"
        onSubmit={(e) => e.preventDefault()}
        className="flex flex-wrap items-end gap-3"
      >
        <FormField
          label={t('common.search')}
          hint={t('patients.search.hint')}
          className="w-full sm:w-96"
        >
          <div className="relative">
            <Search
              size={16}
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted"
            />
            <Input
              type="search"
              className="pl-9"
              autoFocus
              autoComplete="off"
              placeholder={t('patients.search.placeholder')}
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
          </div>
        </FormField>
      </form>
      {body}
    </Page>
  );
}
