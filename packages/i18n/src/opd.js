import { makeBundle } from './bundle.js';
import { opdEn } from './opd.en.js';
import { opdHi } from './opd.hi.js';

export { opdEn, opdHi };

/** Adds the OPD and front-office screens' strings to an i18next instance (once). */
export const addOpdStrings = makeBundle(opdEn, opdHi);
