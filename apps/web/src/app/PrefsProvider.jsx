import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { THEMES, safeStorage } from '@hms/ui';
import { isSupportedLanguage } from '@hms/i18n';
import { LANGUAGE_KEY, PrefsContext, THEME_KEY } from './prefs-context.js';

export function PrefsProvider({ children }) {
  const { i18n } = useTranslation();
  const [theme, setThemeState] = useState(() => {
    const t = safeStorage.get(THEME_KEY, 'light');
    return THEMES.includes(t) ? t : 'light';
  });
  const [language, setLanguageState] = useState(() => i18n.language ?? 'en');

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'light') delete root.dataset.theme;
    else root.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    document.documentElement.lang = language;
    if (i18n.language !== language) i18n.changeLanguage(language);
  }, [language, i18n]);

  const setTheme = useCallback((t) => {
    if (!THEMES.includes(t)) return;
    safeStorage.set(THEME_KEY, t);
    setThemeState(t);
  }, []);

  const setLanguage = useCallback((lng) => {
    if (!isSupportedLanguage(lng)) return;
    safeStorage.set(LANGUAGE_KEY, lng);
    setLanguageState(lng);
  }, []);

  const value = useMemo(
    () => ({ theme, setTheme, language, setLanguage }),
    [theme, setTheme, language, setLanguage],
  );
  return <PrefsContext.Provider value={value}>{children}</PrefsContext.Provider>;
}
