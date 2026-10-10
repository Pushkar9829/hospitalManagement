import { Router } from 'express';
import { setupModule } from './setup/index.js';

/**
 * Registers every business module. Each module folder exports `{ router, subscriptions? }` from
 * its index.js (PLAN section 3.1). Modules are added here phase by phase:
 *   Phase 1: platform, setup, users, patients, billing
 *   Phase 2: opd ...
 */
const MODULES = [setupModule];

export function mountModules() {
  const router = Router();
  for (const m of MODULES) router.use(m.router);
  return router;
}

/** Called by the worker so event subscribers are registered before events are processed. */
export function registerSubscriptions() {
  for (const m of MODULES) m.subscriptions?.();
}
