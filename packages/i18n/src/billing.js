import { makeBundle } from './bundle.js';
import { billingEn } from './billing.en.js';
import { billingHi } from './billing.hi.js';

export { billingEn, billingHi };

/** Adds the billing screens' strings to an i18next instance (once), when those screens load. */
export const addBillingStrings = makeBundle(billingEn, billingHi);
