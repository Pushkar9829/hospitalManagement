import { Router } from 'express';
import { registerTenantSeeder } from '../../core/tenancy/provision.js';
import { registerFilePurpose } from '../../core/files/files.service.js';
import { branchRoutes, departmentRoutes, masterRoutes, settingsRoutes } from './setup.routes.js';
import { seedSetup } from './services/seed.service.js';
import * as numbering from './services/numbering.service.js';
import { registerDepartmentUsageCheck } from './services/department.service.js';

/**
 * Setup module (CORE): hospital settings and legal entities, branches, departments, numbering
 * series and masters with Excel import. Other modules use `numbering.next('OP_BILL')`,
 * `registerDepartmentUsageCheck()` and the models re-exported below.
 */
registerTenantSeeder('setup', seedSetup);
registerFilePurpose('master-import', {
  mimes: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'text/csv'],
  maxBytes: 5 * 1024 * 1024,
  write: 'settings:master:import',
  read: 'settings:master:import',
});

const router = Router();
router.use(settingsRoutes, branchRoutes, departmentRoutes, masterRoutes);

export const setupModule = { name: 'setup', router };
export { numbering, registerDepartmentUsageCheck };
export { Department } from './models/department.model.js';
export { HospitalSettings } from './models/settings.model.js';
export {
  PaymentMode,
  PriceList,
  Service,
  TaxCode,
  ReferralSource,
} from './models/masters.models.js';
