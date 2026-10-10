import { useState } from 'react';
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { Button, Select, StatusBadge, useToast } from '@hms/ui';
import { FormDialog } from '../../../dx-kit/FormDialog.jsx';
import { inr } from '../../../../lib/money.js';
import { useCan } from '../../../../lib/useCan.js';
import {
  useOpdDoctorsQuery,
  useOpdTemplatesQuery,
  useOrderablesQuery,
  useReferVisitMutation,
  useRequestAdmissionMutation,
} from '../../api.js';
import { SearchAdd } from './SearchAdd.jsx';

const PRIORITIES = ['ROUTINE', 'TODAY', 'STAT', 'SCHEDULE'];
const STATUS_TONE = { DRAFT: 'neutral', TO_BILL: 'warning', BILLED: 'info', DONE: 'success' };

let tmp = 0;
const newId = () => `new-o-${Date.now()}-${++tmp}`;
const useOrderSearch = (q, opts) => useOrderablesQuery({ q }, opts);

const admitSchema = (t) =>
  z.object({
    ward: z.enum(['GENERAL', 'SEMI_PRIVATE', 'PRIVATE', 'ICU']),
    reason: z.string().trim().min(5, t('opd.orders.errors.reason')),
    days: z.coerce.number().int().min(1, t('opd.orders.errors.days')).max(60),
  });

const referSchema = (t) =>
  z.object({
    doctorId: z.string().min(1, t('opd.book.errors.doctor')),
    priority: z.enum(['ROUTINE', 'SAME_DAY', 'URGENT']),
    note: z.string().trim().min(5, t('opd.orders.errors.note')),
  });

/**
 * Orders: laboratory, radiology and procedures with priority and price, order sets from the
 * templates, admission request (handed to the IPD desk) and referral to another doctor. Orders
 * are billed at the real billing counter, linked from here.
 */
