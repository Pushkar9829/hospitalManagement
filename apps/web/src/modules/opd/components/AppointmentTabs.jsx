import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { Banner, Button, Card, StatusBadge, useToast } from '@hms/ui';
import { FormDialog } from '../../dx-kit/FormDialog.jsx';
import { RecordsTable } from '../../dx-kit/RecordsTable.jsx';
import { fmtDateTime, localeOf } from '../../dx-kit/format.js';
import { inr, paiseFrom } from '../../../lib/money.js';
import { useCan } from '../../../lib/useCan.js';
import {
  useAddResourceMutation,
  useAddTreatmentPlanMutation,
  useBookCheckupMutation,
  useHealthCheckupsQuery,
  useImportCheckupsMutation,
  useOpdResourcesQuery,
  useOpdSchedulesQuery,
  useStartTeleConsultMutation,
  useTeleConsultsQuery,
  useTreatmentPlansQuery,
} from '../api.js';
import { daysText, firstSession, sessionsText } from '../schedule.js';
import { BlockLeaveDialog } from './BlockLeaveDialog.jsx';

const PACKAGES = ['Executive health check', 'Pre-employment', 'Women’s wellness', 'Senior citizen'];

/** Doctor schedule templates (read here; edited under OPD settings). */
export function DoctorSchedulesTab() {
  const { t } = useTranslation();
  const can = useCan();
  const [blocking, setBlocking] = useState(false);
  const columns = useMemo(
    () => [
      { id: 'doctor', header: t('opd.sched.doctor'), cell: ({ row }) => row.original.doctor.name },
      { id: 'days', header: t('opd.sched.days'), cell: ({ row }) => daysText(t, row.original.week) },
      {
        id: 'session',
        header: t('opd.sched.session'),
        cell: ({ row }) => sessionsText(t, row.original.week),
      },
      {
        id: 'room',
        header: t('opd.sched.room'),
        cell: ({ row }) => t('opd.cal.room', { room: row.original.doctor.room }),
      },
      {
        id: 'slot',
        header: t('opd.sched.slot'),
        cell: ({ row }) => {
          const s = firstSession(row.original.week);
          return s ? t('opd.sched.minutes', { n: s.slotNew }) : '-';
        },
      },
      {
        id: 'max',
        header: t('opd.sched.max'),
        meta: { align: 'right' },
        cell: ({ row }) => firstSession(row.original.week)?.max ?? '-',
      },
      {
        id: 'fee',
        header: t('opd.sched.newFee'),
        meta: { align: 'right' },
        cell: ({ row }) => inr(row.original.fees.NEW),
      },
      {
        id: 'followUp',
        header: t('opd.sched.followUp'),
        cell: ({ row }) =>
          row.original.followUp.days
            ? t('opd.sched.freeWithin', { days: row.original.followUp.days })
            : t('opd.sched.paid'),
      },
    ],
    [t],
  );
  return (
    <Card
      title={t('opd.sched.title')}
      actions={
        can('opd:schedule:update') && (
          <>
            <Link
              to="/settings/opd"
              className="inline-flex min-h-10 items-center rounded-control bg-primary px-4 font-semibold text-on-primary hover:bg-primary-hover"
            >
              {t('opd.sched.new')}
            </Link>
            <Button variant="secondary" onClick={() => setBlocking(true)}>
              {t('opd.sched.blockLeave')}
            </Button>
          </>
        )
      }
      padding={false}
    >
      <RecordsTable
        useQuery={useOpdSchedulesQuery}
        columns={columns}
        caption={t('opd.sched.title')}
        emptyTitle={t('opd.sched.empty')}
      />
      <BlockLeaveDialog open={blocking} onOpenChange={setBlocking} />
    </Card>
  );
}

const checkupSchema = (t) =>
  z.object({
    patient: z.looseObject({ id: z.string() }, { error: t('opd.book.errors.patient') }),
    package: z.string().min(1, t('opd.checkup.errors.package')),
    company: z.string().max(80).optional(),
  });

const importSchema = (t) =>
  z.object({
    company: z.string().trim().min(2, t('opd.checkup.errors.company')),
    csv: z.string().trim().min(10, t('opd.checkup.errors.csv')),
  });

