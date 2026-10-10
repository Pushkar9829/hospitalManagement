import { createHmac } from 'node:crypto';
import express, { Router } from 'express';
import { z } from 'zod';
import { MODULE_CODES, PRICE_BOOK } from '@hms/shared';
import { mobile, objectId, pageQuery } from '@hms/shared/schemas';
import { env } from '../config/env.js';
import { AppError, errors } from '../core/errors/index.js';
import { defineRoutes } from '../core/http/route.js';
import { paginate } from '../core/http/paginate.js';
import { current, runInContext } from '../core/tenancy/context.js';
import { Tenant } from '../core/tenancy/tenant.model.js';
import { tenantRegistry } from '../core/tenancy/tenant.registry.js';
import { platformAudit } from './audit.js';
import { safeEqual } from '../core/security/crypto.js';
import {
  PlatformInvoice,
  PlatformUser,
  Subscription,
  WebhookEvent,
} from './models/platform.models.js';
import {
  PLATFORM_COOKIE,
  consoleHostOnly,
  platformAuthenticate,
  platformLogin,
  platformVerify,
  setPlatformCookie,
} from './auth.js';
import { invoiceDto, invoicePdf, recordPayment } from './services/invoices.service.js';
import * as subs from './services/subscription.service.js';
import {
  checkSubdomain,
  requestSignupOtp,
  signup,
  verifySignupOtp,
} from './services/signup.service.js';
import { metrics } from './services/metrics.service.js';

const quantities = z
  .object({
    branches: z.number().int().min(1).max(500),
    beds: z.number().int().min(0).max(5000),
    entities: z.number().int().min(1).max(50),
    users: z.number().int().min(1).max(100000),
  })
  .partial();
const convertBody = z.object({
  plan: z.enum(Object.keys(PRICE_BOOK.plans)).nullable().default(null),
  addOns: z.array(z.enum(MODULE_CODES)).default([]),
  cycle: z.enum(['MONTHLY', 'ANNUAL']).default('MONTHLY'),
  quantities: quantities.default({}),
});
const changeBody = z.object({
  add: z.array(z.enum(MODULE_CODES)).default([]),
  remove: z.array(z.enum(MODULE_CODES)).default([]),
});
const plans = () => ({
  version: PRICE_BOOK.version,
  currency: PRICE_BOOK.currency,
  gstRate: PRICE_BOOK.gstRate,
  annualMonthsCharged: PRICE_BOOK.annualMonthsCharged,
  trialDays: PRICE_BOOK.trialDays,
  plans: PRICE_BOOK.plans,
  modules: PRICE_BOOK.modules,
});

