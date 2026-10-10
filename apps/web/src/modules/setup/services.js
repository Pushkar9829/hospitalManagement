import { useMemo } from 'react';
import { inr } from '../../lib/money.js';
import { useDepartmentsQuery, useMastersQuery } from './api.js';

/** Price lists, tax codes and departments a service refers to by code. */
export function useServiceRefs({ skip = false } = {}) {
  const { data: lists } = useMastersQuery({ type: 'price-lists', limit: 100 }, { skip });
  const { data: taxes } = useMastersQuery({ type: 'tax-codes', limit: 100 }, { skip });
  const { data: depts } = useDepartmentsQuery({ status: 'ACTIVE', limit: 100 }, { skip });
  return useMemo(() => {
    const priceLists = lists?.items ?? [];
    return {
      priceLists,
      activeLists: priceLists.filter((l) => l.isActive),
      listCode: new Map(priceLists.map((l) => [l.id, l.code])),
      taxes: (taxes?.items ?? []).filter((x) => x.isActive),
      taxCode: new Map((taxes?.items ?? []).map((x) => [x.id, x.code])),
      departments: depts?.items ?? [],
      deptCode: new Map((depts?.items ?? []).map((d) => [d.id, d.code])),
    };
  }, [lists, taxes, depts]);
}

/** "GENERAL ₹500 · STAFF ₹400" for a list of { priceListId, amount }. */
export function ratesText(rates, listCode) {
  return (rates ?? [])
    .map((r) => `${listCode.get(r.priceListId) ?? '?'} ${inr(r.amount)}`)
    .join(' · ');
}
