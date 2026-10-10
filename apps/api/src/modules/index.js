import { Router } from 'express';
import { setupModule } from './setup/index.js';
import { usersModule } from './users/index.js';
import { patientsModule } from './patients/index.js';

/**
 * Registers every business module. Each module folder exports `{ router, subscriptions? }` from
 * its index.js (PLAN section 3.1). Modules are added here phase by phase:
 *   Phase 1: platform, setup, users, patients, billing
 *   Phase 2: opd ...
 */
const MODULES = [setupModule, usersModule, patientsModule];

export function mountModules() {
  const router = Router();
  for (const m of MODULES) router.use(m.router);
  return router;
}

/** Routes a module serves before sign-in (e.g. accepting an invitation). */
export function mountPublicModules() {
  const router = Router();
  for (const m of MODULES) if (m.publicRouter) router.use(m.publicRouter);
  return router;
}

/** Called by the worker so event subscribers are registered before events are processed. */
export function registerSubscriptions() {
  for (const m of MODULES) m.subscriptions?.();
}
