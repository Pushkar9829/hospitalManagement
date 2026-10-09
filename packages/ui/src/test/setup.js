import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import { initReactI18next } from 'react-i18next';
import { createI18n } from '@hms/i18n';

createI18n('en', { plugins: [initReactI18next] });

// jsdom gaps used by Radix and cmdk.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};
Element.prototype.scrollIntoView ??= function scrollIntoView() {};
Element.prototype.hasPointerCapture ??= () => false;
Element.prototype.releasePointerCapture ??= () => {};

afterEach(() => {
  cleanup();
  localStorage.clear();
});
