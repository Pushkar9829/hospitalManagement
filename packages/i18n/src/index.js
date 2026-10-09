import i18next from 'i18next';
import { en } from './en.js';
import { hi } from './hi.js';
import { validationHi } from './validation.js';

export { en, hi, validationHi };

/** Languages offered in the staff app, labelled in their own script. */
export const LANGUAGES = Object.freeze([
  { code: 'en', label: 'English' },
  { code: 'hi', label: 'हिन्दी' },
]);

export const DEFAULT_LANGUAGE = 'en';

export const resources = Object.freeze({
  en: { translation: en, validation: {} },
  hi: { translation: hi, validation: validationHi },
});

export function isSupportedLanguage(lng) {
  return LANGUAGES.some((l) => l.code === lng);
}

/**
 * A new, initialised i18next instance. Pass React's `initReactI18next` (or any other i18next
 * plugin) in `plugins` so the instance is registered before init.
 *
 * @param {string} [lng]
 * @param {{ plugins?: any[], extraResources?: Record<string, Record<string, object>> }} [options]
 */
export function createI18n(lng = DEFAULT_LANGUAGE, { plugins = [], extraResources } = {}) {
  const instance = i18next.createInstance();
  for (const plugin of plugins) instance.use(plugin);
  const merged = { en: { ...resources.en }, hi: { ...resources.hi } };
  for (const [code, namespaces] of Object.entries(extraResources ?? {})) {
    merged[code] = { ...merged[code], ...namespaces };
  }
  instance.init({
    lng: isSupportedLanguage(lng) ? lng : DEFAULT_LANGUAGE,
    fallbackLng: DEFAULT_LANGUAGE,
    supportedLngs: LANGUAGES.map((l) => l.code),
    ns: ['translation', 'validation'],
    defaultNS: 'translation',
    resources: merged,
    interpolation: { escapeValue: false },
    returnNull: false,
    initAsync: false,
    showSupportNotice: false,
  });
  return instance;
}

/**
 * Translates a Zod message from the shared schemas. The English text is the key and the
 * fallback, so untranslated messages still read correctly.
 */
export function translateValidation(t, message) {
  if (!message) return message;
  return t(message, {
    ns: 'validation',
    defaultValue: message,
    keySeparator: false,
    nsSeparator: false,
  });
}
