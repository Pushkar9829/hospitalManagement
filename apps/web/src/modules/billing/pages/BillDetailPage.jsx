import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import { BadgePercent, Ban, CheckCheck, Printer, Save } from 'lucide-react';
import { addAdminStrings } from '@hms/i18n/admin';
import { addBillingStrings } from '@hms/i18n/billing';
import { addPatientsStrings } from '@hms/i18n/patients';
import {
  Banner,
  Button,
  Card,
  ConfirmDialog,
  ErrorState,
  Loading,
  NotFound404,
  Page,
  PageHeader,
  PatientBanner,
  StatusBadge,
  formatDateTime,
  useToast,
} from '@hms/ui';
import { apiError } from '../../../app/apiError.js';
import { ApiErrorNotice } from '../../../components/ApiErrorNotice.jsx';
import { PdfPreviewDialog } from '../../../components/PdfPreviewDialog.jsx';
import { PendingApprovalNotice } from '../../../components/PendingApprovalNotice.jsx';
import { useCan } from '../../../lib/useCan.js';
import { useIdempotencyKey } from '../../../lib/useIdempotencyKey.js';
import { inr, inrExact } from '../../../lib/money.js';
import { useStrings } from '../../../lib/useStrings.js';
import { bannerAllergies, patientFlags } from '../../patients/flags.js';
import { isObjectId, usePatient } from '../../patients/hooks.js';
import {
  useBillQuery,
  useFinalizeBillMutation,
  usePaymentsQuery,
  useRefundsQuery,
  useReplaceLinesMutation,
  useRequestCancelMutation,
} from '../api.js';
import { priceListFor } from '../billing.js';
import { BillStatus } from '../components/BillsTable.jsx';
import { DiscountDialog } from '../components/DiscountDialog.jsx';
import { LinesEditor, TotalsList } from '../components/LinesEditor.jsx';
import { usePricing } from '../usePricing.js';
import { PaymentPanel } from '../components/PaymentPanel.jsx';
import { ServicePicker } from '../components/ServicePicker.jsx';
import { ShiftBanner } from '../components/ShiftBanner.jsx';

/** Receipts that paid this bill, each with its 80 mm receipt print. */
function Receipts({ bill, onPrint }) {
  const { t, i18n } = useTranslation();
  const can = useCan();
  const locale = i18n.language === 'hi' ? 'hi-IN' : 'en-IN';
  const { data } = usePaymentsQuery(
    { patientId: bill.patient.id, limit: 100, sort: '-createdAt' },
    { skip: !can('billing:payment:read') },
  );
  const receipts = (data?.items ?? []).filter((p) =>
    p.allocations.some((a) => a.billId === bill.id),
  );
  if (!receipts.length) return null;
  return (
    <Card title={t('billing.receipts.title')} headingLevel={2}>
      <ul className="flex flex-col divide-y divide-line">
        {receipts.map((r) => (
          <li key={r.id} className="flex flex-wrap items-center gap-3 py-2">
            <span className="font-mono text-sm">{r.receiptNo}</span>
            <span className="text-sm text-muted">{formatDateTime(r.createdAt, locale)}</span>
            <span>{r.mode}</span>
            {r.reference && <span className="font-mono text-sm text-muted">{r.reference}</span>}
            <span className="tabular ml-auto font-semibold">
              {inrExact(r.allocations.find((a) => a.billId === bill.id)?.amount ?? r.amount)}
            </span>
            <StatusBadge
              tone={
                r.status === 'CAPTURED' ? 'success' : r.status === 'PENDING' ? 'warning' : 'neutral'
              }
              icon={r.status !== 'CAPTURED'}
              label={t(`billing.receipts.status.${r.status}`)}
            />
            {can('billing:bill:print') && r.status === 'CAPTURED' && (
              <Button
                size="sm"
                variant="secondary"
                icon={<Printer size={14} aria-hidden="true" />}
                onClick={() => onPrint(r)}
              >
                {t('billing.receipts.print')}
              </Button>
            )}
          </li>
        ))}
      </ul>
    </Card>
  );
}

