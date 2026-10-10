import { describe, expect, it } from 'vitest';
import { createI18n, en, hi, translateValidation } from './index.js';
import { addAdminStrings, adminModulesEn, adminModulesHi } from './admin.js';

/** Every leaf key path in a nested object, e.g. `login.title`. */
function keys(obj, prefix = '') {
  return Object.entries(obj).flatMap(([k, v]) =>
    v && typeof v === 'object' ? keys(v, `${prefix}${k}.`) : [`${prefix}${k}`],
  );
}

function placeholders(str) {
  return [...String(str).matchAll(/{{\s*(\w+)\s*}}/g)].map((m) => m[1]).sort();
}

describe('@hms/i18n', () => {
  it('has a Hindi string for every English key, with the same placeholders', () => {
    const enKeys = keys(en);
    const hiKeys = new Set(keys(hi));
    expect(enKeys.filter((k) => !hiKeys.has(k))).toEqual([]);
    const get = (o, path) => path.split('.').reduce((a, k) => a[k], o);
    for (const k of enKeys) expect(placeholders(get(hi, k)), k).toEqual(placeholders(get(en, k)));
  });

  it('has Hindi for every admin screen string, with the same placeholders', () => {
    const enKeys = keys(adminModulesEn);
    const hiKeys = new Set(keys(adminModulesHi));
    expect(enKeys.filter((k) => !hiKeys.has(k))).toEqual([]);
    expect(keys(adminModulesHi).filter((k) => !enKeys.includes(k))).toEqual([]);
    const get = (o, path) => path.split('.').reduce((a, k) => a[k], o);
    for (const k of enKeys)
      expect(placeholders(get(adminModulesHi, k)), k).toEqual(placeholders(get(adminModulesEn, k)));
  });

  it('translates admin strings to Hindi, not copies of the English', () => {
    // Values that are acronyms, codes or placeholders only may stay the same.
    const same = keys(adminModulesEn).filter((k) => {
      const get = (o) => k.split('.').reduce((a, x) => a[x], o);
      const e = get(adminModulesEn);
      return e === get(adminModulesHi) && /[a-z]{4,}/.test(e.replace(/{{\s*\w+\s*}}/g, ''));
    });
    expect(same).toEqual([]);
  });

  it('adds the admin strings to an instance once, on demand', () => {
    const i18n = createI18n('hi');
    expect(i18n.exists('approvals.approve')).toBe(false);
    addAdminStrings(i18n);
    addAdminStrings(i18n);
    expect(i18n.t('approvals.approve')).toBe('मंज़ूर करें');
    expect(i18n.t('common.save')).toBe('सेव करें');
  });

  it('writes Hindi in Devanagari', () => {
    expect(hi.common.save).toMatch(/[ऀ-ॿ]/);
    expect(hi.login.submit).toMatch(/[ऀ-ॿ]/);
  });

  it('creates independent instances with interpolation', () => {
    const a = createI18n('en');
    const b = createI18n('hi');
    expect(a.t('home.morning', { name: 'Anjali' })).toBe('Good morning, Anjali');
    expect(b.t('home.morning', { name: 'Anjali' })).toBe('सुप्रभात, Anjali');
    expect(a.language).toBe('en');
  });

  it('falls back to English for unsupported languages', () => {
    expect(createI18n('fr').language).toBe('en');
  });

  it('translates shared Zod messages and falls back to the English text', () => {
    const i18n = createI18n('hi');
    expect(translateValidation(i18n.t, 'Enter your password')).toBe('अपना पासवर्ड डालें');
    expect(translateValidation(i18n.t, 'Some new rule.')).toBe('Some new rule.');
  });
});