function sendPdf(res, buffer, name) {
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${name.replace(/\//g, '-')}.pdf"`);
  res.send(buffer);
}

// ---------------------------------------------------------------- hospital side (/api/v1)

export const hospitalSubscriptionRoutes = defineRoutes({
  module: 'CORE',
  basePath: '/subscription',
  routes: [
    {
      method: 'get',
      path: '/',
      permission: 'settings:subscription:read',
      audit: null,
      summary: 'Plan, modules, limits, usage, period and platform invoices',
      handler: () => subs.getSubscription(current().tenantId),
    },
    {
      method: 'post',
      path: '/preview',
      permission: 'settings:subscription:update',
      audit: null,
      summary: 'Price a module change: prorated charge now, next invoice, what blocks it',
      schema: { body: changeBody },
      handler: (req) => subs.previewChange(current().tenantId, req.valid.body),
    },
    {
      method: 'post',
      path: '/changes',
      permission: 'settings:subscription:update',
      audit: 'UPDATE',
      summary: 'Add modules (active once the prorated invoice is paid) or remove at renewal',
      schema: { body: changeBody },
      handler: (req) => subs.applyChange(current().tenantId, req.valid.body, current().userName),
    },
    {
      method: 'post',
      path: '/convert',
      permission: 'settings:subscription:update',
      audit: 'UPDATE',
      status: 201,
      summary: 'Choose a plan at the end of the trial: issues the first invoice',
      schema: { body: convertBody },
      handler: (req) => subs.convert(current().tenantId, req.valid.body),
    },
    {
      method: 'get',
      path: '/invoices/:id/pdf',
      permission: 'settings:subscription:read',
      audit: 'PRINT',
      summary: 'Platform invoice PDF',
      schema: { params: z.object({ id: objectId }) },
      handler: async (req, res) => {
        const inv = await PlatformInvoice.findOne({
          _id: req.valid.params.id,
          tenantId: current().tenantId,
        }).lean();
        if (!inv) throw errors.notFound('Invoice');
        sendPdf(res, await invoicePdf(inv), inv.number);
      },
    },
  ],
});

// ---------------------------------------------------------------- public signup (/api/public)

const publicRoutes = defineRoutes({
  module: 'CORE',
  mount: '/api/public',
  routes: [
    {
      method: 'get',
      path: '/plans',
      permission: 'public',
      audit: null,
      summary: 'Plans and prices for the pricing page',
      handler: () => plans(),
    },
    {
      method: 'get',
      path: '/subdomains/:name',
      permission: 'public',
      audit: null,
      summary: 'Is a hospital address free?',
      schema: { params: z.object({ name: z.string().max(40) }) },
      handler: (req) => checkSubdomain(req.valid.params.name),
    },
    {
      method: 'post',
      path: '/signup/otp',
      permission: 'public',
      audit: null,
      status: 202,
      summary: 'Send a code to verify the mobile',
      schema: { body: z.object({ mobile }) },
      handler: (req) => requestSignupOtp(req.valid.body),
    },
    {
      method: 'post',
      path: '/signup/otp/verify',
      permission: 'public',
      audit: null,
      summary: 'Verify the code; returns an otpToken for signup',
      schema: { body: z.object({ mobile, code: z.string().regex(/^\d{6}$/) }) },
      handler: (req) => verifySignupOtp(req.valid.body),
    },
    {
      method: 'post',
      path: '/signup',
      permission: 'public',
      audit: 'CREATE',
      status: 202,
      summary: 'Start a 14-day trial; answers with the link to set the first password',
      schema: {
        body: z.object({
          contact: z.object({
            name: z.string().trim().min(2).max(120),
            email: z.email(),
            mobile,
            otpToken: z.string().min(10).max(80),
          }),
          hospital: z.object({
            name: z.string().trim().min(3).max(120),
            city: z.string().trim().min(2).max(80),
            beds: z.number().int().min(0).max(5000).default(0),
          }),
          subdomain: z.string().trim().toLowerCase(),
          plan: z.enum(Object.keys(PRICE_BOOK.plans)).default('HOSPITAL'),
          acceptTermsVersion: z.string().min(4).max(20),
        }),
      },
      handler: (req) => signup(req.valid.body, { ip: req.ip }),
    },
  ],
});

export function publicRouter() {
  const r = Router();
  // Public calls run without a hospital; platform data only.
  r.use((req, _res, next) =>
    runInContext(
      {
        tenantId: null,
        permissions: new Set(),
        modules: new Set(['CORE']),
        requestId: req.id,
        ip: req.ip,
      },
      () => next(),
    ),
  );
  r.use(publicRoutes);
  return r;
}

// ---------------------------------------------------------------- console (/api/platform)

const consoleAuthRoutes = defineRoutes({
  module: 'CORE',
  mount: '/api/platform',
  basePath: '/auth',
  routes: [
    {
      method: 'post',
      path: '/login',
      permission: 'public',
      audit: null,
      summary: 'Platform staff sign-in (step 1)',
      schema: { body: z.object({ email: z.email(), password: z.string().min(1).max(128) }) },
      handler: (req) => platformLogin(req.valid.body),
    },
    {
      method: 'post',
      path: '/2fa/verify',
      permission: 'public',
      audit: null,
      summary: 'Platform staff sign-in (step 2, mandatory)',
      schema: {
        body: z.object({
          challengeId: z.string().min(16).max(64),
          code: z.string().regex(/^\d{6}$/),
        }),
      },
      handler: async (req, res) => {
        const { token, user } = await platformVerify(req.valid.body);
        setPlatformCookie(res, token);
        return { user };
      },
    },
    {
      method: 'post',
      path: '/logout',
      permission: 'public',
      audit: null,
      noBody: true,
      summary: 'Sign out of the console',
      handler: (_req, res) => {
        res.clearCookie(PLATFORM_COOKIE, { path: '/api/platform' });
      },
    },
  ],
});

const tenantDto = (t, sub) => ({
  id: String(t._id),
  name: t.name,
  subdomain: t.subdomain,
  status: t.status,
  statusReason: t.statusReason,
  statusChangedAt: t.statusChangedAt,
  plan: t.plan,
  trialEndsAt: t.trialEndsAt,
  modules: t.modules.map((m) => m.code),
  limits: t.limits,
  billing: t.billing,
  createdAt: t.createdAt,
  subscription: sub
    ? {
        plan: sub.plan,
        cycle: sub.cycle,
        converted: sub.converted,
        currentPeriod: sub.currentPeriod,
        addOns: sub.addOns,
        pending: sub.pending,
      }
    : undefined,
});

const consoleRoutes = defineRoutes({
  module: 'CORE',
  mount: '/api/platform',
  routes: [
    {
      method: 'get',
      path: '/auth/me',
      permission: 'authenticated',
      audit: null,
      summary: 'Signed-in platform user',
      handler: async () => {
        const u = await PlatformUser.findById(current().userId).lean();
        return {
          id: String(u._id),
          name: u.name,
          email: u.email,
          roles: u.roles,
          permissions: [...current().permissions],
        };
      },
    },
    {
      method: 'get',
      path: '/plans',
      permission: 'platform:plan:read',
      audit: null,
      summary: 'Price book',
      handler: () => plans(),
    },
    {
      method: 'get',
      path: '/metrics',
      permission: 'platform:metrics:read',
      audit: null,
      summary: 'MRR, ARR, tenants by state, trials, churn',
      handler: () => metrics(),
    },
    {
      method: 'get',
      path: '/tenants',
      permission: 'platform:tenant:read',
      audit: null,
      summary: 'Hospitals, searchable by name or address',
      schema: {
        query: pageQuery.extend({
          q: z.string().trim().max(60).optional(),
          status: z
            .enum(['TRIAL', 'ACTIVE', 'PAST_DUE', 'READ_ONLY', 'SUSPENDED', 'CLOSED'])
            .optional(),
        }),
      },
      handler: (req) => {
        const { q, status, ...page } = req.valid.query;
        const filter = {
          ...(status ? { status } : {}),
          ...(q
            ? {
                $or: [
                  { name: new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') },
                  { subdomain: q.toLowerCase() },
                ],
              }
            : {}),
        };
        return paginate(Tenant, filter, page, { map: (t) => tenantDto(t) });
      },
    },
    {
      method: 'get',
      path: '/tenants/:id',
      permission: 'platform:tenant:read',
      audit: null,
      summary: 'Hospital profile: plan, modules, usage, invoices',
      schema: { params: z.object({ id: objectId }) },
      handler: async (req) => {
        const t = await Tenant.findById(req.valid.params.id).lean();
        if (!t) throw errors.notFound('Tenant');
        return {
          ...tenantDto(t, await Subscription.findOne({ tenantId: t._id }).lean()),
          detail: await subs.getSubscription(t._id),
        };
      },
    },
    {
      method: 'post',
      path: '/tenants/:id/status',
      permission: 'platform:tenant:update',
      audit: 'UPDATE',
      summary: 'Suspend, reactivate or extend a trial (audited on both sides)',
      schema: {
        params: z.object({ id: objectId }),
        body: z.object({
          action: z.enum(['SUSPEND', 'REACTIVATE', 'EXTEND_TRIAL']),
          days: z.number().int().min(1).max(60).optional(),
          reason: z.string().trim().min(5).max(300),
        }),
      },
      handler: async (req) => {
        const { action, days, reason } = req.valid.body;
        const t = await Tenant.findById(req.valid.params.id);
        if (!t) throw errors.notFound('Tenant');
        if (action === 'EXTEND_TRIAL') {
          if (!['TRIAL', 'READ_ONLY'].includes(t.status))
            throw new AppError(409, 'INVALID_STATE', 'Only a trial can be extended');
          t.set({
            status: 'TRIAL',
            trialEndsAt: new Date(
              Math.max(Date.now(), t.trialEndsAt?.getTime() ?? 0) + (days ?? 7) * 86_400_000,
            ),
            statusChangedAt: new Date(),
            statusReason: reason,
          });
        } else if (action === 'SUSPEND')
          t.set({ status: 'SUSPENDED', statusChangedAt: new Date(), statusReason: reason });
        else
          t.set({
            status: (await Subscription.findOne({ tenantId: t._id }).lean())?.converted
              ? 'ACTIVE'
              : 'TRIAL',
            statusChangedAt: new Date(),
            statusReason: reason,
          });
        await t.save();
        await tenantRegistry.invalidate(t);
        await platformAudit(t._id, {
          action: 'UPDATE',
          entity: 'Tenant',
          entityId: t._id,
          summary: `Platform ${action}: ${reason}`,
          userName: `platform: ${current().userName}`,
        });
        return tenantDto(t);
      },
    },
    {
      method: 'post',
      path: '/tenants/:id/subscription',
      permission: 'platform:subscription:update',
      audit: 'UPDATE',
      status: 201,
      summary:
        'Sales: set the plan on behalf of a hospital (Enterprise needs an agreed monthly price)',
      schema: {
        params: z.object({ id: objectId }),
        body: convertBody.extend({ customMonthly: z.number().int().min(0).optional() }),
      },
      handler: (req) => subs.convert(req.valid.params.id, req.valid.body),
    },
    {
      method: 'get',
      path: '/invoices',
      permission: 'platform:invoice:read',
      audit: null,
      summary: 'Platform invoices',
      schema: {
        query: pageQuery.extend({
          status: z.enum(['ISSUED', 'PAID', 'VOID']).optional(),
          tenantId: objectId.optional(),
        }),
      },
      handler: (req) => {
        const { status, tenantId, ...page } = req.valid.query;
        return paginate(
          PlatformInvoice,
          { ...(status ? { status } : {}), ...(tenantId ? { tenantId } : {}) },
          { ...page, sort: '-createdAt' },
          { allowedSort: ['createdAt'], map: invoiceDto },
        );
      },
    },
    {
      method: 'post',
      path: '/invoices/:id/payments',
      permission: 'platform:invoice:update',
      audit: 'UPDATE',
      summary: 'Finance records a bank transfer against an invoice',
      schema: {
        params: z.object({ id: objectId }),
        body: z.object({
          reference: z.string().trim().min(4).max(60),
          amount: z.number().int().min(1),
        }),
      },
      handler: (req) =>
        recordPayment(
          req.valid.params.id,
          { provider: 'bank-transfer', ...req.valid.body, recordedBy: current().userName },
          { applyOnPaid: subs.applyOnPaid },
        ),
    },
    {
      method: 'get',
      path: '/invoices/:id/pdf',
      permission: 'platform:invoice:read',
      audit: null,
      summary: 'Invoice PDF',
      schema: { params: z.object({ id: objectId }) },
      handler: async (req, res) => {
        const inv = await PlatformInvoice.findById(req.valid.params.id).lean();
        if (!inv) throw errors.notFound('Invoice');
        sendPdf(res, await invoicePdf(inv), inv.number);
      },
    },
  ],
});

export function consoleRouter() {
  const r = Router();
  r.use(consoleHostOnly);
  r.use((req, _res, next) =>
    runInContext(
      {
        tenantId: null,
        permissions: new Set(),
        modules: new Set(['CORE']),
        requestId: req.id,
        ip: req.ip,
      },
      () => next(),
    ),
  );
  r.use(consoleAuthRoutes);
  r.use(platformAuthenticate);
  r.use(consoleRoutes);
  return r;
}

// ---------------------------------------------------------------- payment gateway webhook

/**
 * Razorpay webhook (spec 3.16): verify the signature over the raw body, store each event once,
 * then record the payment against the platform invoice named in the payment notes.
 */
export function webhookRouter() {
  const r = Router();
  r.post('/razorpay', express.raw({ type: '*/*', limit: '256kb' }), async (req, res, next) => {
    try {
      const signature = String(req.headers['x-razorpay-signature'] ?? '');
      const expected = env.RAZORPAY_WEBHOOK_SECRET
        ? createHmac('sha256', env.RAZORPAY_WEBHOOK_SECRET).update(req.body).digest('hex')
        : '';
      if (!expected || !safeEqual(signature, expected)) return res.status(400).end();
      const event = JSON.parse(req.body.toString('utf8'));
      const eventId = String(req.headers['x-razorpay-event-id'] ?? event.id ?? '');
      const stored = await WebhookEvent.updateOne(
        { provider: 'razorpay', eventId },
        { $setOnInsert: { type: event.event, payload: event } },
        { upsert: true },
      );
      if (!stored.upsertedCount) return res.status(200).json({ duplicate: true });
      const payment = event.payload?.payment?.entity;
      if (event.event === 'payment.captured' && payment?.notes?.platformInvoice) {
        const inv = await PlatformInvoice.findOne({ number: payment.notes.platformInvoice });
        if (inv) {
          await runInContext(
            {
              tenantId: null,
              permissions: new Set(),
              modules: new Set(['CORE']),
              userName: 'razorpay',
              requestId: req.id,
            },
            () =>
              recordPayment(
                inv._id,
                {
                  provider: 'razorpay',
                  reference: payment.id,
                  amount: payment.amount,
                  recordedBy: 'razorpay',
                },
                { applyOnPaid: subs.applyOnPaid },
              ),
          );
        }
      }
      await WebhookEvent.updateOne(
        { provider: 'razorpay', eventId },
        { $set: { processedAt: new Date() } },
      );
      res.status(200).json({ ok: true });
    } catch (err) {
      next(err);
    }
  });
  return r;
}
