import { useMemo, useState } from 'react';
import { useDispatch } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { MODULES, MODULE_CODES, PRICE_BOOK } from '@hms/shared';
import {
  Banner,
  Button,
  Card,
  Checkbox,
  Loading,
  StatusBadge,
  formatLongDate,
  useToast,
} from '@hms/ui';
import { ApiErrorNotice } from '../../../components/ApiErrorNotice.jsx';
import { useDebounced } from '../../../lib/useDebounced.js';
import { inr, inrExact } from '../../../lib/money.js';
import { authApi } from '../../auth/api.js';
import { useChangeModulesMutation, usePreviewChangeQuery } from '../api.js';

/** "₹2,000 / branch / month" for a module from the price book. */
function modulePrice(t, code) {
  const m = PRICE_BOOK.modules[code];
  if (!m) return '';
  return t(`subscription.modules.unit.${m.unit}`, { amount: inr(m.monthly) });
}

/** The live price of a pending change: charge now (prorated), next invoice, what blocks it. */
function ChangePreview({ change, onConfirm, confirming }) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'hi' ? 'hi-IN' : 'en-IN';
  const body = useDebounced(change, 300);
  const empty = !body.add.length && !body.remove.length;
  const { data, isFetching, isError, error } = usePreviewChangeQuery(body, { skip: empty });
  if (empty) return <p className="text-base text-muted">{t('subscription.change.pick')}</p>;
  if (isFetching && !data) return <Loading rows={2} label={t('subscription.change.pricing')} />;
  if (isError) return <ApiErrorNotice error={error} />;
  if (!data) return null;
  const blocked = data.blockedBy?.length > 0;
  const now = data.chargeNow ?? { lines: [], subtotal: 0, gst: 0, total: 0 };
  const removeAt = data.effective?.remove;
  return (
    <div className="flex flex-col gap-3" aria-live="polite" aria-busy={isFetching || undefined}>
      {blocked && (
        <Banner tone="warning" role="alert" title={t('subscription.change.blocked')}>
          <ul className="list-disc pl-5">
            {data.blockedBy.map((b) => (
              <li key={`${b.module}-${b.message}`}>{b.message}</li>
            ))}
          </ul>
        </Banner>
      )}
      {body.add.length > 0 && (
        <p className="text-sm text-muted">
          {String(data.effective?.add).startsWith('IMMEDIATE')
            ? t('subscription.change.addTrial')
            : t('subscription.change.addPaid')}
        </p>
      )}
      {body.remove.length > 0 && (
        <p className="text-sm text-muted">
          {String(removeAt).startsWith('IMMEDIATE') || !removeAt
            ? t('subscription.change.removeTrial')
            : t('subscription.change.removeAt', { date: formatLongDate(removeAt, locale) })}
        </p>
      )}
      {now.lines?.length > 0 && (
        <ul className="flex flex-col gap-1 text-sm">
          {now.lines.map((l) => (
            <li key={l.item} className="flex justify-between gap-3">
              <span className="text-muted">{l.description}</span>
              <span className="tabular">{inrExact(l.amount)}</span>
            </li>
          ))}
        </ul>
      )}
      <dl className="flex flex-col gap-1 text-base">
        <div className="flex justify-between gap-3">
          <dt className="text-muted">{t('subscription.change.chargeNow')}</dt>
          <dd className="tabular">{inrExact(now.subtotal)}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-muted">
            {t('subscription.change.gst', { rate: PRICE_BOOK.gstRate })}
          </dt>
          <dd className="tabular">{inrExact(now.gst)}</dd>
        </div>
        <div className="flex justify-between gap-3 border-t border-line pt-1.5 font-semibold">
          <dt>{t('subscription.change.totalToday')}</dt>
          <dd className="tabular">{inrExact(now.total)}</dd>
        </div>
        {data.nextInvoiceEstimate && (
          <div className="flex justify-between gap-3">
            <dt className="text-muted">{t('subscription.change.nextInvoice')}</dt>
            <dd className="tabular">{inrExact(data.nextInvoiceEstimate.total)}</dd>
          </div>
        )}
      </dl>
      <Button onClick={onConfirm} loading={confirming} disabled={blocked || isFetching}>
        {now.total > 0
          ? t('subscription.change.confirmPay', { amount: inr(now.total) })
          : t('subscription.change.confirm')}
      </Button>
      <p className="text-sm text-muted">{t('subscription.change.menusNote')}</p>
    </div>
  );
}

