import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Search } from 'lucide-react';
import { FormField, Input, Select } from '@hms/ui';
import { istDayEnd, istDayStart } from '../../../lib/dates.js';
import { useDebounced } from '../../../lib/useDebounced.js';
import { useUrlState } from '../../../lib/useUrlState.js';
import { BillsTable } from './BillsTable.jsx';

const STATUSES = ['DRAFT', 'FINAL', 'PARTLY_PAID', 'PAID', 'CANCELLED'];

/** Bills in this branch with filters kept in the URL: number or UHID, status, IST date range. */
export function BillsTab() {
  const { t } = useTranslation();
  const [q, setQ] = useUrlState('q', '');
  const [status, setStatus] = useUrlState('status', '');
  const [from, setFrom] = useUrlState('from', '');
  const [to, setTo] = useUrlState('to', '');
  const [pageText, setPage] = useUrlState('page', '1');
  const [text, setText] = useState(q);
  const term = useDebounced(text.trim().toUpperCase(), 300);
  const page = Math.max(1, Number(pageText) || 1);
  useEffect(() => {
    if (term !== q) setQ(term, { reset: ['page'] });
  }, [term, q, setQ]);
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <FormField label={t('billing.bills.search')} className="w-full sm:w-64">
          <div className="relative">
            <Search
              size={16}
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted"
            />
            <Input
              type="search"
              className="pl-9"
              mono
              placeholder={t('billing.bills.searchPlaceholder')}
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
          </div>
        </FormField>
        <FormField label={t('common.status')} className="w-full sm:w-44">
          <Select
            value={status}
            onChange={(e) => setStatus(e.target.value, { reset: ['page'] })}
            placeholder={t('common.all')}
            options={STATUSES.map((s) => ({ value: s, label: t(`billing.status.${s}`) }))}
          />
        </FormField>
        <FormField label={t('billing.bills.from')} className="w-full sm:w-44">
          <Input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value, { reset: ['page'] })}
          />
        </FormField>
        <FormField label={t('billing.bills.to')} className="w-full sm:w-44">
          <Input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value, { reset: ['page'] })}
          />
        </FormField>
      </div>
      <BillsTable
        params={{ q: term || undefined, status, from: istDayStart(from), to: istDayEnd(to) }}
        page={page}
        onPageChange={(p) => setPage(String(p))}
      />
    </div>
  );
}
