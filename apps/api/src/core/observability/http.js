import { randomUUID } from 'node:crypto';
import { pinoHttp } from 'pino-http';
import { logger } from './logger.js';
import { maybeCurrent } from '../tenancy/context.js';

const REQUEST_ID = /^[\w-]{8,64}$/;

/** Request id from CloudFront/ALB (x-request-id) or a new UUID; echoed in the response. */
export function requestId(req, res, next) {
  const incoming = req.headers['x-request-id'];
  req.id = typeof incoming === 'string' && REQUEST_ID.test(incoming) ? incoming : randomUUID();
  res.setHeader('x-request-id', req.id);
  next();
}

export const httpLogger = pinoHttp({
  logger,
  genReqId: (req) => req.id,
  autoLogging: { ignore: (req) => req.url === '/api/health' },
  customProps: () => {
    const c = maybeCurrent();
    return c ? { tenantId: c.tenantId, userId: c.userId } : {};
  },
  serializers: {
    req: (req) => ({ id: req.id, method: req.method, url: req.url }),
    res: (res) => ({ statusCode: res.statusCode }),
  },
});
