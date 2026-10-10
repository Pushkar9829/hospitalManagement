import { useTranslation } from 'react-i18next';
import { addAdminStrings } from '@hms/i18n/admin';

/**
 * Loads the admin screens' strings into the app's i18next instance. Each admin page calls it
 * first, so the strings arrive with the page's lazy chunk instead of the first bundle.
 */
export function useAdminStrings() {
  const { i18n } = useTranslation();
  addAdminStrings(i18n);
}
