import { makeBundle } from './bundle.js';
import { patientsEn } from './patients.en.js';
import { patientsHi } from './patients.hi.js';

export { patientsEn, patientsHi };

/** Adds the patients screens' strings to an i18next instance (once), when those screens load. */
export const addPatientsStrings = makeBundle(patientsEn, patientsHi);
