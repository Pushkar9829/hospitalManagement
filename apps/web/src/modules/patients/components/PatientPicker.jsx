import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, X } from 'lucide-react';
import { FormField, IconButton, Input, PatientCell, Spinner } from '@hms/ui';
import { useDebounced } from '../../../lib/useDebounced.js';
import { useSearchPatientsQuery } from '../api.js';
import { searchHint } from '../patientForm.js';

/**
 * Finds a patient by UHID, mobile (4+ digits) or name and returns the search card
 * ({ id, uhid, name, gender, age, mobile, allergies, flags }). Results are buttons, so Tab and
 * Enter pick one; the count is announced. `exclude` hides one id (the record being merged).
 */
export function PatientPicker({ label, value, onChange, exclude, error, autoFocus, hint }) {
  const { t } = useTranslation();
  const [q, setQ] = useState('');
  const term = useDebounced(q.trim(), 300);
  const problem = searchHint(term);
  const listId = useId();
  const { data, isFetching, isError } = useSearchPatientsQuery(
    { q: term, limit: 8 },
    { skip: Boolean(problem) },
  );
  const items = (data?.items ?? []).filter((p) => p.id !== exclude);

  if (value) {
    return (
      <FormField label={label} error={error}>
        <div className="flex items-center gap-3 rounded-control border border-line-strong bg-surface-2 px-3 py-2">
          <PatientCell
            name={value.name}
            uhid={value.uhid}
            age={value.age}
            sex={value.gender}
            className="flex-1"
          />
          <span className="font-mono text-sm text-muted">{value.mobile}</span>
          <IconButton
            size="sm"
            label={t('patients.picker.change')}
            icon={<X size={16} aria-hidden="true" />}
            onClick={() => onChange(null)}
          />
        </div>
      </FormField>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <FormField label={label} hint={hint ?? t('patients.picker.hint')} error={error}>
        <div className="relative">
          <Search
            size={16}
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted"
          />
          <Input
            type="search"
            className="pl-9"
            autoFocus={autoFocus}
            autoComplete="off"
            aria-controls={listId}
            placeholder={t('patients.search.placeholder')}
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          {isFetching && <Spinner className="absolute top-1/2 right-3 -translate-y-1/2" />}
        </div>
      </FormField>
      <div id={listId} aria-live="polite" className="flex flex-col gap-1">
        {term && problem === 'digits' && (
          <p className="text-sm text-muted">{t('patients.search.digits')}</p>
        )}
        {!problem && !isFetching && isError && (
          <p className="text-sm text-critical">{t('patients.search.failed')}</p>
        )}
        {!problem && !isFetching && data && (
          <p className="sr-only">{t('patients.picker.count', { count: items.length })}</p>
        )}
        {!problem && !isFetching && data && items.length === 0 && (
          <p className="text-sm text-muted">{t('patients.search.none', { q: term })}</p>
        )}
        {items.length > 0 && (
          <ul className="flex flex-col divide-y divide-line rounded-control border border-line">
            {items.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => onChange(p)}
                  className="flex w-full cursor-pointer items-center gap-3 px-3 py-2 text-left hover:bg-surface-2 focus-visible:bg-surface-2"
                >
                  <PatientCell
                    name={p.name}
                    uhid={p.uhid}
                    age={p.age}
                    sex={p.gender}
                    className="flex-1"
                  />
                  <span className="font-mono text-sm text-muted">{p.mobile}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
