/**
 * Word-prefix matching: every typed word must start a word of the label, group or keywords
 * (the item value is an id such as `screen:Lab`, so it is only used when there are no keywords).
 * cmdk's default fuzzy match finds "lab" inside "Billing Analytics", which is noise for staff
 * who know the screen name. Exact label starts rank first.
 */
export function paletteFilter(value, search, keywords = []) {
  const terms = search.toLowerCase().trim().split(/\s+/).filter(Boolean);
  if (!terms.length) return 1;
  const words = (keywords.length ? keywords : [value])
    .join(' ')
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
  if (!terms.every((term) => words.some((w) => w.startsWith(term)))) return 0;
  const label = String(keywords[0] ?? value).toLowerCase();
  return label.startsWith(terms.join(' ')) ? 1 : 0.5;
}
