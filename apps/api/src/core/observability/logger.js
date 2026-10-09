import pino from 'pino';
import { env } from '../../config/env.js';

/**
 * Structured JSON logs (CloudWatch in production). Patient clinical data and secrets must never
 * be logged: these paths are redacted as a safety net.
 */
export const logger = pino({
  level: env.isTest ? 'silent' : env.LOG_LEVEL,
  base: { service: 'hms-api' },
  redact: {
    paths: [
      'req.headers.cookie',
      'req.headers.authorization',
      'res.headers["set-cookie"]',
      '*.password',
      '*.passwordHash',
      '*.newPassword',
      '*.currentPassword',
      '*.otp',
      '*.secret',
      '*.token',
    ],
    censor: '[redacted]',
  },
  transport:
    env.NODE_ENV === 'development'
      ? { target: 'pino-pretty', options: { singleLine: true } }
      : undefined,
});
