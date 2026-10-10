import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { shiftOpenInput } from '@hms/shared/schemas';
import { translateValidation } from '@hms/i18n';
import { addAdminStrings } from '@hms/i18n/admin';
import { addBillingStrings } from '@hms/i18n/billing';
import { History, LockOpen } from 'lucide-react';
import {
  Banner,
  Button,
  Card,
  DataTable,
  Dialog,
  EmptyState,
  ErrorState,
  FormField,
  Input,
  Loading,
  Page,
  PageHeader,
  Select,
  StatTile,
  StatusBadge,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Textarea,
  formatDateTime,
  formatTime,
  useToast,
} from '@hms/ui';
import { apiError } from '../../../app/apiError.js';
import { ApiErrorNotice } from '../../../components/ApiErrorNotice.jsx';
import { useCan } from '../../../lib/useCan.js';
import { inr, inrExact, parseRupees, rupeesForApi } from '../../../lib/money.js';
import { useStrings } from '../../../lib/useStrings.js';
import { useUrlState } from '../../../lib/useUrlState.js';
import {
  useCurrentShiftQuery,
  useOpenShiftMutation,
  usePaymentsQuery,
  useShiftsQuery,
  useVerifyShiftMutation,
} from '../api.js';
import { SHIFT_TONES } from '../billing.js';
import { MoneyInput } from '../components/MoneyInput.jsx';
import { ShiftClose, Variance } from '../components/ShiftClose.jsx';

/** Open my shift at a counter with the opening float (rule R10: one cashier, one drawer). */
function OpenShift() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [open, { isLoading }] = useOpenShiftMutation();
  const [counter, setCounter] = useState('');
  const [float, setFloat] = useState('');
  const [errors, setErrors] = useState({});
  const [failure, setFailure] = useState(null);
  const submit = async (e) => {
    e.preventDefault();
    setFailure(null);
    const paise = parseRupees(float);
    const parsed = shiftOpenInput.safeParse({
      counter,
      openingCash: Number.isFinite(paise) && paise !== null ? rupeesForApi(paise) : -1,
    });
    if (!parsed.success) {
      const next = {};
      for (const i of parsed.error.issues)
        next[i.path[0]] ??=
          i.path[0] === 'openingCash'
            ? t('billing.shift.floatError')
            : translateValidation(t, i.message);
      setErrors(next);
      return;
    }
    setErrors({});
    try {
      const s = await open({
        counter: counter.trim().toUpperCase(),
        openingCash: rupeesForApi(paise),
      }).unwrap();
      toast({ title: t('billing.shift.opened', { counter: s.counter }), tone: 'success' });
    } catch (err) {
      setFailure(err);
    }
  };
  return (
    <Card
      title={t('billing.shift.openTitle')}
      description={t('billing.shift.openHint')}
      headingLevel={2}
      className="max-w-xl"
    >
      <form onSubmit={submit} noValidate className="flex flex-col gap-4">
        <ApiErrorNotice error={failure} />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField
            label={t('billing.shift.counter')}
            hint={t('billing.shift.counterHint')}
            error={errors.counter}
            required
          >
            <Input
              mono
              autoComplete="off"
              autoCapitalize="characters"
              value={counter}
              onChange={(e) => setCounter(e.target.value.toUpperCase())}
            />
          </FormField>
          <FormField
            label={t('billing.shift.float')}
            hint={t('billing.shift.floatHint')}
            error={errors.openingCash}
            required
          >
            <MoneyInput value={float} onChange={(e) => setFloat(e.target.value)} />
          </FormField>
        </div>
        <Button
          type="submit"
          loading={isLoading}
          icon={<LockOpen size={16} aria-hidden="true" />}
          className="self-start"
        >
          {t('billing.shift.open')}
        </Button>
      </form>
    </Card>
  );
}

