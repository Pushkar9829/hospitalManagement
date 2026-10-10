import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Search } from 'lucide-react';
import { FormField, Input, Spinner } from '@hms/ui';
import { useDebounced } from '../../../lib/useDebounced.js';
import { inr } from '../../../lib/money.js';
import { useMastersQuery } from '../../setup/api.js';
import { rateFor } from '../billing.js';

/**
 * Finds an active service by code or name and shows its rate in the patient's price list
 * (rule R1, default list as fallback). Picking one calls onAdd({ serviceId, code, name, qty,
 * unitPrice, taxRate }). Services without a rate in either list cannot be added.
 */
export function ServicePicker({ priceList, priceLists, taxRates, onAdd, disabled }) {
  const { t } = useTranslation();
  const [q, setQ] = useState('');
  const term = useDebounced(q.trim(), 250);
  const listId = useId();
  const { data, isFetching } = useMastersQuery(
    { type: 'services', q: term, active: 'true', limit: 10 },
    { skip: disabled || term.length < 2 },
  );
  const items = term.length >= 2 ? (data?.items ?? []) : [];
  return (
    <div className="flex flex-col gap-2">
      <FormField label={t('billing.newBill.addService')} hint={t('billing.newBill.serviceHint')}>
        <div className="relative">
          <Search
            size={16}
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted"
          />
          <Input
            type="search"
            className="pl-9"
            autoComplete="off"
            disabled={disabled}
            aria-controls={listId}
            placeholder={t('billing.newBill.servicePlaceholder')}
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          {isFetching && <Spinner className="absolute top-1/2 right-3 -translate-y-1/2" />}
        </div>
      </FormField>
      <div id={listId} aria-live="polite">
        {term.length >= 2 && !isFetching && items.length === 0 && (
          <p className="text-sm text-muted">{t('billing.newBill.noService', { q: term })}</p>
        )}
        {items.length > 0 && (
          <ul className="flex flex-col divide-y divide-line rounded-control border border-line">
            {items.map((s) => {
              const rate = rateFor(s, priceList, priceLists);
              const taxRate = taxRates.get(s.taxCodeId) ?? 0;
              return (
                <li key={s.id}>
                  <button
                    type="button"
                    disabled={!rate}
                    onClick={() => {
                      onAdd({
                        serviceId: s.id,
                        code: s.code,
                        name: s.name,
                        qty: 1,
                        unitPrice: rate.amount,
                        taxRate,
                        listCode: rate.list?.code,
                      });
                      setQ('');
                    }}
                    className="flex w-full cursor-pointer items-center gap-3 px-3 py-2 text-left hover:bg-surface-2 focus-visible:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Plus size={16} aria-hidden="true" className="shrink-0 text-muted" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium text-ink">{s.name}</span>
                      <span className="block font-mono text-sm text-muted">{s.code}</span>
                    </span>
                    <span className="tabular text-right">
                      {rate ? (
                        <>
                          <span className="block font-semibold text-ink">{inr(rate.amount)}</span>
                          <span className="block text-sm text-muted">
                            {rate.list?.code}
                            {taxRate
                              ? ` · ${t('billing.gstRate', { rate: taxRate })}`
                              : ` · ${t('billing.exempt')}`}
                          </span>
                        </>
                      ) : (
                        <span className="text-sm text-warning">{t('billing.newBill.noRate')}</span>
                      )}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
