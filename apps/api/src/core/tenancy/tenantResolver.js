import { runInContext } from './context.js';
import { tenantRegistry } from './tenant.registry.js';
import { AppError } from '../errors/index.js';

const READ_ONLY_OK = new Set(['GET', 'HEAD', 'OPTIONS']);

/** Host header -> tenant; enforces subscription state; opens the request context. */
export async function tenantResolver(req, _res, next) {
  const tenant = await tenantRegistry.byHost(req.hostname ?? '');
  if (!tenant) return next(new AppError(404, 'TENANT_NOT_FOUND', 'Unknown hospital address'));
  const isAuthCall = req.path.startsWith('/auth/');
  if (tenant.status === 'CLOSED')
    return next(new AppError(404, 'TENANT_NOT_FOUND', 'Unknown hospital address'));
  if (tenant.status === 'SUSPENDED' && !req.path.startsWith('/subscription')) {
    return next(new AppError(402, 'TENANT_SUSPENDED', 'This hospital’s subscription is suspended'));
  }
  if (
    tenant.status === 'READ_ONLY' &&
    !READ_ONLY_OK.has(req.method) &&
    !isAuthCall &&
    !req.path.startsWith('/subscription')
  ) {
    return next(
      new AppError(
        402,
        'TENANT_READ_ONLY',
        'Read-only mode: new records are paused until the subscription is renewed',
      ),
    );
  }
  req.tenant = tenant;
  runInContext(
    {
      tenantId: tenant.id,
      tenant,
      modules: new Set(tenant.modules),
      requestId: req.id,
      ip: req.ip,
    },
    () => next(),
  );
}