/** This shift: the amounts expected per mode, receipts taken, then the close form. */
function CurrentShift() {
  const { t, i18n } = useTranslation();
  const can = useCan();
  const locale = i18n.language === 'hi' ? 'hi-IN' : 'en-IN';
  const { data: shift, isLoading, isError, error, refetch } = useCurrentShiftQuery();
  const { data: receipts } = usePaymentsQuery(
    { shiftId: shift?.id, limit: 1 },
    { skip: !shift || !can('billing:payment:read') },
  );
  const [closed, setClosed] = useState(null);
  if (isLoading) return <Loading rows={4} />;
  if (isError)
    return (
      <ErrorState
        title={t('billing.shift.failed')}
        requestId={apiError(error)?.requestId}
        onRetry={refetch}
      />
    );
  if (closed)
    return (
      <Banner
        tone={closed.status === 'VERIFIED' ? 'success' : 'warning'}
        title={t(`billing.shift.closed.${closed.status}`)}
      >
        {t('billing.shift.closedBody', {
          counter: closed.counter,
          cash: inr(closed.counted?.cash ?? 0),
          variance: inr(closed.cashVariance ?? 0),
        })}
      </Banner>
    );
  if (!shift)
    return can('billing:shift:open') ? (
      <OpenShift />
    ) : (
      <EmptyState title={t('billing.shift.noneTitle')} />
    );
  const expected = shift.expected ?? {};
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          label={t('billing.shift.counter')}
          value={<span className="font-mono">{shift.counter}</span>}
          sub={t('billing.shift.since', { time: formatTime(shift.openedAt, locale) })}
        />
        <StatTile label={t('billing.shift.float')} value={inr(shift.openingCash)} />
        <StatTile
          label={t('billing.shift.expectedCashTile')}
          value={inr(expected.CASH ?? shift.openingCash)}
        />
        <StatTile
          label={t('billing.shift.receipts')}
          value={receipts?.total ?? '-'}
          sub={Object.entries(expected)
            .filter(([m]) => m !== 'CASH')
            .map(([m, v]) => `${t(`billing.modeKinds.${m}`, { defaultValue: m })} ${inr(v)}`)
            .join(' · ')}
        />
      </div>
      {can('billing:shift:close') && (
        <ShiftClose key={shift.version} shift={shift} onClosed={setClosed} />
      )}
    </div>
  );
}

