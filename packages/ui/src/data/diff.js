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

const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/**
 * Rows for a before/after table: every field present on either side, in the order they first
 * appear (after first, so a new record reads top to bottom), with `changed` set when they differ.
 */
export function diffRows(before, after) {
  const b = flatten(before ?? {});
  const a = flatten(after ?? {});
  const keys = [...new Set([...Object.keys(a), ...Object.keys(b)])];
  return keys.map((key) => ({
    key,
    before: b[key],
    after: a[key],
    changed: !same(b[key], a[key]),
  }));
}
