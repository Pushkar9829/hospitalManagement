import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ShieldCheck } from 'lucide-react';
import {
  Banner,
  Button,
  Card,
  Checkbox,
  DataTable,
  Dialog,
  ErrorState,
  FormField,
  Input,
  StatusBadge,
  useToast,
} from '@hms/ui';
import { apiError } from '../../../app/apiError.js';
import { inr, paiseFrom, rupeesText } from '../../../lib/money.js';
import { useCan } from '../../../lib/useCan.js';
import { ApiErrorNotice } from '../../../components/ApiErrorNotice.jsx';
import { useApprovalRulesQuery, useUpdateApprovalRuleMutation } from '../api.js';

/** "Super Admin when over ₹10,000 or 10%" for one level. */
function useLevelText() {
  const { t } = useTranslation();
  return (level, i) => {
    const w = level.when;
    if (i === 0 || !w || (w.amountOver == null && w.percentOver == null))
      return t('settings.rules.levelAlways', { n: i + 1, label: level.label });
    const parts = [
      w.amountOver != null && t('settings.rules.overAmount', { amount: inr(w.amountOver) }),
      w.percentOver != null && t('settings.rules.overPercent', { percent: w.percentOver }),
    ].filter(Boolean);
    return t('settings.rules.levelWhen', {
      n: i + 1,
      label: level.label,
      when: parts.join(` ${t('settings.rules.or')} `),
    });
  };
}

const toLevelState = (level, i) => ({
  conditional: i > 0 && Boolean(level.when),
  amount: rupeesText(level.when?.amountOver),
  percent: level.when?.percentOver != null ? String(level.when.percentOver) : '',
});

function RuleDialog({ rule, onOpenChange, onReload }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [update, { isLoading }] = useUpdateApprovalRuleMutation();
  const [enabled, setEnabled] = useState(rule.enabled);
  const [expiry, setExpiry] = useState(String(rule.expiryHours));
  const [levels, setLevels] = useState(rule.levels.map(toLevelState));
  const [errors, setErrors] = useState({});
  const [failure, setFailure] = useState(null);

  const setLevel = (i, patch) =>
    setLevels((ls) => ls.map((l, j) => (j === i ? { ...l, ...patch } : l)));

  const submit = async (e) => {
    e.preventDefault();
    const errs = {};
    const hours = Number(expiry);
    if (!Number.isInteger(hours) || hours < 1 || hours > 336)
      errs.expiry = t('settings.rules.expiryError');
    const thresholds = levels.map((l, i) => {
      if (i === 0 || !l.conditional) return null;
      const out = {};
      if (l.amount.trim()) {
        const paise = Number.isFinite(Number(l.amount)) ? paiseFrom(l.amount) : NaN;
        if (!Number.isInteger(paise) || paise < 0)
          errs[`amount${i}`] = t('settings.rules.amountError');
        else out.amountOver = paise;
      }
      if (l.percent.trim()) {
        const p = Number(l.percent);
        if (!Number.isFinite(p) || p < 0 || p > 100)
          errs[`percent${i}`] = t('settings.rules.percentError');
        else out.percentOver = p;
      }
      if (!l.amount.trim() && !l.percent.trim())
        errs[`amount${i}`] = t('settings.rules.thresholdNeeded');
      return out;
    });
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setFailure(null);
    try {
      await update({
        action: rule.action,
        version: rule.version,
        expiryHours: hours,
        enabled,
        thresholds,
      }).unwrap();
      toast({ title: t('settings.rules.saved', { name: rule.label }), tone: 'success' });
      onOpenChange(false);
    } catch (err) {
      setFailure(apiError(err));
    }
  };

  return (
    <Dialog
      open
      onOpenChange={onOpenChange}
      size="lg"
      title={t('settings.rules.editTitle', { name: rule.label })}
      description={t('settings.rules.editHint')}
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" form="rule-form" loading={isLoading}>
            {t('common.save')}
          </Button>
        </>
      }
    >
      <form id="rule-form" onSubmit={submit} noValidate className="flex flex-col gap-4">
        <ApiErrorNotice
          error={failure}
          onReload={async () => {
            setFailure(null);
            await onReload();
            onOpenChange(false);
          }}
        />
        <Checkbox
          label={t('settings.rules.enabled')}
          description={t('settings.rules.enabledHint')}
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
        />
        <FormField
          label={t('settings.rules.expiry')}
          hint={t('settings.rules.expiryHint')}
          error={errors.expiry}
          required
        >
          <Input
            type="number"
            min={1}
            max={336}
            className="max-w-32"
            value={expiry}
            onChange={(e) => setExpiry(e.target.value)}
          />
        </FormField>
        <ol className="flex flex-col gap-3">
          {rule.levels.map((level, i) => (
            <li key={level.permission} className="rounded-card border border-line p-3">
              <p className="font-semibold text-ink">
                {t('settings.rules.level', { n: i + 1 })} · {level.label}
              </p>
              {i === 0 ? (
                <p className="text-sm text-muted">{t('settings.rules.firstAlways')}</p>
              ) : (
                <>
                  <Checkbox
                    label={t('settings.rules.onlyAbove')}
                    checked={levels[i].conditional}
                    onChange={(e) => setLevel(i, { conditional: e.target.checked })}
                  />
                  {levels[i].conditional && (
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <FormField
                        label={t('settings.rules.amountOver')}
                        hint={t('settings.rules.amountHint')}
                        error={errors[`amount${i}`]}
                      >
                        <div className="relative">
                          <span
                            aria-hidden="true"
                            className="absolute top-1/2 left-3 -translate-y-1/2 text-muted"
                          >
                            ₹
                          </span>
                          <Input
                            inputMode="decimal"
                            className="pl-7"
                            value={levels[i].amount}
                            onChange={(e) => setLevel(i, { amount: e.target.value })}
                          />
                        </div>
                      </FormField>
                      <FormField
                        label={t('settings.rules.percentOver')}
                        error={errors[`percent${i}`]}
                      >
                        <Input
                          inputMode="decimal"
                          value={levels[i].percent}
                          onChange={(e) => setLevel(i, { percent: e.target.value })}
                        />
                      </FormField>
                    </div>
                  )}
                </>
              )}
            </li>
          ))}
        </ol>
      </form>
    </Dialog>
  );
}

