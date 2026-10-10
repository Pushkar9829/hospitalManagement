import { makeBundle } from './bundle.js';
import { subscriptionEn } from './subscription.en.js';
import { subscriptionHi } from './subscription.hi.js';

export { subscriptionEn, subscriptionHi };

/** Adds the subscription screens' strings to an i18next instance (once), when those screens load. */
export const addSubscriptionStrings = makeBundle(subscriptionEn, subscriptionHi);
