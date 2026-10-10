import { MASTERS } from '@hms/shared/schemas';
import { formatINR, toPaise } from '@hms/shared';
import { AppError, errors } from '../../../core/errors/index.js';
import { withTransaction } from '../../../core/db/model.js';
import { paginate } from '../../../core/http/paginate.js';
import { Branch } from '../../../core/tenancy/branch.model.js';
import { onApprovalDecided, requestApproval } from '../../../core/approvals/approval.service.js';
import { Department } from '../models/department.model.js';
import {
  Designation,
  Holiday,
  PaymentMode,
  PriceList,
  ReferralSource,
  Service,
  TaxCode,
  Unit,
} from '../models/masters.models.js';

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const byCode = async (Model, codes, filter = {}) =>
  new Map(
    (await Model.find({ code: { $in: [...new Set(codes)] }, ...filter }).lean()).map((d) => [
      d.code,
      d,
    ]),
  );

/**
 * One definition per master type: its model, how input becomes a document (resolving codes to
 * ids), and how a document is shown. `resolve` gets all rows at once so imports stay fast.
 */
export const TYPES = {
  'price-lists': { model: PriceList, dto: (d) => ({ kind: d.kind, isDefault: d.isDefault }) },
  'tax-codes': { model: TaxCode, dto: (d) => ({ kind: d.kind, rate: d.rate, hsnSac: d.hsnSac }) },
  'payment-modes': {
    model: PaymentMode,
    dto: (d) => ({ kind: d.kind, requiresReference: d.requiresReference }),
  },
  'referral-sources': { model: ReferralSource, dto: (d) => ({ kind: d.kind, phone: d.phone }) },
  units: { model: Unit, dto: (d) => ({ baseUnit: d.baseUnit, factor: d.factor }) },
  designations: { model: Designation, dto: (d) => ({ grade: d.grade }) },
  holidays: {
    model: Holiday,
    async resolve(rows) {
      const branches = await byCode(
        Branch,
        rows.flatMap((r) => r.branchCodes),
      );
      return rows.map(({ branchCodes, ...r }) => {
        const missing = branchCodes.filter((c) => !branches.has(c));
        if (missing.length)
          return {
            error: { path: 'branchCodes', message: `Unknown branch ${missing.join(', ')}` },
          };
        return { doc: { ...r, branchIds: branchCodes.map((c) => branches.get(c)._id) } };
      });
    },
    dto: (d) => ({ date: d.date, branchIds: (d.branchIds ?? []).map(String) }),
  },
  services: {
    model: Service,
    async resolve(rows) {
      const depts = await byCode(Department, rows.map((r) => r.departmentCode).filter(Boolean), {
        status: 'ACTIVE',
      });
      const taxes = await byCode(
        TaxCode,
        rows.map((r) => r.taxCode),
        { isActive: true },
      );
      const lists = await byCode(
        PriceList,
        rows.flatMap((r) => Object.keys(r.rates)),
        { isActive: true },
      );
      return rows.map(({ departmentCode, taxCode, rates, ...r }) => {
        if (departmentCode && !depts.has(departmentCode))
          return {
            error: { path: 'departmentCode', message: `No active department ${departmentCode}` },
          };
        if (!taxes.has(taxCode))
          return { error: { path: 'taxCode', message: `No active tax code ${taxCode}` } };
        const unknown = Object.keys(rates).filter((c) => !lists.has(c));
        if (unknown.length)
          return { error: { path: 'rates', message: `Unknown price list ${unknown.join(', ')}` } };
        return {
          doc: {
            ...r,
            departmentId: departmentCode ? depts.get(departmentCode)._id : undefined,
            taxCodeId: taxes.get(taxCode)._id,
            rates: Object.entries(rates).map(([c, rupees]) => ({
              priceListId: lists.get(c)._id,
              amount: toPaise(rupees),
            })),
          },
        };
      });
    },
    dto: (d) => ({
      category: d.category,
      departmentId: d.departmentId && String(d.departmentId),
      taxCodeId: String(d.taxCodeId),
      revenueHead: d.revenueHead,
      rates: d.rates.map((r) => ({ priceListId: String(r.priceListId), amount: r.amount })),
      pendingRates: d.pendingRates?.map((r) => ({
        priceListId: String(r.priceListId),
        amount: r.amount,
      })),
      status: d.status,
    }),
  },
};

export function typeOf(type) {
  const t = TYPES[type];
  if (!t || !MASTERS[type]) throw errors.notFound('Master type');
  return t;
}

export const toDto = (type, d) => ({
  id: String(d._id),
  code: d.code,
  name: d.name,
  isActive: d.isActive,
  version: d.version,
  ...TYPES[type].dto(d),
});

/** Turns validated rows into documents, or row errors. */
export async function resolveRows(type, rows) {
  const t = typeOf(type);
  return t.resolve ? t.resolve(rows) : rows.map((r) => ({ doc: r }));
}

export async function listMasters(type, { q, active, ...page }) {
  const t = typeOf(type);
  const filter = {};
  if (active !== undefined) filter.isActive = active;
  if (q)
    filter.$or = [
      { code: new RegExp(`^${escapeRegex(q.toUpperCase())}`) },
      { name: new RegExp(escapeRegex(q), 'i') },
    ];
  return paginate(t.model, filter, page, {
    allowedSort: ['code', 'name', 'createdAt'],
    defaultSort: 'name',
    map: (d) => toDto(type, d),
  });
}

