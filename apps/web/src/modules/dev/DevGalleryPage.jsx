import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Plus, Printer, Search, Trash2 } from 'lucide-react';
import { APPROVAL_STATUS, BED_STATUS, BILL_STATUS, TENANT_STATUS, USER_STATUS } from '@hms/shared';
import { LANGUAGES } from '@hms/i18n';
import {
  AllergyChip,
  ApprovalBanner,
  Banner,
  Button,
  Card,
  Checkbox,
  CodeInput,
  ConfirmDialog,
  Conflict409,
  CriticalAlert,
  DataTable,
  DeviceNotConnected,
  Dialog,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Empty,
  ErrorState,
  Forbidden403,
  FormField,
  IconButton,
  Input,
  Kbd,
  Loading,
  NotFound404,
  NotSubscribed402,
  Offline,
  Page,
  PageHeader,
  PatientBanner,
  PatientCell,
  PendingApproval202,
  QrCode,
  Select,
  SessionExpired,
  Skeleton,
  SplitView,
  StatTile,
  StatusBadge,
  Stepper,
  SubscriptionBanner,
  THEMES,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Textarea,
  Tooltip,
  useToast,
} from '@hms/ui';
import { usePrefs } from '../../app/prefs-context.js';
import { useFormDraft } from '../../lib/useDraft.js';

/*
 * Developer gallery (our Storybook substitute): every UI kit component and screen state with
 * sample props. The sample names and numbers below are fixtures for developers, clearly labelled,
 * and this page is left out of production builds.
 */

const swatches = [
  ['ground', 'bg-ground'],
  ['surface', 'bg-surface'],
  ['ink', 'bg-ink'],
  ['muted', 'bg-muted'],
  ['line', 'bg-line'],
  ['menu', 'bg-menu'],
  ['primary', 'bg-primary'],
  ['accent', 'bg-accent'],
  ['success', 'bg-success'],
  ['warning', 'bg-warning'],
  ['critical', 'bg-critical'],
  ['info', 'bg-info'],
  ['neutral', 'bg-neutral'],
];

const tableColumns = [
  { accessorKey: 'billNo', header: 'Bill no.', enableSorting: true, meta: { mono: true } },
  {
    accessorKey: 'patient',
    header: 'Patient',
    cell: ({ row }) => <PatientCell {...row.original.patient} />,
  },
  { accessorKey: 'amount', header: 'Amount', enableSorting: true, meta: { align: 'right' } },
  { accessorKey: 'mode', header: 'Mode' },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ getValue }) => <StatusBadge catalogue={BILL_STATUS} code={getValue()} />,
  },
];

const tableRows = [
  {
    id: '1',
    billNo: 'OP/26-27/000154',
    patient: { name: 'Sample Patient One', uhid: 'XX0000001', age: 47, sex: 'M' },
    amount: '₹1,385',
    mode: 'UPI',
    status: 'PAID',
  },
  {
    id: '2',
    billNo: 'OP/26-27/000155',
    patient: { name: 'Sample Patient Two', uhid: 'XX0000002', age: 32, sex: 'F' },
    amount: '₹2,400',
    mode: 'Card',
    status: 'DUE',
  },
  {
    id: '3',
    billNo: 'OP/26-27/000156',
    patient: { name: 'Sample Patient Three', uhid: 'XX0000003', age: '3 M', sex: 'F' },
    amount: '₹650',
    mode: 'Cash',
    status: 'DRAFT',
  },
];

function Section({ title, children, className }) {
  return (
    <Card title={title} className={className}>
      <div className="flex flex-col gap-4">{children}</div>
    </Card>
  );
}

function Label({ children }) {
  return <p className="text-xs font-semibold tracking-[0.08em] text-muted uppercase">{children}</p>;
}

