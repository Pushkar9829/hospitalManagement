import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { Banner, Button, FormField, Input, Select, Textarea, useToast } from '@hms/ui';
import { FormDialog } from '../../../dx-kit/FormDialog.jsx';
import { fmtDate, localeOf } from '../../../dx-kit/format.js';
import { useCreateTemplateMutation, useFormularyQuery, useOpdTemplatesQuery } from '../../api.js';
import { FREQUENCIES, ROUTES, addDaysYmd, todayIST, ymdInstant } from '../../opd.js';
import { SearchAdd } from './SearchAdd.jsx';

let tmp = 0;
const newId = () => `new-${Date.now()}-${++tmp}`;

/** The allergy, interaction and duplicate checks the API ran on the last saved draft. */
function Checks({ checks }) {
  const { t } = useTranslation();
  if (!checks) return null;
  const { allergy = [], interactions = [], duplicates = [] } = checks;
  if (!allergy.length && !interactions.length && !duplicates.length)
    return (
      <Banner tone="success" title={t('opd.rx.checksOk')}>
        {t('opd.rx.checksOkBody')}
      </Banner>
    );
  return (
    <div className="flex flex-col gap-2">
      {allergy.map((a) => (
        <Banner key={a.drug} tone="critical" role="alert" title={t('opd.rx.allergyHit')}>
          {t('opd.rx.allergyBody', { drug: a.drug, group: a.allergy })}
        </Banner>
      ))}
      {interactions.map((i) => (
        <Banner key={i.message} tone="warning" title={t('opd.rx.interaction')}>
          {i.message}
        </Banner>
      ))}
      {duplicates.map((g) => (
        <Banner key={g} tone="warning" title={t('opd.rx.duplicate')}>
          {t('opd.rx.duplicateBody', { generic: g })}
        </Banner>
      ))}
    </div>
  );
}

const templateSchema = (t) =>
  z.object({ name: z.string().trim().min(3, t('opd.rx.errors.templateName')) });

/**
 * Prescription: medicines by brand or generic name with dose, frequency, days, route and
 * instructions; templates (apply or save the current list); advice, follow-up and the print
 * language. Checks for allergy, interaction and duplicates come back with every save.
 */
