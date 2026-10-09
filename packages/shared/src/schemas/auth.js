import { z } from 'zod';
import { mobile } from './common.js';

export const passwordPolicy = z
  .string()
  .min(10, 'Use at least 10 characters')
  .max(128)
  .regex(/[a-z]/, 'Add a lower-case letter')
  .regex(/[A-Z]/, 'Add an upper-case letter')
  .regex(/\d/, 'Add a number');

export const loginBody = z.object({
  username: z.string().trim().toLowerCase().min(2, 'Enter your username or mobile').max(80),
  password: z.string().min(1, 'Enter your password').max(128),
  rememberDevice: z.boolean().optional().default(false),
});

export const twoFactorVerifyBody = z.object({
  challengeId: z.string().min(16).max(64),
  code: z.string().regex(/^\d{6}$/, 'Enter the 6-digit code'),
});

export const otpRequestBody = z.object({ mobile });

export const otpVerifyBody = z.object({
  mobile,
  code: z.string().regex(/^\d{6}$/, 'Enter the 6-digit code'),
});

export const twoFactorEnableBody = z.object({
  code: z.string().regex(/^\d{6}$/, 'Enter the 6-digit code'),
});

export const changePasswordBody = z
  .object({ currentPassword: z.string().min(1), newPassword: passwordPolicy })
  .refine((v) => v.currentPassword !== v.newPassword, {
    path: ['newPassword'],
    message: 'Choose a password you have not used just now',
  });

export const switchBranchBody = z.object({ branchId: z.string().regex(/^[a-f\d]{24}$/i) });

/** GET /auth/me and the body of a successful login. */
export const sessionSchema = z.object({
  user: z.object({
    id: z.string(),
    name: z.string(),
    username: z.string(),
    designation: z.string().optional(),
    roles: z.array(z.object({ code: z.string(), name: z.string(), panel: z.string() })),
    twoFactorEnabled: z.boolean(),
    /** A role requires two-factor sign-in and it is not set up yet: every other API call returns 403 TWO_FACTOR_SETUP_REQUIRED. */
    twoFactorSetupRequired: z.boolean(),
    preferredLanguage: z.string(),
  }),
  tenant: z.object({
    id: z.string(),
    name: z.string(),
    subdomain: z.string(),
    status: z.string(),
    modules: z.array(z.string()),
  }),
  branch: z.object({ id: z.string(), name: z.string() }).nullable(),
  branches: z.array(z.object({ id: z.string(), name: z.string() })),
  permissions: z.array(z.string()),
  idleTimeoutMin: z.number(),
});

export const twoFactorChallenge = z.object({
  twoFactorRequired: z.literal(true),
  challengeId: z.string(),
});