function DraftDemo() {
  const form = useForm({ defaultValues: { note: '' } });
  const { restored, clear } = useFormDraft('dev-gallery-note', form);
  return (
    <form onSubmit={form.handleSubmit(() => clear())} className="flex flex-col gap-3">
      <FormField
        label="Draft autosave (type, then reload the page)"
        hint={
          restored ? 'Restored from a draft on this device.' : 'Saved on this device as you type.'
        }
      >
        <Textarea {...form.register('note')} rows={2} />
      </FormField>
      <div>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => {
            clear();
            form.reset({ note: '' });
          }}
        >
          Clear draft
        </Button>
      </div>
    </form>
  );
}

export default function DevGalleryPage() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { theme, setTheme, language, setLanguage } = usePrefs();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [sort, setSort] = useState('-amount');
  const [page, setPage] = useState(1);
  const [code, setCode] = useState('');
  const [tableState, setTableState] = useState('data');

  return (
    <div className="min-h-dvh bg-ground">
      <Page>
        <PageHeader
          eyebrow="Developer only"
          title={t('dev.title')}
          description={t('dev.description')}
          actions={
            <>
              <Select
                aria-label="Theme"
                value={theme}
                onChange={(e) => setTheme(e.target.value)}
                options={THEMES.map((th) => ({ value: th, label: th }))}
              />
              <Select
                aria-label="Language"
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                options={LANGUAGES.map((l) => ({ value: l.code, label: l.label }))}
              />
            </>
          }
        />

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
          <Section title="Colour tokens" className="xl:col-span-2">
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-5 lg:grid-cols-7">
              {swatches.map(([name, cls]) => (
                <div key={name} className="flex flex-col gap-1">
                  <div className={`h-12 rounded-control border border-line ${cls}`} />
                  <span className="text-sm text-ink">{name}</span>
                </div>
              ))}
            </div>
          </Section>
          <Section title="Type scale">
            <p className="text-3xl font-bold">Display 32</p>
            <p className="text-xl font-bold">Page title 20</p>
            <p className="text-md font-semibold">Section title 15</p>
            <p className="text-base">Body 14 for forms and tables</p>
            <p className="text-sm font-semibold">Badge 13 semibold</p>
            <p className="text-xs text-muted">Caption 12, the smallest size</p>
            <p className="font-mono text-base">UHID XX0000123 · IP/26-27/000871</p>
          </Section>
        </div>

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
          <Section title="Buttons">
            <div className="flex flex-wrap gap-2">
              <Button icon={<Printer size={16} aria-hidden="true" />}>Save and print</Button>
              <Button variant="secondary">Cancel</Button>
              <Button variant="danger">Reject</Button>
              <Button variant="ghost">Ghost</Button>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm">Small</Button>
              <Button loading>Saving</Button>
              <Button disabled variant="secondary">
                Disabled
              </Button>
              <IconButton label="Search" icon={<Search size={18} />} variant="secondary" />
              <IconButton label="Delete" icon={<Trash2 size={18} />} />
              <Tooltip content="Add a new item">
                <IconButton label="Add" icon={<Plus size={18} />} variant="secondary" />
              </Tooltip>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted">
              <Kbd keys="mod+k" /> palette <Kbd>?</Kbd> help <Kbd keys="alt+s" /> save
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="secondary" className="self-start">
                  Dropdown menu
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem onSelect={() => toast({ title: 'Edit chosen' })}>
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem shortcut="F4">New bill</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </Section>

          <Section title="Inputs">
            <FormField label="Patient name" hint="As on the ID card" required>
              <Input placeholder="Full name" />
            </FormField>
            <FormField label="Mobile" error="Enter a 10-digit mobile number">
              <Input defaultValue="98765" inputMode="numeric" mono />
            </FormField>
            <FormField label="Category">
              <Select
                options={[
                  { value: 'general', label: 'General' },
                  { value: 'staff', label: 'Staff' },
                ]}
              />
            </FormField>
            <Checkbox
              label="Details confirmed with patient"
              description="Required before check-in"
            />
            <FormField label="One-time code">
              <CodeInput value={code} onChange={setCode} label="One-time code" />
            </FormField>
            <DraftDemo />
          </Section>

          <Section title="Status badges (colour plus label)">
            {[
              ['Bed', BED_STATUS],
              ['Bill', BILL_STATUS],
              ['Approval', APPROVAL_STATUS],
              ['Tenant', TENANT_STATUS],
              ['User', USER_STATUS],
            ].map(([name, cat]) => (
              <div key={name} className="flex flex-col gap-1.5">
                <Label>{name}</Label>
                <div className="flex flex-wrap gap-1.5">
                  {Object.keys(cat).map((c) => (
                    <StatusBadge key={c} catalogue={cat} code={c} />
                  ))}
                </div>
              </div>
            ))}
            <div className="flex flex-wrap gap-1.5">
              <StatusBadge tone="accent" label="Accent" />
              <AllergyChip name="Penicillin" />
            </div>
          </Section>
        </div>

        <Section title="Patient identity">
          <PatientBanner
            name="Sample Patient One"
            age={47}
            sex="M"
            uhid="XX0000123"
            ipNo="IP/26-27/000871"
            bed="W2-204-B"
            allergies={['Penicillin', 'Sulfa drugs']}
            flags={[{ label: 'Fall risk', tone: 'warning' }]}
            consultant="Consultant name · Cardiology"
            weightKg={72}
          />
          <PatientBanner
            name="Sample Patient Two"
            age="3 M"
            sex="F"
            uhid="XX0000124"
            noKnownAllergies
            allergies={[]}
          />
          <PatientBanner name="Sample Patient Three" age={60} sex="O" uhid="XX0000125" />
          <CriticalAlert
            title="Critical result: platelets 38,000/µL"
            patient="Sample Patient One"
            raisedAt={new Date()}
            onAcknowledge={async () => ({ by: 'Developer', at: new Date() })}
          >
            Call the treating doctor and record the read-back.
          </CriticalAlert>
        </Section>

        <Section title="Data table">
          <div className="flex flex-wrap items-center gap-3">
            <Tabs value={tableState} onValueChange={setTableState}>
              <TabsList aria-label="Table state">
                <TabsTrigger value="data">Rows</TabsTrigger>
                <TabsTrigger value="loading">Loading</TabsTrigger>
                <TabsTrigger value="empty">Empty</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
          <DataTable
            caption="Sample bills"
            columns={tableColumns}
            data={tableState === 'data' ? tableRows : []}
            loading={tableState === 'loading'}
            total={tableState === 'data' ? 63 : 0}
            page={page}
            limit={25}
            onPageChange={setPage}
            sort={sort}
            onSortChange={setSort}
            onRowClick={(r) => toast({ title: `Open ${r.billNo}` })}
            empty={
              <Empty
                title="No bills today"
                description="Bills you create appear here."
                action={<Button>New bill</Button>}
              />
            }
          />
        </Section>

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
          <Section title="Stat tiles">
            <div className="grid grid-cols-2 gap-3">
              <StatTile label="Sample metric" value="1,234" sub="Fixture value" />
              <StatTile label="Loading" loading />
            </div>
          </Section>
          <Section title="Tabs and stepper">
            <Tabs defaultValue="rx">
              <TabsList aria-label="Consultation">
                <TabsTrigger value="rx">Prescription</TabsTrigger>
                <TabsTrigger value="orders">Orders</TabsTrigger>
                <TabsTrigger value="history">History</TabsTrigger>
              </TabsList>
              <TabsContent value="rx" className="text-muted">
                Prescription tab
              </TabsContent>
              <TabsContent value="orders" className="text-muted">
                Orders tab
              </TabsContent>
              <TabsContent value="history" className="text-muted">
                History tab
              </TabsContent>
            </Tabs>
            <Stepper steps={['Hospital', 'Branches', 'Departments', 'Users']} current={1} />
          </Section>
          <Section title="Dialogs, toasts, QR">
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={() => setDialogOpen(true)}>
                Dialog
              </Button>
              <Button variant="danger" onClick={() => setConfirmOpen(true)}>
                Confirm dialog
              </Button>
              <Button
                variant="secondary"
                onClick={() => toast({ title: 'Bill saved and printed.' })}
              >
                Toast
              </Button>
              <Button
                variant="secondary"
                onClick={() =>
                  toast({
                    title: 'Bed W2-204-B was just taken. Pick another bed.',
                    tone: 'critical',
                  })
                }
              >
                Error toast
              </Button>
            </div>
            <QrCode
              value="otpauth://totp/HMS:developer?secret=JBSWY3DPEHPK3PXP&issuer=HMS"
              label="Sample QR code"
              size={120}
            />
          </Section>
        </div>

        <h2 className="mt-4 text-xl font-semibold text-ink">Screen states</h2>
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 xl:grid-cols-3">
          <Section title="1 · Empty">
            <Empty
              title="No admissions today"
              description="Admitted patients will appear here."
              action={<Button>Admit patient</Button>}
            />
          </Section>
          <Section title="2 · Loading">
            <Loading />
            <Skeleton className="h-4 w-1/3" />
          </Section>
          <Section title="3 · Error">
            <ErrorState
              title="We could not load the bed board."
              requestId="c1b7e0a2"
              onRetry={() => {}}
            />
          </Section>
          <Section title="4 · No permission (403)">
            <Forbidden403 screen="Payroll" permission="payroll:run:read" onBack={() => {}} />
          </Section>
          <Section title="5 · Not subscribed (402)">
            <NotSubscribed402 module="Radiology" canAdd onAdd={() => {}} onBack={() => {}} />
            <NotSubscribed402 module="Radiology" onBack={() => {}} />
          </Section>
          <Section title="6 · Subscription banners">
            <SubscriptionBanner variant="paymentFailed" days={7} onFix={() => {}} />
            <SubscriptionBanner variant="readOnly" />
          </Section>
          <Section title="7 · Confirm a risky action">
            <Button variant="danger" onClick={() => setConfirmOpen(true)} className="self-start">
              Cancel bill…
            </Button>
          </Section>
          <Section title="8 · Waiting for approval (202)">
            <PendingApproval202 approver="the Billing Manager">
              The 15% discount is waiting for the Billing Manager. You&apos;ll be notified when it
              is decided.
            </PendingApproval202>
            <ApprovalBanner status="needs">
              Discount above 10% goes to the Billing Manager.
            </ApprovalBanner>
          </Section>
          <Section title="9 · Toasts and validation">
            <FormField label="Mobile" error="Enter a 10-digit mobile number">
              <Input defaultValue="98765" />
            </FormField>
          </Section>
          <Section title="10 · Session expired">
            <SessionExpired minutes={15} onSignIn={() => {}} />
          </Section>
          <Section title="11 · Offline">
            <Offline />
          </Section>
          <Section title="409 · Conflict">
            <Conflict409 by="Another user" at="10:42" onReload={() => {}} />
          </Section>
          <Section title="Device not connected">
            <DeviceNotConnected device="Barcode printer" onRetry={() => {}} />
          </Section>
          <Section title="404 · Not found">
            <NotFound404 onHome={() => {}} />
          </Section>
          <Section title="Banners">
            <Banner tone="info" title="Note.">
              Informational banner.
            </Banner>
            <Banner tone="success" title="Done.">
              Success banner.
            </Banner>
          </Section>
        </div>

        <Section title="Layout: split view">
          <SplitView
            list={<div className="rounded-card border border-line p-4 text-muted">List pane</div>}
            detail={
              <div className="rounded-card border border-line p-4 text-muted">Detail pane</div>
            }
          />
        </Section>
      </Page>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Cancel bill OP/26-27/000155?"
        description="This sends a cancellation request to the Billing Manager. The bill stays valid until approved."
        confirmLabel="Request cancellation"
        cancelLabel="Keep bill"
        onConfirm={() => toast({ title: 'Cancellation requested' })}
      />
      <Dialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title="Dialog title"
        description="Focus is trapped; Esc closes; focus returns to the button."
        footer={
          <>
            <Button variant="secondary" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => setDialogOpen(false)}>Save</Button>
          </>
        }
      >
        <FormField label="Field in a dialog">
          <Input />
        </FormField>
      </Dialog>
    </div>
  );
}
