import { useState } from 'react';
import { Input } from '@hms/ui';
import { aadhaarDisplay } from '../patientForm.js';

/**
 * Aadhaar number: typed in full (12 digits, the API keeps only a salted hash and the last four),
 * shown masked as XXXX XXXX 1234 as soon as the field is left. A masked number from the API is
 * replaced by typing over it.
 */
export function AadhaarInput({ value, onChange, onBlur, name, ...props }) {
  const [focused, setFocused] = useState(false);
  const masked = /X/i.test(String(value ?? ''));
  return (
    <Input
      {...props}
      name={name}
      mono
      inputMode={masked ? 'text' : 'numeric'}
      autoComplete="off"
      spellCheck={false}
      value={aadhaarDisplay(value, focused)}
      onFocus={(e) => {
        setFocused(true);
        if (masked) e.target.select();
      }}
      onBlur={(e) => {
        setFocused(false);
        onBlur?.(e);
      }}
      onChange={(e) => onChange(e.target.value.replace(/[^\dXx\s-]/g, '').slice(0, 14))}
    />
  );
}
