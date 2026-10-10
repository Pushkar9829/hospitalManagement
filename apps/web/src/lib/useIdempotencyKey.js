import { useCallback, useRef } from 'react';

/** A fresh Idempotency-Key value. */
export const newIdempotencyKey = () =>
  globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;

/**
 * One Idempotency-Key per user action on a money write: a retry after a network error or a
 * timeout sends the same key, so the server never takes the payment twice. Call `renew()` once
 * the action succeeded (or the user changed the amount), so the next action gets a new key.
 *
 *   const [key, renew] = useIdempotencyKey();
 *   await pay({ ...body, idempotencyKey: key() }).unwrap(); renew();
 */
export function useIdempotencyKey() {
  const ref = useRef(null);
  const key = useCallback(() => (ref.current ??= newIdempotencyKey()), []);
  const renew = useCallback(() => {
    ref.current = null;
  }, []);
  return [key, renew];
}