export function RxTab({ draft, change, readOnly, checks, department }) {
  const { t, i18n } = useTranslation();
  const { toast } = useToast();
  const rx = draft.rx ?? [];
  const templates = useOpdTemplatesQuery({ kind: 'RX' });
  const [templateId, setTemplateId] = useState('');
  const [saving, setSaving] = useState(false);
  const [createTemplate] = useCreateTemplateMutation();
  const setLine = (i, patch) =>
    change({ rx: rx.map((r, j) => (j === i ? { ...r, ...patch } : r)) });
  const list = templates.data?.items ?? [];
  const followDate = draft.followUp?.date ?? '';

  return (
    <div className="flex flex-col gap-4">
      <Checks checks={checks} />
      <div className="overflow-x-auto rounded-card border border-line">
        <table className="w-full min-w-[760px] text-base">
          <caption className="sr-only">{t('opd.rx.caption')}</caption>
          <thead className="bg-surface-2 text-left text-sm">
            <tr>
              <th className="px-3 py-2">{t('opd.rx.medicine')}</th>
              <th className="px-2 py-2">{t('opd.rx.dose')}</th>
              <th className="px-2 py-2">{t('opd.rx.frequency')}</th>
              <th className="px-2 py-2">{t('opd.rx.days')}</th>
              <th className="px-2 py-2">{t('opd.rx.route')}</th>
              <th className="px-2 py-2">{t('opd.rx.instructions')}</th>
              <th className="px-2 py-2">
                <span className="sr-only">{t('opd.rx.actions')}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rx.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-muted">
                  {t('opd.rx.empty')}
                </td>
              </tr>
            )}
            {rx.map((r, i) => (
              <tr key={r.id} className="border-t border-line align-top">
                <td className="px-3 py-2">
                  <strong className="block font-semibold">{r.brand}</strong>
                  <span className="text-sm text-muted">{r.generic}</span>
                </td>
                <td className="px-2 py-2">
                  <Input
                    aria-label={t('opd.rx.doseOf', { name: r.brand })}
                    value={r.dose}
                    readOnly={readOnly}
                    onChange={(e) => setLine(i, { dose: e.target.value })}
                    className="w-24"
                  />
                </td>
                <td className="px-2 py-2">
                  <Select
                    aria-label={t('opd.rx.frequencyOf', { name: r.brand })}
                    value={r.frequency}
                    disabled={readOnly}
                    onChange={(e) => setLine(i, { frequency: e.target.value })}
                    options={FREQUENCIES.map((f) => ({ value: f, label: t(`opd.freq.${f}`) }))}
                    className="w-44"
                  />
                </td>
                <td className="px-2 py-2">
                  <Input
                    aria-label={t('opd.rx.daysOf', { name: r.brand })}
                    value={r.days ?? ''}
                    inputMode="numeric"
                    readOnly={readOnly}
                    onChange={(e) =>
                      setLine(i, { days: Number(e.target.value.replace(/\D/g, '')) || '' })
                    }
                    className="tabular w-16"
                  />
                </td>
                <td className="px-2 py-2">
                  <Select
                    aria-label={t('opd.rx.routeOf', { name: r.brand })}
                    value={r.route}
                    disabled={readOnly}
                    onChange={(e) => setLine(i, { route: e.target.value })}
                    options={ROUTES.map((x) => ({ value: x, label: t(`opd.routes.${x}`) }))}
                    className="w-32"
                  />
                </td>
                <td className="px-2 py-2">
                  <Input
                    aria-label={t('opd.rx.instructionsOf', { name: r.brand })}
                    value={r.instructions ?? ''}
                    readOnly={readOnly}
                    onChange={(e) => setLine(i, { instructions: e.target.value })}
                  />
                </td>
                <td className="px-2 py-2 text-right">
                  {!readOnly && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => change({ rx: rx.filter((_, j) => j !== i) })}
                    >
                      {t('opd.rx.remove')}
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!readOnly && (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_auto]">
          <SearchAdd
            label={t('opd.rx.add')}
            placeholder={t('opd.rx.add')}
            useSearch={useFormularyQuery}
            render={(d) => (
              <>
                <span className="flex-1">
                  <strong className="block">{d.brand}</strong>
                  <span className="text-sm text-muted">
                    {d.generic} · {d.form}
                  </span>
                </span>
              </>
            )}
            onPick={(d) =>
              change({
                rx: [
                  ...rx,
                  {
                    id: newId(),
                    drugId: d.id,
                    brand: d.brand,
                    generic: d.generic,
                    dose: d.form === 'Syrup' ? '5 ml' : '1 tab',
                    frequency: 'BD',
                    days: 5,
                    route: ['Gel', 'Solution'].includes(d.form)
                      ? 'Topical'
                      : d.form === 'Inhaler'
                        ? 'Inhalation'
                        : 'Oral',
                    instructions: '',
                  },
                ],
              })
            }
          />
          <div className="flex flex-wrap items-center gap-2">
            <label className="sr-only" htmlFor="rx-template">
              {t('opd.rx.template')}
            </label>
            <Select
              id="rx-template"
              className="w-56"
              value={templateId}
              onChange={(e) => setTemplateId(e.target.value)}
              placeholder={t('opd.rx.chooseTemplate')}
              options={list.map((x) => ({ value: x.id, label: x.name }))}
            />
            <Button
              variant="secondary"
              disabled={!templateId}
              onClick={() => {
                const tpl = list.find((x) => x.id === templateId);
                if (!tpl) return;
                const have = new Set(rx.map((r) => r.drugId));
                change({
                  rx: [
                    ...rx,
                    ...(tpl.rx ?? [])
                      .filter((r) => !have.has(r.drugId))
                      .map((r) => ({ ...r, id: newId() })),
                  ],
                  advice: draft.advice || tpl.advice || '',
                });
                toast({ tone: 'success', title: t('opd.rx.templateUsed', { name: tpl.name }) });
              }}
            >
              {t('opd.rx.useTemplate')}
            </Button>
            <Button variant="ghost" disabled={!rx.length} onClick={() => setSaving(true)}>
              {t('opd.rx.saveTemplate')}
            </Button>
          </div>
        </div>
      )}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_14rem_10rem]">
        <FormField label={t('opd.rx.advice')}>
          <Textarea
            rows={2}
            value={draft.advice ?? ''}
            readOnly={readOnly}
            onChange={(e) => change({ advice: e.target.value })}
          />
        </FormField>
        <FormField
          label={t('opd.rx.followUp')}
          hint={followDate ? fmtDate(ymdInstant(followDate), localeOf(i18n)) : undefined}
        >
          <Input
            type="date"
            value={followDate}
            min={todayIST()}
            readOnly={readOnly}
            onChange={(e) =>
              change({ followUp: { ...(draft.followUp ?? {}), date: e.target.value } })
            }
          />
        </FormField>
        <FormField label={t('opd.rx.printLanguage')}>
          <Select
            value={draft.printLanguage ?? 'en'}
            disabled={readOnly}
            onChange={(e) => change({ printLanguage: e.target.value })}
            options={['en', 'hi', 'mr'].map((l) => ({ value: l, label: t(`opd.rx.langs.${l}`) }))}
          />
        </FormField>
      </div>
      {!readOnly && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted">{t('opd.rx.followIn')}</span>
          {[7, 15, 30].map((n) => (
            <Button
              key={n}
              size="sm"
              variant="secondary"
              onClick={() =>
                change({
                  followUp: { ...(draft.followUp ?? {}), date: addDaysYmd(todayIST(), n) },
                })
              }
            >
              {t('opd.rx.inDays', { n })}
            </Button>
          ))}
        </div>
      )}
      <FormDialog
        open={saving}
        onOpenChange={setSaving}
        title={t('opd.rx.saveTemplate')}
        description={t('opd.rx.saveTemplateHint', { count: rx.length })}
        schema={templateSchema(t)}
        defaultValues={{ name: '' }}
        fields={[{ name: 'name', label: t('opd.rx.templateName'), required: true, span: 2 }]}
        submitLabel={t('opd.rx.saveTemplate')}
        onSubmit={(v) =>
          createTemplate({
            name: v.name,
            kind: 'RX',
            department,
            rx: rx.map(({ id: _id, ...r }) => r),
            advice: draft.advice ?? '',
          }).unwrap()
        }
        onDone={(_r, v) =>
          toast({ tone: 'success', title: t('opd.rx.templateSaved', { name: v.name }) })
        }
      />
    </div>
  );
}
