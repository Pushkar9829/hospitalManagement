import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import { FormField, IconButton, Input, Select, Textarea } from '@hms/ui';
import { useIcd10Query } from '../../api.js';
import { SearchAdd } from './SearchAdd.jsx';

/**
 * Notes: chief complaints, history, examination and the ICD-10 diagnoses (searched by code or
 * words, each provisional or final). A visit closes only with a diagnosis or the reason there is
 * none (rule R13), so that reason field appears when the list is empty.
 */
export function NotesTab({ draft, change, readOnly, diagnosisError }) {
  const { t } = useTranslation();
  const diagnoses = draft.diagnoses ?? [];
  const set = (k) => (e) => change({ [k]: e.target.value });
  return (
    <div className="flex flex-col gap-4">
      <FormField label={t('opd.consult.complaints')}>
        <Input value={draft.complaints ?? ''} onChange={set('complaints')} readOnly={readOnly} />
      </FormField>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <FormField label={t('opd.consult.history')}>
          <Textarea
            rows={4}
            value={draft.history ?? ''}
            onChange={set('history')}
            readOnly={readOnly}
          />
        </FormField>
        <FormField label={t('opd.consult.examination')}>
          <Textarea
            rows={4}
            value={draft.examination ?? ''}
            onChange={set('examination')}
            readOnly={readOnly}
          />
        </FormField>
      </div>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-semibold text-ink">{t('opd.consult.diagnosis')}</legend>
        {diagnoses.length > 0 && (
          <ul className="flex flex-col gap-2">
            {diagnoses.map((d, i) => (
              <li
                key={d.code}
                className="flex flex-wrap items-center gap-2 rounded-control border border-line bg-surface-2 px-3 py-2"
              >
                <span className="font-mono text-sm font-semibold">{d.code}</span>
                <span className="min-w-0 flex-1 text-base">{d.name}</span>
                <label className="sr-only" htmlFor={`dx-type-${d.code}`}>
                  {t('opd.consult.dxType')}
                </label>
                <Select
                  id={`dx-type-${d.code}`}
                  className="w-40"
                  value={d.type}
                  disabled={readOnly}
                  onChange={(e) =>
                    change({
                      diagnoses: diagnoses.map((x, j) =>
                        j === i ? { ...x, type: e.target.value } : x,
                      ),
                    })
                  }
                  options={['PROVISIONAL', 'FINAL'].map((v) => ({
                    value: v,
                    label: t(`opd.consult.dxTypes.${v}`),
                  }))}
                />
                {!readOnly && (
                  <IconButton
                    size="sm"
                    label={t('opd.consult.remove', { name: d.name })}
                    icon={<X size={16} aria-hidden="true" />}
                    onClick={() => change({ diagnoses: diagnoses.filter((_, j) => j !== i) })}
                  />
                )}
              </li>
            ))}
          </ul>
        )}
        {!readOnly && (
          <SearchAdd
            label={t('opd.consult.searchIcd')}
            placeholder={t('opd.consult.searchIcd')}
            useSearch={useIcd10Query}
            minLength={1}
            render={(it) => (
              <>
                <span className="w-16 shrink-0 font-mono text-sm font-semibold">{it.code}</span>
                <span className="flex-1">{it.name}</span>
              </>
            )}
            onPick={(it) =>
              !diagnoses.some((d) => d.code === it.code) &&
              change({
                diagnoses: [
                  ...diagnoses,
                  { code: it.code, name: it.name, type: diagnoses.length ? 'FINAL' : 'PROVISIONAL' },
                ],
              })
            }
          />
        )}
        {diagnosisError && (
          <p role="alert" className="text-sm text-critical">
            {diagnosisError}
          </p>
        )}
        {diagnoses.length === 0 && (
          <FormField label={t('opd.consult.noDxReason')} hint={t('opd.consult.noDxHint')} optional>
            <Input
              value={draft.noDiagnosisReason ?? ''}
              onChange={set('noDiagnosisReason')}
              readOnly={readOnly}
            />
          </FormField>
        )}
      </fieldset>
    </div>
  );
}
