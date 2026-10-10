import { useMemo } from 'react';
import { useMastersQuery } from '../setup/api.js';

/** Active payment modes from the hospital's master (CASH, UPI, CARD, CHEQUE, BANK, PAYLINK, ADVANCE). */
export function usePaymentModes() {
  const { data, isLoading } = useMastersQuery({ type: 'payment-modes', limit: 100 });
  return useMemo(
    () => ({ modes: (data?.items ?? []).filter((m) => m.isActive), isLoading }),
    [data, isLoading],
  );
}
