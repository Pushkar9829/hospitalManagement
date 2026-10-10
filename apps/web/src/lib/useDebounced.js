import { useEffect, useState } from 'react';

/** A copy of `value` that follows it after `ms` without changes (search box → query). */
export function useDebounced(value, ms = 300) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setV(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return v;
}