/**
 * Modules (design board "Subscription"): every module with its price, on or off; ticking a
 * change prices it live (POST /subscription/preview); confirming applies it. Additions start
 * now (on payment of the prorated invoice once the plan is paid); removals at renewal.
 */
export function ModulesCard({ sub, canChange, onInvoice }) {
  const { t, i18n } = useTranslation();
  const dispatch = useDispatch();
  const { toast } = useToast();
  const locale = i18n.language === 'hi' ? 'hi-IN' : 'en-IN';
  const active = useMemo(() => new Set(['CORE', ...sub.modules.map((m) => m.code)]), [sub.modules]);
  const pendingRemoval = useMemo(
    () => new Map((sub.pending ?? []).filter((p) => p.op === 'REMOVE').map((p) => [p.module, p])),
    [sub.pending],
  );
  const [target, setTarget] = useState(() => new Set(active));
  const [apply, { isLoading }] = useChangeModulesMutation();
  const [failure, setFailure] = useState(null);
  const change = useMemo(
    () => ({
      add: MODULE_CODES.filter((c) => target.has(c) && !active.has(c)),
      remove: MODULE_CODES.filter((c) => !target.has(c) && active.has(c)),
    }),
    [target, active],
  );

  const toggle = (code, on) =>
    setTarget((s) => {
      const next = new Set(s);
      if (on) next.add(code);
      else next.delete(code);
      return next;
    });

  const confirm = async () => {
    setFailure(null);
    try {
      const res = await apply(change).unwrap();
      dispatch(authApi.util.invalidateTags(['Session']));
      setTarget(new Set(['CORE', ...res.subscription.modules.map((m) => m.code)]));
      if (res.invoice) onInvoice?.(res.invoice);
      toast({
        title: res.invoice
          ? t('subscription.change.invoiced', {
              number: res.invoice.number,
              amount: inr(res.invoice.total),
            })
          : t('subscription.change.applied'),
        tone: 'success',
      });
    } catch (err) {
      setFailure(err);
    }
  };

  return (
    <Card
      title={t('subscription.modules.title')}
      description={t('subscription.modules.hint')}
      headingLevel={2}
    >
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_20rem]">
        <ul className="grid grid-cols-1 content-start gap-x-6 sm:grid-cols-2">
          {MODULE_CODES.map((code) => {
            const on = target.has(code);
            const was = active.has(code);
            const removal = pendingRemoval.get(code);
            return (
              <li key={code} className="border-b border-line py-1 last:border-b-0">
                <Checkbox
                  label={
                    <span className="flex flex-wrap items-center gap-2">
                      {MODULES[code].name}
                      {code === 'CORE' && (
                        <StatusBadge
                          tone="neutral"
                          icon={false}
                          label={t('subscription.modules.always')}
                        />
                      )}
                      {was && on && code !== 'CORE' && !removal && (
                        <StatusBadge
                          tone="success"
                          icon={false}
                          label={t('subscription.modules.on')}
                        />
                      )}
                      {removal && (
                        <StatusBadge
                          tone="warning"
                          label={t('subscription.modules.removing', {
                            date: removal.at ? formatLongDate(removal.at, locale) : '',
                          })}
                        />
                      )}
                      {on !== was && (
                        <StatusBadge
                          tone="info"
                          icon={false}
                          label={
                            on
                              ? t('subscription.modules.toAdd')
                              : t('subscription.modules.toRemove')
                          }
                        />
                      )}
                    </span>
                  }
                  description={modulePrice(t, code)}
                  checked={on}
                  disabled={!canChange || code === 'CORE'}
                  onChange={(e) => toggle(code, e.target.checked)}
                />
              </li>
            );
          })}
        </ul>
        {canChange && (
          <section
            aria-labelledby="change-summary"
            className="flex flex-col gap-3 rounded-card border border-line bg-surface-2 p-4 lg:self-start"
          >
            <h3 id="change-summary" className="text-md font-semibold text-ink">
              {t('subscription.change.title')}
            </h3>
            <ApiErrorNotice error={failure} />
            <ChangePreview change={change} onConfirm={confirm} confirming={isLoading} />
          </section>
        )}
      </div>
    </Card>
  );
}
