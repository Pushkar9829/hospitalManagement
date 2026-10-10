import { zodResolver } from '@hookform/resolvers/zod';
import { apiError } from '../app/apiError.js';

/**
 * Puts 422 field details under their fields (`location.branchId` → that field) and returns the
 * normalised error with only the details no field could show, for the form-level notice.
 * `fields` lists the form's field paths; a detail for a nested path counts when its first
 * segments match a listed field.
 */
export function applyFieldErrors(err, setError, fields) {
  const e = apiError(err);
  if (!e) return null;
  if (e.code !== 'VALIDATION_FAILED' || !e.details.length) return e;
  const known = new Set(fields);
  const rest = [];
  let first = true;
  for (const d of e.details) {
    const path = String(d.path ?? '');
    const match = [...known].find((f) => path === f || path.startsWith(`${f}.`));
    if (match) {
      setError(path, { type: 'server', message: d.message }, { shouldFocus: first });
      first = false;
    } else rest.push(d);
  }
  return rest.length ? { ...e, details: rest } : null;
}

/** Drops empty strings so optional fields validate as "not given" (`''` → undefined). */
export function withoutEmpty(values) {
  if (Array.isArray(values)) return values.map(withoutEmpty);
  if (values && typeof values === 'object' && !(values instanceof Date)) {
    const out = {};
    for (const [k, v] of Object.entries(values)) {
      if (v === '' || v === undefined) continue;
      out[k] = withoutEmpty(v);
    }
    return out;
  }
  return values;
}

/**
 * zodResolver that first drops empty strings, so an optional field left blank is "not given"
 * (the shared schemas reject '' for some optional fields such as a mobile or an id).
 */
export function cleanResolver(schema) {
  const resolve = zodResolver(schema);
  return (values, context, options) => resolve(withoutEmpty(values), context, options);
}
