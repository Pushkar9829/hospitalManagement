import { createContext, useContext } from 'react';
import { safeStorage } from '@hms/ui';
import { isSupportedLanguage } from '@hms/i18n';

export const THEME_KEY = 'hms:theme';
export const LANGUAGE_KEY = 'hms:lang';

/** The language saved on this device, used before i18n starts. */
export function storedLanguage() {
  const lang = safeStorage.get(LANGUAGE_KEY, 'en');
  return isSupportedLanguage(lang) ? lang : 'en';
}

export const PrefsContext = createContext({
  theme: 'light',
  setTheme: () => {},
  language: 'en',
  setLanguage: () => {},
});

/** Theme (light | dark | contrast) and language (en | hi), saved on this device. */
export function usePrefs() {
  return useContext(PrefsContext);
}
