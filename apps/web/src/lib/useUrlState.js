import { useCallback } from 'react';
import { useSearchParams } from 'react-router';

/**
 * One value kept in the URL query (`?tab=branches`), so a reload or a shared link opens the same
 * view. Setting the default value removes the parameter. Other parameters are kept.
 */
export function useUrlState(key, defaultValue = '') {
  const [params, setParams] = useSearchParams();
  const value = params.get(key) ?? defaultValue;
  const setValue = useCallback(
    (next, { replace = true, reset = [] } = {}) => {
      setParams(
        (prev) => {
          const p = new URLSearchParams(prev);
          if (next == null || next === '' || next === defaultValue) p.delete(key);
          else p.set(key, String(next));
          for (const k of reset) p.delete(k);
          return p;
        },
        { replace },
      );
    },
    [key, defaultValue, setParams],
  );
  return [value, setValue];
}