/** Refunds raised by cancelling this bill (paid by a cashier from Billing → Refunds). */
function BillRefunds({ bill }) {
  const { t } = useTranslation();
  const can = useCan();
  const { data } = useRefundsQuery(
    { patientId: bill.patient.id, limit: 100 },
    { skip: !can('billing:refund:read') || bill.status !== 'CANCELLED' },
  );
  const refunds = (data?.items ?? []).filter((r) => r.billId === bill.id);
  if (!refunds.length) return null;
  return (
    <Card title={t('billing.refunds.title')} headingLevel={2}>
      <ul className="flex flex-col divide-y divide-line">
        {refunds.map((r) => (
          <li key={r.id} className="flex flex-wrap items-center gap-3 py-2">
            <span className="font-mono text-sm">{r.refundNo}</span>
            <span>{r.modes.map((m) => `${m.mode} ${inr(m.amount)}`).join(', ')}</span>
            <StatusBadge
              tone={r.status === 'PAID' ? 'success' : 'warning'}
              label={t(`billing.refunds.status.${r.status}`)}
            />
            {r.status === 'APPROVED' && (
              <Link
                to="/billing?tab=refunds"
                className="ml-auto text-sm font-semibold underline underline-offset-2"
              >
                {t('billing.refunds.goPay')}
              </Link>
            )}
          </li>
        ))}
      </ul>
    </Card>
  );
}

/**
 * One bill (design boards "Billing", "BillStates"): a draft is edited and finalised (open shift
 * needed, gap-free number); a final bill takes payment, prints (A4 bill, 80 mm receipts, reprints
 * marked DUPLICATE), and asks for a discount or a cancellation through approval (202).
 */
