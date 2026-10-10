const isPlainObject = (v) =>
  v !== null && typeof v === 'object' && !Array.isArray(v) && !(v instanceof Date);

/**
 * Flattens nested objects into dot paths: { location: { floor: '2' } } -> { 'location.floor': '2' }.
 * Arrays stay whole (they are shown as JSON), so a list of OPD timings reads as one value.
 */
export function flatten(value, prefix = '', out = {}) {
  if (!isPlainObject(value)) {
    if (prefix) out[prefix] = value;
    return out;
  }
  const entries = Object.entries(value);
  if (!entries.length && prefix) out[prefix] = value;
  for (const [k, v] of entries) flatten(v, prefix ? `${prefix}.${k}` : k, out);
  return out;
}

/** Missing, null and '' all mean "no value". */
export const isBlank = (v) => v === undefined || v === null || v === '';
const norm = (v) => (isBlank(v) ? null : v);
const same = (a, b) => JSON.stringify(norm(a)) === JSON.stringify(norm(b));

/**
 * Rows for a before/after table: every field present on either side, in the order they first
 * appear (after first, so a new record reads top to bottom), with `changed` set when they differ.
 * Fields blank on both sides, and paths in `omit` (ids, versions), are left out.
 */
export function diffRows(before, after, { omit = [] } = {}) {
  const b = flatten(before ?? {});
  const a = flatten(after ?? {});
  const skip = new Set(omit);
  const keys = [...new Set([...Object.keys(a), ...Object.keys(b)])].filter(
    // Fields with no value on either side say nothing.
    (k) => !skip.has(k) && !(isBlank(a[k]) && isBlank(b[k])),
  );
  return keys.map((key) => ({
    key,
    before: b[key],
    after: a[key],
    changed: !same(b[key], a[key]),
  }));
}
