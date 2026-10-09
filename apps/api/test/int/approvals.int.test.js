import { describe, expect, it } from 'vitest';
import { makeTenant, makeUser, signIn, useIntegration } from '../helpers/int.js';
import { runInContext } from '../../src/core/tenancy/context.js';
import { requestApproval } from '../../src/core/approvals/approval.service.js';
import { OutboxEvent } from '../../src/core/events/outbox.model.js';

const ctx = useIntegration();

/** A cashier raises a discount request inside their own context. */
async function raise(t, maker, overrides = {}) {
  return runInContext(
    {
      tenantId: String(t.tenant._id),
      userId: String(maker._id),
      userName: maker.name,
      permissions: new Set(['billing:*']),
    },
    () =>
      requestApproval({
        action: 'billing.discount',
        module: 'CORE',
        entity: 'Bill',
        entityId: 'OP/26-27/000155',
        title: '15% discount on OP/26-27/000155',
        payload: { discountPct: 15 },
        reason: 'Staff family',
        checkerPermission: 'approvals:inbox:decide',
        ...overrides,
      }),
  );
}

describe('maker-checker approvals', () => {
  it('lets a checker approve, never the maker, and publishes approval.decided', async () => {
    const t = await makeTenant();
    const maker = await makeUser(t, {
      username: 'cashier1',
      permissions: ['approvals:inbox:read', 'approvals:inbox:decide'],
    });
    const req = await raise(t, maker);

    const makerClient = await signIn(ctx.app, t.host, 'cashier1');
    const self = await makerClient
      .post(`/approvals/${req._id}/decision`)
      .send({ decision: 'APPROVE', version: req.version });
    expect(self.status).toBe(403);
    expect(self.body.error.code).toBe('MAKER_CANNOT_CHECK');

    const checker = await signIn(ctx.app, t.host); // superadmin
    const inbox = await checker.get('/approvals?status=PENDING');
    expect(inbox.body.items.map((i) => i.title)).toContain('15% discount on OP/26-27/000155');

    const reject = await checker
      .post(`/approvals/${req._id}/decision`)
      .send({ decision: 'REJECT', version: req.version });
    expect(reject.status).toBe(422);

    const stale = await checker
      .post(`/approvals/${req._id}/decision`)
      .send({ decision: 'APPROVE', version: req.version + 5 });
    expect(stale.body.error.code).toBe('VERSION_CONFLICT');

    const ok = await checker
      .post(`/approvals/${req._id}/decision`)
      .send({ decision: 'APPROVE', comment: 'Allowed', version: req.version });
    expect(ok.status).toBe(200);
    expect(ok.body).toMatchObject({ status: 'APPROVED', decidedByName: 'Admin User' });

    const again = await checker
      .post(`/approvals/${req._id}/decision`)
      .send({ decision: 'APPROVE', version: ok.body.version });
    expect(again.body.error.code).toBe('APPROVAL_CLOSED');

    const events = await OutboxEvent.find({ tenantId: t.tenant._id }).lean();
    expect(events.map((e) => e.type)).toEqual(['approval.requested', 'approval.decided']);
    expect(events[1].payload).toMatchObject({ status: 'APPROVED', payload: { discountPct: 15 } });

    const audit = await checker.get(`/audit?entity=Bill&action=APPROVE`);
    expect(audit.body.total).toBe(1);
  });

  it('allows only one open request per record and action', async () => {
    const t = await makeTenant();
    const maker = await makeUser(t, { username: 'cashier2', roles: ['cashier'] });
    await raise(t, maker);
    await expect(raise(t, maker)).rejects.toMatchObject({ code: 'APPROVAL_ALREADY_PENDING' });
  });

  it('shows makers only their own requests', async () => {
    const t = await makeTenant();
    const a = await makeUser(t, { username: 'makera', permissions: ['approvals:inbox:read'] });
    const b = await makeUser(t, { username: 'makerb', permissions: ['approvals:inbox:read'] });
    await raise(t, a, { entityId: 'A' });
    await raise(t, b, { entityId: 'B' });
    const ca = await signIn(ctx.app, t.host, 'makera');
    const list = await ca.get('/approvals');
    expect(list.body.items.map((i) => i.entityId)).toEqual(['A']);
  });
});
