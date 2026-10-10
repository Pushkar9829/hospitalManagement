import { useMemo } from 'react';
import { useMastersQuery } from '../setup/api.js';

/** Price lists and GST rates by tax code id, for showing rates before the bill is saved. */
export function usePricing() {
  const { data: lists } = useMastersQuery({ type: 'price-lists', limit: 100 });
  const { data: taxes } = useMastersQuery({ type: 'tax-codes', limit: 100 });
  return useMemo(
    () => ({
      priceLists: lists?.items ?? [],
      taxRates: new Map((taxes?.items ?? []).map((x) => [x.id, x.rate ?? 0])),
    }),
    [lists, taxes],
  );
}
