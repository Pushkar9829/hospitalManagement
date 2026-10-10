import { z } from 'zod';
import { generateKeyPairSync, randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const bool = z.enum(['true', 'false', '1', '0']).transform((v) => v === 'true' || v === '1');

const Env = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().default(4000),
    MONGO_URI: z.string().min(1, 'MONGO_URI is required'),
    REDIS_URL: z.string().min(1, 'REDIS_URL is required'),
    ROOT_DOMAIN: z.string().default('localhost'),
    /**
     * Proxy hops in front of the API. Production (CloudFront -> ALB) is 2, so req.ip is the real
     * client; 0 locally so a spoofed X-Forwarded-For cannot dodge rate limits.
     */
    TRUST_PROXY: z.coerce.number().int().min(0).max(5).default(0),
    JWT_PRIVATE_KEY: z.string().default(''),
    JWT_PUBLIC_KEY: z.string().default(''),
    /** 32-byte key (base64) for encrypting secrets at rest, e.g. TOTP secrets. */
    DATA_ENCRYPTION_KEY: z.string().default(''),
    ACCESS_TOKEN_TTL_MIN: z.coerce.number().int().min(1).max(60).default(15),
    REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().min(1).max(30).default(7),
    SESSION_TTL_HOURS: z.coerce.number().int().min(1).max(24).default(12),
    IDLE_TIMEOUT_MIN: z.coerce.number().int().min(5).max(120).default(15),
    COOKIE_SECURE: bool.optional(),
    SMS_PROVIDER: z.enum(['console', 'msg91']).default('console'),
    AWS_REGION: z.string().default('ap-south-1'),
    S3_DOCS_BUCKET: z.string().default(''),
    LOG_LEVEL: z
      .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
      .default('info'),
    ENABLE_API_DOCS: bool.optional(),
  })
  .superRefine((v, ctx) => {
    if (v.NODE_ENV !== 'production') return;
    if (v.TRUST_PROXY === 0)
      ctx.addIssue({
        code: 'custom',
        path: ['TRUST_PROXY'],
        message: 'Set TRUST_PROXY (2 behind CloudFront + ALB) in production',
      });
    for (const k of [
      'JWT_PRIVATE_KEY',
      'JWT_PUBLIC_KEY',
      'DATA_ENCRYPTION_KEY',
      'S3_DOCS_BUCKET',
    ]) {
      if (!v[k])
        ctx.addIssue({ code: 'custom', path: [k], message: `${k} is required in production` });
    }
  });

const here = dirname(fileURLToPath(import.meta.url));
const keyDir = resolve(here, '../../.keys');

/**
 * Development and test get a generated RS256 key pair and data key so the API starts with no
 * secrets. Development keeps them in apps/api/.keys (git-ignored) so sessions survive restarts.
 */
function devSecrets(nodeEnv) {
  const file = resolve(keyDir, 'dev-secrets.json');
  if (nodeEnv === 'development' && existsSync(file)) return JSON.parse(readFileSync(file, 'utf8'));
  const { privateKey, publicKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    publicKeyEncoding: { type: 'spki', format: 'pem' },
  });
  const secrets = { privateKey, publicKey, dataKey: randomBytes(32).toString('base64') };
  if (nodeEnv === 'development') {
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, JSON.stringify(secrets), { mode: 0o600 });
  }
  return secrets;
}

export function loadEnv(source = process.env) {
  const parsed = Env.safeParse(source);
  if (!parsed.success) {
    const lines = parsed.error.issues.map((i) => `  ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Invalid environment configuration:\n${lines}`);
  }
  const v = { ...parsed.data };
  const unescape = (s) => s.replace(/\\n/g, '\n');
  v.JWT_PRIVATE_KEY = unescape(v.JWT_PRIVATE_KEY);
  v.JWT_PUBLIC_KEY = unescape(v.JWT_PUBLIC_KEY);
  if (!v.JWT_PRIVATE_KEY || !v.JWT_PUBLIC_KEY || !v.DATA_ENCRYPTION_KEY) {
    const s = devSecrets(v.NODE_ENV);
    v.JWT_PRIVATE_KEY ||= s.privateKey;
    v.JWT_PUBLIC_KEY ||= s.publicKey;
    v.DATA_ENCRYPTION_KEY ||= s.dataKey;
  }
  if (Buffer.from(v.DATA_ENCRYPTION_KEY, 'base64').length !== 32) {
    throw new Error('DATA_ENCRYPTION_KEY must be 32 bytes, base64 encoded');
  }
  v.COOKIE_SECURE ??= v.NODE_ENV === 'production';
  v.ENABLE_API_DOCS ??= v.NODE_ENV !== 'production';
  v.isProd = v.NODE_ENV === 'production';
  v.isTest = v.NODE_ENV === 'test';
  return Object.freeze(v);
}

/** Validated configuration. The process crashes on boot if it is wrong. */
export const env = loadEnv();
