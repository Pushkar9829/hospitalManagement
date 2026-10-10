import { useTranslation } from 'react-i18next';

/**
 * Loads lazily bundled screen strings (`@hms/i18n/patients`, `/billing`, …) into the app's
 * i18next instance. A page calls it first, so the strings arrive with the page's chunk.
 *
 *   useStrings(addAdminStrings, addPatientsStrings);
 */
export function useStrings(...adders) {
  const { i18n } = useTranslation();
  for (const add of adders) add(i18n);
}