/** Health check-ups in progress today: stations done, next station and report state. */
export function CheckupsTab() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const can = useCan();
  const [dialog, setDialog] = useState(null);
  const [bookCheckup] = useBookCheckupMutation();
  const [importCheckups] = useImportCheckupsMutation();
  const columns = useMemo(
    () => [
      { id: 'person', header: t('opd.checkup.person'), cell: ({ row }) => row.original.patient.name },
      { accessorKey: 'package', header: t('opd.checkup.package') },
      {
        id: 'company',
        header: t('opd.checkup.company'),
        cell: ({ row }) => row.original.company ?? '-',
      },
      {
        id: 'stations',
        header: t('opd.checkup.stations'),
        cell: ({ row }) =>
          t('opd.checkup.of', { done: row.original.stationsDone, total: row.original.stations }),
      },
      {
        id: 'next',
        header: t('opd.checkup.next'),
        cell: ({ row }) => row.original.nextStation ?? '-',
      },
      {
        id: 'report',
        header: t('opd.checkup.report'),
        cell: ({ row }) => (
          <StatusBadge
            tone={row.original.report === 'PENDING' ? 'neutral' : 'warning'}
            label={t(`opd.checkup.reportStatus.${row.original.report}`)}
          />
        ),
      },
    ],
    [t],
  );
  return (
    <Card
      title={t('opd.checkup.title')}
      padding={false}
      actions={
        can('opd:appointment:create') && (
          <>
            <Button onClick={() => setDialog('book')}>{t('opd.checkup.book')}</Button>
            <Button variant="secondary" onClick={() => setDialog('import')}>
              {t('opd.checkup.bulk')}
            </Button>
          </>
        )
      }
    >
      <RecordsTable
        useQuery={useHealthCheckupsQuery}
        columns={columns}
        caption={t('opd.checkup.title')}
        emptyTitle={t('opd.checkup.empty')}
      />
      <FormDialog
        open={dialog === 'book'}
        onOpenChange={(o) => setDialog(o ? 'book' : null)}
        title={t('opd.checkup.book')}
        schema={checkupSchema(t)}
        defaultValues={{ patient: null, package: PACKAGES[0], company: '' }}
        fields={[
          { name: 'patient', label: t('opd.book.patient'), type: 'patient' },
          {
            name: 'package',
            label: t('opd.checkup.package'),
            type: 'select',
            options: PACKAGES.map((p) => ({ value: p, label: p })),
            required: true,
          },
          { name: 'company', label: t('opd.checkup.company'), optional: true },
        ]}
        submitLabel={t('opd.checkup.book')}
        onSubmit={(v) => bookCheckup(v).unwrap()}
        onDone={(_r, v) =>
          toast({ tone: 'success', title: t('opd.checkup.booked', { name: v.patient.name }) })
        }
      />
      <FormDialog
        open={dialog === 'import'}
        onOpenChange={(o) => setDialog(o ? 'import' : null)}
        title={t('opd.checkup.bulk')}
        description={t('opd.checkup.bulkHint')}
        schema={importSchema(t)}
        defaultValues={{ company: '', csv: 'name,mobile,package,date\n' }}
        fields={[
          { name: 'company', label: t('opd.checkup.company'), required: true },
          { name: 'csv', label: t('opd.checkup.csv'), type: 'textarea', rows: 6, required: true },
        ]}
        submitLabel={t('opd.checkup.upload')}
        onSubmit={(v) => importCheckups(v).unwrap()}
        onDone={(r) =>
          toast({
            tone: 'success',
            title: t('opd.checkup.imported', { booked: r.booked, received: r.received }),
          })
        }
      />
    </Card>
  );
}

const TELE_TONE = { WAITING_ROOM: 'info', SCHEDULED: 'neutral', IN_CALL: 'warning', DONE: 'success' };

