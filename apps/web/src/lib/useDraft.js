import { useCallback, useEffect, useRef, useState } from 'react';
import { safeStorage } from '@hms/ui';

export const DRAFT_PREFIX = 'hms:draft:';

/**
 * Keeps a long form's values on this device so they survive a network drop, a session timeout
 * or a reload. `draft` is what was saved before (or null); `save(values)` is debounced.
 * Never use it for passwords, OTPs or card details.
 *
 *   const { draft, save, clear } = useDraft(`opd-consult:${visitId}`);
 */
export function useDraft(key, { debounceMs = 600 } = {}) {
  const storageKey = `${DRAFT_PREFIX}${key}`;
  const [draft] = useState(() => safeStorage.get(storageKey)?.values ?? null);
  const pending = useRef(null);
  const timer = useRef(null);

  const flush = useCallback(() => {
    clearTimeout(timer.current);
    if (pending.current !== null) {
      safeStorage.set(storageKey, { values: pending.current, savedAt: new Date().toISOString() });
      pending.current = null;
    }
  }, [storageKey]);

  const save = useCallback(
    (values) => {
      pending.current = values;
      clearTimeout(timer.current);
      timer.current = setTimeout(flush, debounceMs);
    },
    [flush, debounceMs],
  );

  const clear = useCallback(() => {
    clearTimeout(timer.current);
    pending.current = null;
    safeStorage.remove(storageKey);
  }, [storageKey]);

  useEffect(() => {
    window.addEventListener('pagehide', flush);
    return () => {
      window.removeEventListener('pagehide', flush);
      flush();
    };
  }, [flush]);

  return { draft, save, saveNow: flush, clear };
}

/**
 * Wires useDraft to a react-hook-form form: restores the draft once and saves on every change.
 * Returns the draft helpers plus `restored` (true when values came from a draft).
 */
export function useFormDraft(key, form, options) {
  const helpers = useDraft(key, options);
  const { draft, save } = helpers;
  const { reset, watch } = form;
  useEffect(() => {
    if (draft) reset(draft, { keepDefaultValues: true });
  }, [draft, reset]);
  useEffect(() => {
    const sub = watch((values) => save(values));
    return () => sub.unsubscribe();
  }, [watch, save]);
  return { ...helpers, restored: Boolean(draft) };
}

/** Removes every saved draft on this device (explicit sign-out). */
export function clearAllDrafts() {
  for (const k of safeStorage.keys(DRAFT_PREFIX)) safeStorage.remove(k);
}
