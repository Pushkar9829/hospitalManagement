import { createContext, useContext } from 'react';

/** Set by FormField so the control inside gets the right id, aria-describedby and aria-invalid. */
export const FieldContext = createContext(null);

/**
 * Merges the surrounding FormField's wiring with the control's own props (own props win).
 * @returns {{ id?: string, 'aria-describedby'?: string, 'aria-invalid'?: boolean, required?: boolean }}
 */
export function useFieldProps(props = {}) {
  const field = useContext(FieldContext);
  const invalid = props.invalid ?? props['aria-invalid'] ?? field?.invalid ?? false;
  const describedBy =
    [field?.describedBy, props['aria-describedby']].filter(Boolean).join(' ') || undefined;
  return {
    id: props.id ?? field?.id,
    'aria-describedby': describedBy,
    'aria-invalid': invalid ? true : undefined,
    required: props.required ?? field?.required,
  };
}