/** Tele-consultations booked for today, with the paid fee, the stored consent and the status. */
export function TeleTab() {
  const { t } = useTranslation();
  const can = useCan();
  const [start, { isLoading }] = useStartTeleConsultMutation();
  const [joined, setJoined] = useState(null);
  const query = useTeleConsultsQuery();
  const next = query.data?.items.find((x) => x.status === 'WAITING_ROOM');
  const columns = useMemo(
    () => [
      { accessorKey: 'time', header: t('opd.tele.time'), meta: { mono: true } },
      { id: 'patient', header: t('opd.book.patient'), cell: ({ row }) => row.original.patient.name },
      { id: 'doctor', header: t('opd.book.doctor'), cell: ({ row }) => row.original.doctor.name },
      {
        id: 'paid',
        header: t('opd.tele.paid'),
        cell: ({ row }) => <StatusBadge tone="success" label={inr(row.original.paid)} />,
      },
      {
        id: 'consent',
        header: t('opd.tele.consent'),
        cell: ({ row }) =>
          row.original.consent ? (
            <StatusBadge tone="success" label={t('opd.tele.recorded')} />
          ) : (
            <StatusBadge tone="warning" label={t('opd.tele.noConsent')} />
          ),
      },
      {
        id: 'status',
        header: t('opd.tele.status'),
        cell: ({ row }) => (
          <StatusBadge
            tone={TELE_TONE[row.original.status]}
            label={t(`opd.tele.statuses.${row.original.status}`)}
          />
        ),
      },
    ],
    [t],
  );
  return (
    <Card
      title={t('opd.tele.title')}
      description={t('opd.tele.sub')}
      padding={false}
      actions={
        can('opd:consultation:write') && (
          <Button
            disabled={!next}
            loading={isLoading}
            onClick={async () => setJoined(await start({ id: next.id }).unwrap())}
          >
            {t('opd.tele.startNext')}
          </Button>
        )
      }
    >
      {joined && (
        <Banner tone="success" className="m-4" title={t('opd.tele.started')}>
          <a
            href={joined.joinUrl}
            target="_blank"
            rel="noreferrer"
            className="font-mono underline underline-offset-2"
          >
            {joined.joinUrl}
          </a>
        </Banner>
      )}
      <RecordsTable
        useQuery={useTeleConsultsQuery}
        columns={columns}
        caption={t('opd.tele.title')}
        emptyTitle={t('opd.tele.empty')}
      />
    </Card>
  );
}

const planSchema = (t) =>
  z
    .object({
      patient: z.looseObject({ id: z.string() }, { error: t('opd.book.errors.patient') }),
      plan: z.string().trim().min(3, t('opd.plan.errors.plan')),
      sessions: z.coerce.number().int().min(1, t('opd.plan.errors.sessions')).max(60),
      firstSession: z.string().min(1, t('opd.plan.errors.first')),
      billing: z.enum(['PACKAGE', 'PER_SESSION']),
      amount: z.string().optional(),
    })
    .superRefine((v, ctx) => {
      if (v.billing === 'PACKAGE' && !(paiseFrom(v.amount) > 0))
        ctx.addIssue({ code: 'custom', path: ['amount'], message: t('opd.plan.errors.amount') });
    });

/** Multi-session treatment plans (physiotherapy, dental, laser). */
export function PlansTab() {
  const { t, i18n } = useTranslation();
  const { toast } = useToast();
  const can = useCan();
  const [open, setOpen] = useState(false);
  const [add] = useAddTreatmentPlanMutation();
  const columns = useMemo(
    () => [
      { id: 'patient', header: t('opd.book.patient'), cell: ({ row }) => row.original.patient.name },
      { accessorKey: 'plan', header: t('opd.plan.plan') },
      { accessorKey: 'sessions', header: t('opd.plan.sessions'), meta: { align: 'right' } },
      { accessorKey: 'done', header: t('opd.plan.done'), meta: { align: 'right' } },
      {
        id: 'next',
        header: t('opd.plan.next'),
        cell: ({ row }) => fmtDateTime(row.original.nextSession, localeOf(i18n)) || '-',
      },
      {
        id: 'billing',
        header: t('opd.plan.billing'),
        cell: ({ row }) =>
          row.original.billing === 'PACKAGE'
            ? t('opd.plan.package', { amount: inr(row.original.amount) })
            : t('opd.plan.perSession'),
      },
    ],
    [t, i18n],
  );
  return (
    <Card
      title={t('opd.plan.title')}
      padding={false}
      actions={
        can('opd:appointment:create') && (
          <Button onClick={() => setOpen(true)}>{t('opd.plan.new')}</Button>
        )
      }
    >
      <RecordsTable
        useQuery={useTreatmentPlansQuery}
        columns={columns}
        caption={t('opd.plan.title')}
        emptyTitle={t('opd.plan.empty')}
      />
      <FormDialog
        open={open}
        onOpenChange={setOpen}
        title={t('opd.plan.new')}
        schema={planSchema(t)}
        defaultValues={{
          patient: null,
          plan: '',
          sessions: '6',
          firstSession: '',
          billing: 'PACKAGE',
          amount: '',
        }}
        fields={[
          { name: 'patient', label: t('opd.book.patient'), type: 'patient' },
          { name: 'plan', label: t('opd.plan.plan'), required: true, span: 2 },
          { name: 'sessions', label: t('opd.plan.sessions'), type: 'number', required: true },
          {
            name: 'firstSession',
            label: t('opd.plan.first'),
            type: 'datetime-local',
            required: true,
          },
          {
            name: 'billing',
            label: t('opd.plan.billing'),
            type: 'select',
            options: [
              { value: 'PACKAGE', label: t('opd.plan.packageOption') },
              { value: 'PER_SESSION', label: t('opd.plan.perSession') },
            ],
          },
          { name: 'amount', label: t('opd.plan.amount'), hint: t('opd.plan.amountHint') },
        ]}
        submitLabel={t('opd.plan.create')}
        onSubmit={(v) =>
          add({
            patient: v.patient,
            plan: v.plan,
            sessions: v.sessions,
            firstSession: v.firstSession,
            billing: v.billing,
            amount: v.billing === 'PACKAGE' ? paiseFrom(v.amount) : null,
          }).unwrap()
        }
        onDone={(_r, v) =>
          toast({ tone: 'success', title: t('opd.plan.created', { name: v.patient.name }) })
        }
      />
    </Card>
  );
}

