import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { MASTERS } from '@hms/shared/schemas';

const WRAPPERS = new Set(['optional', 'default', 'nullable', 'readonly', 'catch', 'nonoptional']);
const KINDS = {
  string: 'text',
  enum: 'enum',
  boolean: 'boolean',
  number: 'number',
  date: 'date',
  array: 'list',
  record: 'record',
};

/**
 * Describes one field of a zod schema for a generated form: unwraps optional/default wrappers
 * and the `optionalText` union (text or ''), and reads enum options and defaults.
 */
export function describeField(name, schema) {
  let s = schema;
  let required = true;
  let defaultValue;
  for (let guard = 0; guard < 10; guard++) {
    const def = s._zod.def;
    if (WRAPPERS.has(def.type)) {
      if (def.type !== 'nonoptional') required = false;
      if (def.type === 'default') {
        const v = def.defaultValue;
        defaultValue = typeof v === 'function' ? v() : v;
      }
      s = def.innerType;
    } else if (def.type === 'union') {
      required = false;
      s = def.options.find((o) => !['literal', 'pipe'].includes(o._zod.def.type)) ?? def.options[0];
    } else if (def.type === 'pipe') {
      s = def.in;
    } else break;
  }
  const def = s._zod.def;
  return {
    name,
    kind: KINDS[def.type] ?? 'text',
    required,
    defaultValue,
    options: def.type === 'enum' ? Object.keys(def.entries) : undefined,
  };
}

/** Fields of a master type's input schema, in schema order. */
export function masterFields(type) {
  const shape = MASTERS[type].input.shape;
  return Object.entries(shape).map(([name, s]) => describeField(name, s));
}

/** The Excel column header for a field: the default English label. */
export function columnLabel(type, field) {
  const entry = Object.entries(MASTERS[type].columns).find(([, f]) => f === field);
  return entry?.[0]?.replace(/\s*\*$/, '') ?? field;
}

/** "BANK_TRANSFER" → "Bank transfer" (fallback label for enum values). */
export function humanize(value) {
  const s = String(value).replace(/_/g, ' ').toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export { cleanResolver } from '../../lib/forms.js';

/** A date from the API (ISO) → the yyyy-mm-dd a date input takes, in IST. */
export function toDateInput(iso) {
  if (!iso) return '';
  const d = new Date(new Date(iso).getTime() + 330 * 60_000);
  return d.toISOString().slice(0, 10);
}

/** Translated field and option labels for a master type (English column header as fallback). */
export function useMasterLabels(type) {
  const { t } = useTranslation();
  return useMemo(
    () => ({
      field: (name) => t(`masters.fields.${name}`, { defaultValue: columnLabel(type, name) }),
      option: (v) => t(`masters.options.${v}`, { defaultValue: humanize(v) }),
    }),
    [t, type],
  );
}
