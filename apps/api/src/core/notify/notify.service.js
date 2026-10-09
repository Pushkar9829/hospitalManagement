import { env } from '../../config/env.js';
import { logger } from '../observability/logger.js';
import { SMS_TEMPLATES, renderTemplate } from './templates.js';

/** Providers implement send({ to, text, dltId }). Real providers are added at go-live. */
const providers = {
  console: {
    async send({ to, text }) {
      // Development only: shows the message instead of sending it. Never enabled in production.
      logger.info({ to: `******${String(to).slice(-4)}`, text }, 'SMS (console provider)');
      return { id: `console-${Date.now()}` };
    },
  },
};

/** Test hook: lets tests read messages the console provider "sent". */
export const outbox = [];

export async function sendSms({ to, template, vars, lang = 'en' }) {
  const t = SMS_TEMPLATES[template];
  if (!t) throw new Error(`Unknown SMS template ${template}`);
  const provider = providers[env.SMS_PROVIDER];
  if (!provider) throw new Error(`SMS provider ${env.SMS_PROVIDER} is not configured`);
  if (env.isProd && env.SMS_PROVIDER === 'console')
    throw new Error('Console SMS provider is not allowed in production');
  const text = renderTemplate(t, lang, vars);
  if (env.isTest) outbox.push({ to, template, text, vars });
  return provider.send({ to, text, dltId: t.dltId });
}
