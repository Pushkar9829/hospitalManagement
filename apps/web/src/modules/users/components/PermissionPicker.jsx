import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Search } from 'lucide-react';
import { Checkbox, FormField, Input } from '@hms/ui';
import { covers, editorGroups } from '../roles.js';

/**
 * Permission editor: the catalogue grouped by module, with search. Each module offers a "whole
 * module" toggle (`lab:*`); keys a selected wildcard already covers show as included.
 */
export function PermissionPicker({ catalog, value = [], onChange, disabled = false, error }) {
  const { t } = useTranslation();
  const [q, setQ] = useState('');
  const groups = useMemo(() => editorGroups(catalog), [catalog]);
  const needle = q.trim().toLowerCase();
  const shown = groups
    .map((g) => ({
      ...g,
      keys: needle
        ? g.keys.filter(
            (k) => k.toLowerCase().includes(needle) || g.name.toLowerCase().includes(needle),
          )
        : g.keys,
    }))
    .filter((g) => !needle || g.keys.length || g.name.toLowerCase().includes(needle));

  const set = (key, on) => {
    const next = value.filter((k) => k !== key);
    onChange(on ? [...next, key] : next);
  };
  const setWildcard = (head, on) => {
    const wildcard = `${head}:*`;
    // A whole-module grant replaces the module's single keys.
    const rest = value.filter((k) => k !== wildcard && !(on && k.split(':')[0] === head));
    onChange(on ? [...rest, wildcard] : rest);
  };

  return (
    <div className="flex flex-col gap-3">
      <FormField label={t('roles.searchPermissions')}>
        <div className="relative">
          <Search
            size={16}
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted"
          />
          <Input
            type="search"
            className="pl-9"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="lab:sample"
          />
        </div>
      </FormField>
      {error && (
        <p role="alert" className="text-sm text-critical">
          {error}
        </p>
      )}
      <div className="flex flex-col gap-2">
        {shown.map((g) => {
          const count =
            g.keys.filter((k) => covers(value, k)).length +
            g.heads.filter((h) => value.includes(`${h}:*`)).length;
          const total = g.keys.length + g.heads.length;
          return (
            <details
              key={g.module}
              open={Boolean(needle) || count > 0 || g.heads.some((h) => value.includes(`${h}:*`))}
              className="rounded-card border border-line bg-surface"
            >
              <summary className="flex min-h-tap cursor-pointer items-center justify-between gap-2 px-3 py-2 font-semibold text-ink">
                <span>
                  {g.name}{' '}
                  <span className="font-mono text-sm font-normal text-muted">{g.module}</span>
                </span>
                <span className="text-sm font-normal text-muted">
                  {t('roles.selectedCount', { count, total })}
                </span>
              </summary>
              <div className="flex flex-col gap-1 border-t border-line px-3 py-2">
                {g.heads.map((h) => (
                  <Checkbox
                    key={h}
                    disabled={disabled}
                    checked={value.includes(`${h}:*`)}
                    onChange={(e) => setWildcard(h, e.target.checked)}
                    label={
                      <span>
                        {t('roles.wholeModule', { name: h })}{' '}
                        <code className="font-mono text-sm text-muted">{h}:*</code>
                      </span>
                    }
                  />
                ))}
                <div className="grid grid-cols-1 gap-x-4 md:grid-cols-2">
                  {g.keys.map((k) => {
                    const direct = value.includes(k);
                    const implied = !direct && covers(value, k);
                    return (
                      <Checkbox
                        key={k}
                        disabled={disabled || implied}
                        checked={direct || implied}
                        onChange={(e) => set(k, e.target.checked)}
                        label={
                          <span className="font-mono text-sm">
                            {k}
                            {implied && (
                              <span className="ml-1 font-sans text-muted">
                                ({t('roles.included')})
                              </span>
                            )}
                          </span>
                        }
                      />
                    );
                  })}
                </div>
              </div>
            </details>
          );
        })}
        {shown.length === 0 && <p className="text-sm text-muted">{t('roles.noPermissionMatch')}</p>}
      </div>
    </div>
  );
}

/** Read-only view of a role's permissions, grouped by area (system roles, inactive roles). */
export function PermissionList({ value = [] }) {
  const { t } = useTranslation();
  const groups = new Map();
  for (const k of [...value].sort()) {
    const head = k === '*' ? '*' : k.split(':')[0];
    if (!groups.has(head)) groups.set(head, []);
    groups.get(head).push(k);
  }
  if (!groups.size) return <p className="text-sm text-muted">{t('roles.noPermissions')}</p>;
  return (
    <dl className="grid grid-cols-1 gap-x-4 gap-y-2 rounded-card border border-line p-3 sm:grid-cols-[max-content_1fr]">
      {[...groups].map(([head, keys]) => (
        <div key={head} className="contents">
          <dt className="pt-0.5 text-sm font-semibold text-ink">
            {head === '*' ? t('roles.everything') : head}
          </dt>
          <dd className="flex flex-wrap gap-1.5">
            {keys.map((k) => (
              <code
                key={k}
                className="rounded-chip bg-neutral-bg px-2 py-0.5 font-mono text-sm text-ink"
              >
                {k}
              </code>
            ))}
          </dd>
        </div>
      ))}
    </dl>
  );
}
