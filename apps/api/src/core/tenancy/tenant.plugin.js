import mongoose, { Schema } from 'mongoose';
import { current } from './context.js';

const QUERY_OPS = [
  'find',
  'findOne',
  'countDocuments',
  'findOneAndUpdate',
  'findOneAndDelete',
  'findOneAndReplace',
  'updateOne',
  'updateMany',
  'replaceOne',
  'deleteOne',
  'deleteMany',
  'distinct',
  'estimatedDocumentCount',
];

/**
 * Adds `tenantId` to every document and forces it into every query, update, delete and
 * aggregate. A query naming another tenant throws; a call without a request context throws.
 */
export function tenantPlugin(schema) {
  schema.add({ tenantId: { type: Schema.Types.ObjectId, required: true, immutable: true } });

  for (const op of QUERY_OPS) {
    schema.pre(op, function () {
      if (op === 'estimatedDocumentCount')
        throw new Error('estimatedDocumentCount ignores tenants; use countDocuments');
      const { tenantId } = current();
      const filter = this.getFilter();
      if (filter.tenantId !== undefined && String(filter.tenantId) !== tenantId) {
        throw new Error('Cross-tenant query blocked');
      }
      this.where({ tenantId });
    });
  }

  schema.pre('aggregate', function () {
    const tenantId = new mongoose.Types.ObjectId(current().tenantId);
    const first = this.pipeline()[0];
    if (first?.$geoNear || first?.$search)
      throw new Error('Put tenantId inside $geoNear/$search query');
    this.pipeline().unshift({ $match: { tenantId } });
  });

  schema.pre('validate', function () {
    const { tenantId } = current();
    if (!this.tenantId) this.tenantId = tenantId;
    else if (String(this.tenantId) !== tenantId) throw new Error('Cross-tenant write blocked');
  });

  schema.pre('insertMany', function (next, docs) {
    const { tenantId } = current();
    for (const d of Array.isArray(docs) ? docs : [docs]) {
      if (d.tenantId && String(d.tenantId) !== tenantId)
        return next(new Error('Cross-tenant write blocked'));
      d.tenantId = tenantId;
    }
    next();
  });

  schema.pre('bulkWrite', function () {
    throw new Error('bulkWrite bypasses tenant checks; use insertMany/updateMany');
  });
}