/** Maker-checker rules: who approves what, thresholds (₹ here, paise in the API), expiry. */
export function ApprovalRulesTab() {
  const { t } = useTranslation();
  const can = useCan();
  const canEdit = can('settings:approval:update');
  const levelText = useLevelText();
  const { data = [], isLoading, isError, error, refetch } = useApprovalRulesQuery();
  const [editing, setEditing] = useState(null);
  const rule = editing ? data.find((r) => r.action === editing) : null;

  const columns = useMemo(
    () => [
      {
        id: 'label',
        header: t('settings.rules.rule'),
        cell: ({ row }) => (
          <span>
            <span className="block font-semibold">{row.original.label}</span>
            <code className="font-mono text-sm text-muted">{row.original.action}</code>
          </span>
        ),
      },
      {
        id: 'levels',
        header: t('settings.rules.levels'),
        cell: ({ row }) => (
          <ol className="flex flex-col gap-0.5 text-sm">
            {row.original.levels.map((l, i) => (
              <li key={l.permission}>{levelText(l, i)}</li>
            ))}
          </ol>
        ),
      },
      {
        id: 'expiry',
        header: t('settings.rules.expiry'),
        meta: { align: 'right' },
        cell: ({ row }) => t('settings.rules.hours', { count: row.original.expiryHours }),
      },
      {
        id: 'enabled',
        header: t('common.status'),
        cell: ({ row }) =>
          row.original.enabled ? (
            <StatusBadge tone="success" label={t('settings.rules.on')} />
          ) : (
            <StatusBadge tone="warning" label={t('settings.rules.off')} />
          ),
      },
      ...(canEdit
        ? [
            {
              id: 'actions',
              header: <span className="sr-only">{t('common.actions')}</span>,
              meta: { align: 'right' },
              cell: ({ row }) => (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={(e) => (e.stopPropagation(), setEditing(row.original.action))}
                >
                  {t('common.edit')}
                  <span className="sr-only"> {row.original.label}</span>
                </Button>
              ),
            },
          ]
        : []),
    ],
    [t, levelText, canEdit],
  );

  if (isError)
    return (
      <ErrorState
        title={t('settings.loadFailed')}
        requestId={apiError(error)?.requestId}
        onRetry={refetch}
      />
    );

  return (
    <Card
      title={t('settings.rules.title')}
      description={t('settings.rules.description')}
      padding={false}
      actions={<ShieldCheck size={18} aria-hidden="true" className="text-muted" />}
    >
      {!canEdit && (
        <Banner tone="info" className="m-4">
          {t('settings.rules.readOnly')}
        </Banner>
      )}
      <DataTable
        className="[&>div]:rounded-none [&>div]:border-0"
        columns={columns}
        data={data}
        loading={isLoading}
        caption={t('settings.rules.title')}
        getRowId={(r) => r.action}
        onRowClick={canEdit ? (r) => setEditing(r.action) : undefined}
      />
      {rule && (
        <RuleDialog
          key={`${rule.action}-${rule.version}`}
          rule={rule}
          onOpenChange={(o) => !o && setEditing(null)}
          onReload={refetch}
        />
      )}
    </Card>
  );
}