const sameRates = (a = [], b = []) =>
  a.length === b.length &&
  a.every((r) =>
    b.some((x) => String(x.priceListId) === String(r.priceListId) && x.amount === r.amount),
  );

function describeRates(rates, lists) {
  return Object.fromEntries(
    rates.map((r) => [
      lists.get(String(r.priceListId)) ?? String(r.priceListId),
      formatINR(r.amount),
    ]),
  );
}

/** A tariff change (new service or new rates) waits for Super Admin approval (spec 4.5). */
async function requestTariffApproval(services, { reason, title }) {
  const lists = new Map(
    (await PriceList.find().select('code').lean()).map((l) => [String(l._id), l.code]),
  );
  return requestApproval({
    action: 'billing.tariffChange',
    module: 'CORE',
    entity: services.length === 1 ? 'Service' : 'ServiceImport',
    entityId: services.length === 1 ? services[0]._id : `${Date.now()}-${services.length}`,
    title,
    before: Object.fromEntries(
      services.map((s) => [s.code, s.status === 'ACTIVE' ? describeRates(s.rates, lists) : null]),
    ),
    after: Object.fromEntries(
      services.map((s) => [s.code, describeRates(s.pendingRates ?? s.rates, lists)]),
    ),
    payload: { serviceIds: services.map((s) => String(s._id)) },
    reason: reason || title,
  });
}

/** Creates one master. Services start PENDING_APPROVAL. */
export async function createMaster(type, input, { reason } = {}) {
  const t = typeOf(type);
  const [res] = await resolveRows(type, [input]);
  if (res.error) throw errors.validation([res.error]);
  if (await t.model.exists({ code: input.code }))
    throw errors.validation([{ path: 'code', message: 'This code is already used' }]);
  return withTransaction(async () => {
    const [doc] = await t.model.create([res.doc]);
    if (type === 'price-lists' && doc.isDefault)
      await PriceList.updateMany({ _id: { $ne: doc._id } }, { $set: { isDefault: false } });
    let approvalId = null;
    if (type === 'services') {
      const approval = await requestTariffApproval([doc], {
        reason,
        title: `New service ${doc.code} ${doc.name}`,
      });
      if (!approval) doc.status = 'ACTIVE';
      approvalId = approval ? String(approval._id) : null;
      doc.approvalId = approval?._id;
      doc.isActive = doc.status === 'ACTIVE';
      await doc.save();
    }
    return { item: toDto(type, doc), approvalId };
  });
}

/** Updates one master. For services, rate changes become pending until approved. */
export async function updateMaster(type, id, { version, ...input }, { reason } = {}) {
  const t = typeOf(type);
  const doc = await t.model.findById(id);
  if (!doc) throw errors.notFound('Record');
  if (doc.version !== version) throw errors.versionConflict();
  if (input.code !== doc.code)
    throw errors.validation([
      { path: 'code', message: 'The code cannot change; add a new record instead' },
    ]);
  const [res] = await resolveRows(type, [input]);
  if (res.error) throw errors.validation([res.error]);
  return withTransaction(async () => {
    let approvalId = null;
    if (type === 'services') {
      const { rates, ...rest } = res.doc;
      doc.set(rest);
      if (!sameRates(rates, doc.rates)) {
        if (doc.status === 'PENDING_APPROVAL')
          throw new AppError(
            409,
            'APPROVAL_ALREADY_PENDING',
            'Rates of this service are already waiting for approval',
          );
        if (doc.status === 'ACTIVE') doc.pendingRates = rates;
        else {
          doc.rates = rates;
          doc.status = 'PENDING_APPROVAL';
        }
        await doc.save();
        const approval = await requestTariffApproval([doc], {
          reason,
          title: `Change rates of ${doc.code} ${doc.name}`,
        });
        if (!approval) await applyTariff(doc, true);
        approvalId = approval ? String(approval._id) : null;
      }
    } else {
      doc.set(res.doc);
    }
    await doc.save();
    if (type === 'price-lists' && doc.isDefault)
      await PriceList.updateMany({ _id: { $ne: doc._id } }, { $set: { isDefault: false } });
    return { item: toDto(type, doc), approvalId };
  });
}

export async function setMasterActive(type, id, { version, active }) {
  const t = typeOf(type);
  const doc = await t.model.findById(id);
  if (!doc) throw errors.notFound('Record');
  if (doc.version !== version) throw errors.versionConflict();
  if (type === 'services' && active && doc.status !== 'INACTIVE')
    throw new AppError(409, 'INVALID_STATE', 'Only an inactive service can be reactivated');
  if (type === 'price-lists' && !active && doc.isDefault)
    throw new AppError(409, 'INVALID_STATE', 'Choose another default price list first');
  doc.isActive = active;
  if (type === 'services') doc.status = active ? 'ACTIVE' : 'INACTIVE';
  await doc.save();
  return toDto(type, doc);
}

async function applyTariff(service, approved) {
  if (approved) {
    if (service.pendingRates?.length) service.rates = service.pendingRates;
    service.status = 'ACTIVE';
  } else if (service.status === 'PENDING_APPROVAL') service.status = 'REJECTED';
  service.pendingRates = undefined;
  service.isActive = service.status === 'ACTIVE';
  await service.save();
}

onApprovalDecided('billing.tariffChange', async (req, outcome) => {
  const services = await Service.find({ _id: { $in: req.payload.serviceIds ?? [] } });
  for (const s of services) await applyTariff(s, outcome === 'APPROVED');
});

export { requestTariffApproval };