/** Verify one counted shift with a variance (Billing Manager; never their own shift). */
function VerifyDialog({ shift, onOpenChange }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [verify, { isLoading }] = useVerifyShiftMutation();
  const [comment, setComment] = useState('');
  const [failure, setFailure] = useState(null);
  const submit = async (e) => {
    e.preventDefault();
    setFailure(null);
    try {
      await verify({
        id: shift.id,
        version: shift.version,
        comment: comment.trim() || undefined,
      }).unwrap();
      toast({ title: t('billing.verify.done', { name: shift.userName }), tone: 'success' });
      onOpenChange(false);
    } catch (err) {
      setFailure(err);
    }
  };
  return (
    <Dialog
      open
      onOpenChange={onOpenChange}
      size="md"
      title={t('billing.verify.title', { name: shift.userName, counter: shift.counter })}
    >
      <form onSubmit={submit} noValidate className="flex flex-col gap-4">
        <ApiErrorNotice error={failure} />
        <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1.5 text-base">
          <dt className="text-muted">{t('billing.shift.expectedCashTile')}</dt>
          <dd className="tabular">{inrExact(shift.expected?.CASH ?? 0)}</dd>
          <dt className="text-muted">{t('billing.shift.counted')}</dt>
          <dd className="tabular">{inrExact(shift.counted?.cash ?? 0)}</dd>
          <dt className="text-muted">{t('billing.shift.varianceCash')}</dt>
          <dd>
            <Variance paise={shift.cashVariance ?? 0} />
          </dd>
          <dt className="text-muted">{t('billing.shift.reason')}</dt>
          <dd>{shift.varianceReason ?? '-'}</dd>
        </dl>
        <FormField label={t('billing.verify.comment')} optional>
          <Textarea rows={2} value={comment} onChange={(e) => setComment(e.target.value)} />
        </FormField>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" loading={isLoading}>
            {t('billing.verify.submit')}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

/** Shifts in this branch: day-end verification (status COUNTED) or the history. */
function ShiftsList({ status, verify = false }) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'hi' ? 'hi-IN' : 'en-IN';
  const [page, setPage] = useState(1);
  const [checking, setChecking] = useState(null);
  const { data, isLoading, isFetching, isError, error, refetch } = useShiftsQuery({
    status: status || undefined,
    page,
    limit: 25,
  });
  const items = useMemo(() => data?.items ?? [], [data]);
  const columns = useMemo(
    () => [
      {
        id: 'cashier',
        header: t('billing.verify.cashier'),
        cell: ({ row }) => row.original.userName,
      },
      {
        id: 'counter',
        header: t('billing.shift.counter'),
        meta: { mono: true },
        cell: ({ row }) => row.original.counter,
      },
      {
        id: 'when',
        header: t('billing.verify.when'),
        cell: ({ row }) =>
          `${formatDateTime(row.original.openedAt, locale)}${row.original.closedAt ? ` – ${formatTime(row.original.closedAt, locale)}` : ''}`,
      },
      {
        id: 'expected',
        header: t('billing.shift.expectedCashTile'),
        meta: { align: 'right' },
        cell: ({ row }) =>
          row.original.expected ? inrExact(row.original.expected.CASH ?? 0) : '-',
      },
      {
        id: 'counted',
        header: t('billing.shift.counted'),
        meta: { align: 'right' },
        cell: ({ row }) => (row.original.counted ? inrExact(row.original.counted.cash ?? 0) : '-'),
      },
      {
        id: 'variance',
        header: t('billing.shift.varianceCash'),
        meta: { align: 'right' },
        cell: ({ row }) =>
          row.original.cashVariance != null ? <Variance paise={row.original.cashVariance} /> : '-',
      },
      {
        id: 'status',
        header: t('common.status'),
        cell: ({ row }) => (
          <StatusBadge
            tone={SHIFT_TONES[row.original.status] ?? 'neutral'}
            label={t(`billing.shift.status.${row.original.status}`)}
          />
        ),
      },
      ...(verify
        ? [
            {
              id: 'actions',
              header: <span className="sr-only">{t('common.actions')}</span>,
              meta: { align: 'right' },
              cell: ({ row }) =>
                row.original.status === 'COUNTED' && (
                  <Button size="sm" onClick={() => setChecking(row.original)}>
                    {t('billing.verify.action')}
                  </Button>
                ),
            },
          ]
        : []),
    ],
    [t, locale, verify],
  );
  if (isError)
    return (
      <ErrorState
        title={t('billing.shift.listFailed')}
        requestId={apiError(error)?.requestId}
        onRetry={refetch}
      />
    );
  return (
    <>
      <DataTable
        columns={columns}
        data={items}
        total={data?.total}
        page={page}
        limit={25}
        onPageChange={setPage}
        loading={isLoading || (isFetching && !items.length)}
        caption={verify ? t('billing.shift.tabs.verify') : t('billing.shift.tabs.history')}
        empty={
          <EmptyState
            icon={History}
            bordered={false}
            title={verify ? t('billing.verify.empty') : t('billing.shift.historyEmpty')}
          />
        }
      />
      {checking && <VerifyDialog shift={checking} onOpenChange={(o) => !o && setChecking(null)} />}
    </>
  );
}

function HistoryTab() {
  const { t } = useTranslation();
  const [status, setStatus] = useUrlState('status', '');
  return (
    <div className="flex flex-col gap-4">
      <FormField label={t('common.status')} className="w-full sm:w-48">
        <Select
          value={status}
          placeholder={t('common.all')}
          onChange={(e) => setStatus(e.target.value)}
          options={['OPEN', 'COUNTED', 'VERIFIED'].map((s) => ({
            value: s,
            label: t(`billing.shift.status.${s}`),
          }))}
        />
      </FormField>
      <ShiftsList status={status} />
    </div>
  );
}

/**
 * Cashier shift and day-end (design board "BillShift", rules R10, R11): open with the opening
 * float, close with the cash counted by note and device totals, and (Billing Manager) verify
 * shifts with a variance. Tabs are kept in the URL.
 */
export default function ShiftPage() {
  useStrings(addAdminStrings, addBillingStrings);
  const { t } = useTranslation();
  const can = useCan();
  const tabs = [
    (can('billing:shift:open') || can('billing:shift:close')) && {
      id: 'current',
      label: t('billing.shift.tabs.current'),
      body: <CurrentShift />,
    },
    can('billing:shift:verify') && {
      id: 'verify',
      label: t('billing.shift.tabs.verify'),
      body: <ShiftsList status="COUNTED" verify />,
    },
    { id: 'history', label: t('billing.shift.tabs.history'), body: <HistoryTab /> },
  ].filter(Boolean);
  const [tab, setTab] = useUrlState('tab', tabs[0].id);
  const current = tabs.some((x) => x.id === tab) ? tab : tabs[0].id;
  return (
    <Page>
      <PageHeader title={t('billing.shift.title')} description={t('billing.shift.description')} />
      <Tabs value={current} onValueChange={(v) => setTab(v, { reset: ['status'] })}>
        <TabsList aria-label={t('billing.shift.tabs.label')}>
          {tabs.map((x) => (
            <TabsTrigger key={x.id} value={x.id}>
              {x.label}
            </TabsTrigger>
          ))}
        </TabsList>
        {tabs.map((x) => (
          <TabsContent key={x.id} value={x.id}>
            {current === x.id && x.body}
          </TabsContent>
        ))}
      </Tabs>
    </Page>
  );
}
