/** "-createdAt" -> { id: 'createdAt', desc: true }. */
export function parseSort(sort) {
  if (!sort) return null;
  return sort.startsWith('-') ? { id: sort.slice(1), desc: true } : { id: sort, desc: false };
}

/** Next sort after a header click: ascending, then descending, then off. */
export function nextSort(current, id) {
  const s = parseSort(current);
  if (!s || s.id !== id) return id;
  if (!s.desc) return `-${id}`;
  return undefined;
}
