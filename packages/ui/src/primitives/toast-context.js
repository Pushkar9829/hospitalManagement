import { createContext, useContext } from 'react';

export const ToastContext = createContext(null);

const noop = { toast: () => {}, dismiss: () => {} };

/**
 * `const { toast } = useToast(); toast({ title, description, tone })`. Toasts last 5 s and never
 * carry the only copy of an error: field errors stay under the field.
 */
export function useToast() {
  return useContext(ToastContext) ?? noop;
}
