import { useCallback } from 'react';
import { useSelector } from 'react-redux';
import { hasPermission } from '@hms/shared';
import { selectSession } from '../app/session.js';

/**
 * `const can = useCan(); can('settings:branch:create')`. Buttons and tabs use it so a user only
 * sees actions their role allows; the API checks the same keys again.
 */
export function useCan() {
  const permissions = useSelector((s) => selectSession(s).data?.permissions);
  return useCallback((key) => hasPermission(permissions ?? [], key), [permissions]);
}
