import { makeBundle } from './bundle.js';
import { signupEn } from './signup.en.js';
import { signupHi } from './signup.hi.js';

export { signupEn, signupHi };

/** Adds the signup screens' strings to an i18next instance (once), when those screens load. */
export const addSignupStrings = makeBundle(signupEn, signupHi);