export default function BillDetailPage() {
  useStrings(addAdminStrings, addPatientsStrings, addBillingStrings);
  const { id } = useParams();
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'hi' ? 'hi-IN' : 'en-IN';
  const navigate = useNavigate();
  const { toast } = useToast();
  const can = useCan();
  const valid = isObjectId(id);
  const { data: bill, isLoading, isError, error, refetch } = useBillQuery(id, { skip: !valid });
  const { data: patient } = usePatient(bill?.patient.id);
  const { priceLists, taxRates } = usePricing();
  const [replaceLines, { isLoading: savingLines }] = useReplaceLinesMutation();
  const [finalize, { isLoading: finalizing }] = useFinalizeBillMutation();
  const [cancel] = useRequestCancelMutation();
  const [finalKey, renewFinalKey] = useIdempotencyKey();
  const [edit, setEdit] = useState(null); // draft lines being edited: { version, lines }
  const [failure, setFailure] = useState(null);
  const [notice, setNotice] = useState(null);
  const [discounting, setDiscounting] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [printing, setPrinting] = useState(null); // { url, title, number, reprint }

  // Draft lines edited here; a newer version of the bill (saved, reloaded) starts again from it.
  const lines =
    bill?.status === 'DRAFT' ? (edit?.version === bill.version ? edit.lines : bill.lines) : null;
  const setLines = (next) =>
    setEdit({ version: bill.version, lines: typeof next === 'function' ? next(lines) : next });
  const dirty =
    Boolean(lines) &&
    JSON.stringify(lines.map((l) => [l.serviceId, l.qty])) !==
      JSON.stringify(bill.lines.map((l) => [l.serviceId, l.qty]));

  if (!valid)
    return (
      <Page width="medium">
        <NotFound404 className="mt-8" onHome={() => navigate('/billing?tab=bills')} />
      </Page>
    );
  if (isLoading)
    return (
      <Page>
        <Loading rows={6} />
      </Page>
    );
  if (isError) {
    const e = apiError(error);
    return (
      <Page width="medium">
        {e?.status === 404 ? (
          <NotFound404 className="mt-8" onHome={() => navigate('/billing?tab=bills')} />
        ) : (
          <ErrorState title={t('billing.bill.failed')} requestId={e?.requestId} onRetry={refetch} />
        )}
      </Page>
    );
  }

  const draft = bill.status === 'DRAFT';
  const final = ['FINAL', 'PARTLY_PAID', 'PAID'].includes(bill.status);
  const canDiscount =
    can('billing:discount:request') && bill.status === 'FINAL' && !bill.totals.paid && !bill.hold;
  const canCancel = can('billing:cancel:request') && final && !bill.hold;
  const canPay =
    can('billing:payment:create') &&
    ['FINAL', 'PARTLY_PAID'].includes(bill.status) &&
    !bill.hold &&
    bill.totals.balance > 0;
  const list = priceListFor(patient?.category, priceLists);
  const reload = async () => {
    setFailure(null);
    await refetch();
  };

  const saveLines = async () => {
    setFailure(null);
    try {
      await replaceLines({
        id: bill.id,
        version: bill.version,
        lines: lines.map((l) => ({ serviceId: l.serviceId, qty: l.qty })),
      }).unwrap();
      toast({ title: t('billing.bill.linesSaved'), tone: 'success' });
    } catch (err) {
      setFailure(err);
    }
  };

  const doFinalize = async () => {
    setFailure(null);
    try {
      const b = await finalize({
        id: bill.id,
        version: bill.version,
        idempotencyKey: finalKey(),
      }).unwrap();
      renewFinalKey();
      toast({ title: t('billing.bill.finalized', { no: b.billNo }), tone: 'success' });
    } catch (err) {
      setFailure(err);
    }
  };

  const printBill = () =>
    setPrinting({
      url: `/billing/bills/${bill.id}/pdf`,
      title: t('billing.print.billTitle', { no: bill.billNo }),
      number: bill.billNo,
      reprint: bill.printCount > 0,
    });

  return (
    <Page>
      <PageHeader
        title={draft ? t('billing.bill.draftTitle') : t('billing.bill.title', { no: bill.billNo })}
        breadcrumb={[
          { label: t('billing.title'), href: '/billing?tab=bills' },
          { label: bill.billNo ?? t('billing.bill.draft') },
        ]}
        actions={
          <>
            {canCancel && (
              <Button
                variant="secondary"
                icon={<Ban size={16} aria-hidden="true" />}
                onClick={() => setCancelling(true)}
              >
                {t('billing.cancel.action')}
              </Button>
            )}
            {canDiscount && (
              <Button
                variant="secondary"
                icon={<BadgePercent size={16} aria-hidden="true" />}
                onClick={() => setDiscounting(true)}
              >
                {t('billing.discount.action')}
              </Button>
            )}
            {(final || bill.status === 'CANCELLED') && can('billing:bill:print') && (
              <Button
                variant="secondary"
                icon={<Printer size={16} aria-hidden="true" />}
                onClick={printBill}
              >
                {t('billing.print.bill')}
              </Button>
            )}
          </>
        }
      />
      {(draft || canPay) && <ShiftBanner />}
      <PatientBanner
        name={bill.patient.name}
        age={bill.patient.age}
        sex={bill.patient.gender}
        uhid={bill.patient.uhid}
        allergies={bannerAllergies(patient)}
        noKnownAllergies={patient?.noKnownAllergies}
        flags={patient ? patientFlags(patient, t) : []}
      />
      {notice && (
        <PendingApprovalNotice approvalId={notice.approvalId}>
          {notice.text} {t('approvalNotice.body', { approver: notice.approver })}
        </PendingApprovalNotice>
      )}
      {!notice && bill.hold && (
        <PendingApprovalNotice
          approvalId={
            bill.hold === 'DISCOUNT' ? bill.discount?.approvalId : bill.cancellation?.approvalId
          }
        >
          {t(`billing.hold.${bill.hold}Body`, { amount: inr(bill.discount?.amount ?? 0) })}
        </PendingApprovalNotice>
      )}
      {bill.discount?.status === 'REJECTED' && (
        <Banner tone="info">
          {t('billing.discount.rejected', { amount: inr(bill.discount.amount) })}
        </Banner>
      )}
      {bill.status === 'CANCELLED' && (
        <Banner tone="neutral" title={t('billing.cancel.doneTitle')}>
          {t('billing.cancel.doneBody', {
            note: bill.cancellation?.creditNoteNo ?? '-',
            reason: bill.cancellation?.reason ?? '',
          })}
        </Banner>
      )}
      <ApiErrorNotice error={failure} onReload={reload} />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_24rem]">
        <div className="flex min-w-0 flex-col gap-4">
          <Card
            title={t('billing.lines.title')}
            headingLevel={2}
            actions={
              <span className="flex flex-wrap items-center gap-2 text-sm text-muted">
                <BillStatus bill={bill} inline />
                {t(`billing.types.${bill.type}`)} ·{' '}
                {t('billing.bill.list', { list: bill.payer?.priceListCode ?? '-' })}
              </span>
            }
          >
            <div className="flex flex-col gap-4">
              {draft && lines && can('billing:bill:create') ? (
                <>
                  <ServicePicker
                    priceList={list}
                    priceLists={priceLists}
                    taxRates={taxRates}
                    onAdd={(l) =>
                      setLines((ls) =>
                        ls.some((x) => x.serviceId === l.serviceId)
                          ? ls.map((x) =>
                              x.serviceId === l.serviceId
                                ? { ...x, qty: Math.min(999, x.qty + 1) }
                                : x,
                            )
                          : [...ls, l],
                      )
                    }
                  />
                  <LinesEditor lines={lines} onChange={setLines} />
                  {dirty && (
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      <span className="text-sm text-warning">{t('billing.bill.unsavedLines')}</span>
                      <Button
                        variant="secondary"
                        icon={<Save size={16} aria-hidden="true" />}
                        loading={savingLines}
                        disabled={!lines.length}
                        onClick={saveLines}
                      >
                        {t('billing.bill.saveLines')}
                      </Button>
                    </div>
                  )}
                </>
              ) : (
                <LinesEditor lines={bill.lines} readOnly />
              )}
            </div>
          </Card>
          <Receipts
            bill={bill}
            onPrint={(r) =>
              setPrinting({
                url: `/billing/payments/${r.id}/pdf`,
                title: t('billing.print.receiptTitle', { no: r.receiptNo }),
                number: r.receiptNo,
                reprint: r.printCount > 0,
              })
            }
          />
          <BillRefunds bill={bill} />
        </div>
        <div className="flex flex-col gap-4">
          <Card title={t('billing.totals.title')} headingLevel={2}>
            <div className="flex flex-col gap-4">
              <TotalsList totals={bill.totals} />
              {bill.finalizedAt && (
                <p className="text-sm text-muted">
                  {t('billing.bill.finalizedAt', {
                    time: formatDateTime(bill.finalizedAt, locale),
                  })}
                </p>
              )}
              {draft && can('billing:bill:finalize') && (
                <Button
                  size="lg"
                  icon={<CheckCheck size={16} aria-hidden="true" />}
                  loading={finalizing}
                  disabled={dirty}
                  onClick={doFinalize}
                >
                  {t('billing.bill.finalize')}
                </Button>
              )}
              {draft && dirty && (
                <p className="text-sm text-muted">{t('billing.bill.saveFirst')}</p>
              )}
            </div>
          </Card>
          {canPay && (
            <PaymentPanel key={`${bill.id}-${bill.version}`} bill={bill} onPaid={() => refetch()} />
          )}
          {bill.status === 'PAID' && (
            <Banner tone="success" title={t('billing.bill.paidTitle')}>
              {t('billing.bill.paidBody')}
            </Banner>
          )}
        </div>
      </div>
      {discounting && (
        <DiscountDialog
          bill={bill}
          onOpenChange={setDiscounting}
          onDone={(res) => {
            if (res.approvalId) {
              const pct =
                Math.round((res.bill.discount.amount * 10000) / res.bill.totals.gross) / 100;
              setNotice({
                approvalId: res.approvalId,
                text: t('billing.discount.sent', {
                  amount: inr(res.bill.discount.amount),
                  no: bill.billNo,
                }),
                approver:
                  pct > 10 || res.bill.discount.amount > 10_000_00
                    ? t('billing.discount.approverTwo')
                    : t('billing.discount.approverOne'),
              });
            } else toast({ title: t('billing.discount.applied'), tone: 'success' });
          }}
        />
      )}
      <ConfirmDialog
        open={cancelling}
        onOpenChange={setCancelling}
        title={t('billing.cancel.title', { no: bill.billNo })}
        description={
          bill.totals.paid
            ? t('billing.cancel.bodyPaid', { amount: inr(bill.totals.paid) })
            : t('billing.cancel.body')
        }
        confirmLabel={t('billing.cancel.submit')}
        reasonHint={t('billing.cancel.reasonHint')}
        onConfirm={async (reason) => {
          setFailure(null);
          try {
            const res = await cancel({ id: bill.id, version: bill.version, reason }).unwrap();
            if (res.approvalId)
              setNotice({
                approvalId: res.approvalId,
                text: t('billing.cancel.sent', { no: bill.billNo }),
                approver: t('billing.cancel.approver'),
              });
            else toast({ title: t('billing.cancel.done', { no: bill.billNo }), tone: 'success' });
          } catch (err) {
            setFailure(err);
            throw err;
          }
        }}
      />
      {printing && (
        <PdfPreviewDialog
          open
          onOpenChange={(o) => !o && setPrinting(null)}
          url={printing.url}
          title={printing.title}
          number={printing.number}
          reprint={printing.reprint}
          onPrinted={() => refetch()}
        />
      )}
    </Page>
  );
}
