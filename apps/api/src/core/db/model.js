import mongoose from 'mongoose';
import { basePlugin } from './base.plugin.js';
import { tenantPlugin } from '../tenancy/tenant.plugin.js';
import { auditPlugin } from '../audit/audit.plugin.js';
import { AppError, errors } from '../errors/index.js';

/** Platform models (tenants, plans) that live outside any one hospital. */
export const PLATFORM_MODELS = new Set();

/**
 * The only way modules create models: applies the base, tenant and audit plugins in order.
 * Options: `tenant: false` for platform models, `audit: false` for logs and counters,
 * `base: false` for append-only collections.
 */
export function defineModel(name, schema, { tenant = true, audit = true, base = true } = {}) {
  if (mongoose.models[name]) return mongoose.models[name];
  if (base) schema.plugin(basePlugin);
  if (tenant) schema.plugin(tenantPlugin);
  else PLATFORM_MODELS.add(name);
  if (audit) schema.plugin(auditPlugin, { entity: name });
  return mongoose.model(name, schema);
}

/** Runs `fn` in one MongoDB transaction; nested calls join the outer one. Retries on transient errors. */
export function withTransaction(fn) {
  return mongoose.connection.transaction(fn);
}

/**
 * Optimistic update for query-style writes: applies `update` only if the stored version matches,
 * otherwise 409 VERSION_CONFLICT (or 404 when the record does not exist).
 */
export async function updateVersioned(Model, id, version, update, { notFound = 'Record' } = {}) {
  const hasOperators = Object.keys(update).some((k) => k.startsWith('$'));
  const { version: _ignored, ...fields } = update;
  const doc = await Model.findOneAndUpdate(
    { _id: id, version },
    hasOperators ? update : { $set: fields },
    {
      new: true,
      runValidators: true,
    },
  );
  if (doc) return doc;
  if (await Model.exists({ _id: id })) throw errors.versionConflict();
  throw new AppError(404, 'NOT_FOUND', `${notFound} not found`);
}