export function OrdersTab({ draft, change, readOnly, visit }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const can = useCan();
  const orders = draft.orders ?? [];
  const sets = useOpdTemplatesQuery({ kind: 'ORDER_SET' });
  const doctors = useOpdDoctorsQuery();
  const [dialog, setDialog] = useState(null);
  const [admit] = useRequestAdmissionMutation();
  const [refer] = useReferVisitMutation();
  const total = orders.reduce((s, o) => s + (o.price ?? 0), 0);

  const add = (list) => {
    const have = new Set(orders.map((o) => o.code));
    change({
      orders: [
        ...orders,
        ...list
          .filter((o) => !have.has(o.code))
          .map((o) => ({
            id: newId(),
            code: o.code,
            name: o.name,
            type: o.type,
            priority: 'ROUTINE',
            price: o.price,
            status: 'DRAFT',
          })),
      ],
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="overflow-x-auto rounded-card border border-line">
        <table className="w-full min-w-[640px] text-base">
          <caption className="sr-only">{t('opd.orders.caption')}</caption>
          <thead className="bg-surface-2 text-left text-sm">
            <tr>
              <th className="px-3 py-2">{t('opd.orders.order')}</th>
              <th className="px-2 py-2">{t('opd.orders.type')}</th>
              <th className="px-2 py-2">{t('opd.orders.priority')}</th>
              <th className="px-2 py-2 text-right">{t('opd.orders.price')}</th>
              <th className="px-2 py-2">{t('opd.orders.status')}</th>
              <th className="px-2 py-2">
                <span className="sr-only">{t('opd.rx.actions')}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {orders.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-muted">
                  {t('opd.orders.empty')}
                </td>
              </tr>
            )}
            {orders.map((o, i) => (
              <tr key={o.id} className="border-t border-line">
                <td className="px-3 py-2">{o.name}</td>
                <td className="px-2 py-2">{t(`opd.orders.types.${o.type}`)}</td>
                <td className="px-2 py-2">
                  <Select
                    aria-label={t('opd.orders.priorityOf', { name: o.name })}
                    className="w-36"
                    value={o.priority}
                    disabled={readOnly}
                    onChange={(e) =>
                      change({
                        orders: orders.map((x, j) =>
                          j === i ? { ...x, priority: e.target.value } : x,
                        ),
                      })
                    }
                    options={PRIORITIES.map((p) => ({
                      value: p,
                      label: t(`opd.orders.priorities.${p}`),
                    }))}
                  />
                </td>
                <td className="tabular px-2 py-2 text-right">{inr(o.price)}</td>
                <td className="px-2 py-2">
                  <StatusBadge
                    tone={STATUS_TONE[o.status] ?? 'neutral'}
                    label={t(`opd.orders.statuses.${o.status}`)}
                  />
                </td>
                <td className="px-2 py-2 text-right">
                  {!readOnly && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => change({ orders: orders.filter((_, j) => j !== i) })}
                    >
                      {t('opd.rx.remove')}
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
          {orders.length > 0 && (
            <tfoot>
              <tr className="border-t border-line bg-surface-2 font-semibold">
                <td className="px-3 py-2" colSpan={3}>
                  {t('opd.orders.total')}
                </td>
                <td className="tabular px-2 py-2 text-right">{inr(total)}</td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      {!readOnly && (
        <SearchAdd
          label={t('opd.orders.add')}
          placeholder={t('opd.orders.add')}
          useSearch={useOrderSearch}
          render={(o) => (
            <>
              <span className="flex-1">{o.name}</span>
              <span className="text-sm text-muted">{t(`opd.orders.types.${o.type}`)}</span>
              <span className="tabular text-sm">{inr(o.price)}</span>
            </>
          )}
          onPick={(o) => add([o])}
        />
      )}
      <div className="flex flex-wrap gap-2">
        {!readOnly &&
          (sets.data?.items ?? []).map((s) => (
            <Button key={s.id} variant="secondary" onClick={() => add(s.orders ?? [])}>
              {t('opd.orders.orderSet', { name: s.name })}
            </Button>
          ))}
        <Button variant="secondary" onClick={() => setDialog('admit')}>
          {t('opd.orders.admit')}
        </Button>
        <Button variant="secondary" onClick={() => setDialog('refer')}>
          {t('opd.orders.refer')}
        </Button>
        {orders.length > 0 && can('billing:bill:create') && (
          <Link
            to={`/billing?tab=new&patient=${visit.patient.id}`}
            className="inline-flex min-h-10 items-center rounded-control px-3 font-semibold text-info hover:bg-info-bg"
          >
            {t('opd.orders.bill')}
          </Link>
        )}
      </div>
      <FormDialog
        open={dialog === 'admit'}
        onOpenChange={(o) => setDialog(o ? 'admit' : null)}
        title={t('opd.orders.admitTitle', { name: visit.patient.name })}
        description={t('opd.orders.admitHint')}
        schema={admitSchema(t)}
        defaultValues={{ ward: 'SEMI_PRIVATE', reason: '', days: '3' }}
        fields={[
          {
            name: 'ward',
            label: t('opd.orders.ward'),
            type: 'select',
            options: ['GENERAL', 'SEMI_PRIVATE', 'PRIVATE', 'ICU'].map((w) => ({
              value: w,
              label: t(`opd.orders.wards.${w}`),
            })),
          },
          { name: 'days', label: t('opd.orders.days'), type: 'number', required: true },
          { name: 'reason', label: t('opd.orders.reason'), type: 'textarea', required: true },
        ]}
        submitLabel={t('opd.orders.sendAdmit')}
        onSubmit={(v) => admit({ id: visit.id, ...v }).unwrap()}
        onDone={() => toast({ tone: 'success', title: t('opd.orders.admitSent') })}
      />
      <FormDialog
        open={dialog === 'refer'}
        onOpenChange={(o) => setDialog(o ? 'refer' : null)}
        title={t('opd.orders.referTitle', { name: visit.patient.name })}
        description={t('opd.orders.referHint')}
        schema={referSchema(t)}
        defaultValues={{ doctorId: '', priority: 'SAME_DAY', note: '' }}
        fields={[
          {
            name: 'doctorId',
            label: t('opd.book.doctor'),
            type: 'select',
            options: (doctors.data?.items ?? [])
              .filter((d) => d.id !== visit.doctor?.id)
              .map((d) => ({ value: d.id, label: `${d.name} · ${d.department}` })),
            required: true,
          },
          {
            name: 'priority',
            label: t('opd.orders.priority'),
            type: 'select',
            options: ['ROUTINE', 'SAME_DAY', 'URGENT'].map((p) => ({
              value: p,
              label: t(`opd.orders.referPriorities.${p}`),
            })),
          },
          { name: 'note', label: t('opd.orders.note'), type: 'textarea', required: true },
        ]}
        submitLabel={t('opd.orders.sendRefer')}
        onSubmit={(v) => refer({ id: visit.id, ...v }).unwrap()}
        onDone={(r) =>
          toast({
            tone: 'success',
            title: t('opd.orders.referred', { doctor: r.doctor.name }),
            description: r.slot ? t('opd.orders.referSlot', { time: r.slot }) : undefined,
          })
        }
      />
    </div>
  );
}
