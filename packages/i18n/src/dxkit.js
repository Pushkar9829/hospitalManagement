import { makeBundle } from './bundle.js';
import { dxkitEn } from './dxkit.en.js';
import { dxkitHi } from './dxkit.hi.js';

export { dxkitEn, dxkitHi };

/** Adds the shared screen kit's strings to an i18next instance (once). */
export const addDxkitStrings = makeBundle(dxkitEn, dxkitHi);