const resourceSchema = (t) =>
  z.object({
    name: z.string().trim().min(2, t('opd.res.errors.name')),
    type: z.enum(['ROOM', 'EQUIPMENT', 'THERAPIST']),
    bookableFor: z.string().trim().min(2, t('opd.res.errors.for')),
    slots: z.coerce.number().int().min(1, t('opd.res.errors.slots')).max(96),
  });

/** Bookable rooms, equipment and therapists with today's use. */
export function ResourcesTab() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const can = useCan();
  const [open, setOpen] = useState(false);
  const [add] = useAddResourceMutation();
  const columns = useMemo(
    () => [
      { accessorKey: 'name', header: t('opd.res.name') },
      { id: 'type', header: t('opd.res.type'), cell: ({ row }) => t(`opd.res.types.${row.original.type}`) },
      { accessorKey: 'bookableFor', header: t('opd.res.for') },
      {
        id: 'booked',
        header: t('opd.res.today'),
        cell: ({ row }) =>
          t('opd.res.ofSlots', { booked: row.original.booked, slots: row.original.slots }),
      },
      {
        id: 'status',
        header: t('opd.res.status'),
        cell: ({ row }) => {
          const full = row.original.booked / row.original.slots;
          return full >= 1 ? (
            <StatusBadge tone="critical" label={t('opd.res.full')} />
          ) : full >= 0.85 ? (
            <StatusBadge tone="warning" label={t('opd.res.nearlyFull')} />
          ) : (
            <StatusBadge tone="success" label={t('opd.res.available')} />
          );
        },
      },
    ],
    [t],
  );
  return (
    <Card
      title={t('opd.res.title')}
      padding={false}
      actions={
        can('opd:settings:update') && (
          <Button onClick={() => setOpen(true)}>{t('opd.res.add')}</Button>
        )
      }
    >
      <RecordsTable
        useQuery={useOpdResourcesQuery}
        columns={columns}
        caption={t('opd.res.title')}
        emptyTitle={t('opd.res.empty')}
      />
      <FormDialog
        open={open}
        onOpenChange={setOpen}
        title={t('opd.res.add')}
        schema={resourceSchema(t)}
        defaultValues={{ name: '', type: 'ROOM', bookableFor: '', slots: '12' }}
        fields={[
          { name: 'name', label: t('opd.res.name'), required: true },
          {
            name: 'type',
            label: t('opd.res.type'),
            type: 'select',
            options: ['ROOM', 'EQUIPMENT', 'THERAPIST'].map((x) => ({
              value: x,
              label: t(`opd.res.types.${x}`),
            })),
          },
          { name: 'bookableFor', label: t('opd.res.for'), required: true },
          { name: 'slots', label: t('opd.res.slots'), type: 'number', required: true },
        ]}
        submitLabel={t('opd.res.add')}
        onSubmit={(v) => add(v).unwrap()}
        onDone={(_r, v) => toast({ tone: 'success', title: t('opd.res.added', { name: v.name }) })}
      />
    </Card>
  );
}
