import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Search } from 'lucide-react';
import { Input, Spinner } from '@hms/ui';
import { useDebounced } from '../../../../lib/useDebounced.js';

/**
 * A search box with its results as buttons under it (Tab and Enter pick one, Escape clears):
 * ICD-10 codes, medicines from the formulary and orderable tests. `useSearch(term)` is an RTK
 * Query hook returning { items }; `render(item)` draws a result; `onPick(item)` adds it.
 */
export function SearchAdd({ label, placeholder, useSearch, render, onPick, minLength = 2 }) {
  const { t } = useTranslation();
  const [q, setQ] = useState('');
  const term = useDebounced(q.trim(), 250);
  const listId = useId();
  const { data, isFetching } = useSearch(term, { skip: term.length < minLength });
  const items = term.length >= minLength ? (data?.items ?? []) : [];
  return (
    <div className="relative flex flex-col gap-1">
      <div className="relative">
        <Search
          size={16}
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted"
        />
        <Input
          type="search"
          aria-label={label}
          aria-controls={listId}
          placeholder={placeholder}
          className="pl-9"
          value={q}
          autoComplete="off"
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setQ('');
            if (e.key === 'Enter') {
              e.preventDefault();
              if (items[0]) {
                onPick(items[0]);
                setQ('');
              }
            }
          }}
        />
        {isFetching && <Spinner className="absolute top-1/2 right-3 -translate-y-1/2" />}
      </div>
      <div id={listId} aria-live="polite">
        {term.length >= minLength && !isFetching && data && items.length === 0 && (
          <p className="px-1 text-sm text-muted">{t('opd.consult.noResults', { q: term })}</p>
        )}
        {items.length > 0 && (
          <ul className="absolute z-20 mt-1 flex max-h-72 w-full flex-col divide-y divide-line overflow-auto rounded-control border border-line bg-surface shadow-card">
            {items.map((it, i) => (
              <li key={it.id ?? it.code ?? i}>
                <button
                  type="button"
                  onClick={() => {
                    onPick(it);
                    setQ('');
                  }}
                  className="flex w-full cursor-pointer items-center gap-3 px-3 py-2 text-left text-base hover:bg-surface-2 focus-visible:bg-surface-2"
                >
                  {render(it)}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
