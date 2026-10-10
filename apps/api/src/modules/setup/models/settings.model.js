import { Schema } from 'mongoose';
import { defineModel } from '../../../core/db/model.js';

/** One document per hospital with the settings the hospital edits itself (spec 5.1). */
const schema = new Schema({
  key: { type: String, default: 'hospital', enum: ['hospital'] },
  displayName: { type: String, required: true },
  financialYearStartMonth: { type: Number, default: 4, min: 1, max: 12 },
  timezone: { type: String, default: 'Asia/Kolkata' },
  dateFormat: { type: String, default: 'DD/MM/YYYY' },
  languages: { type: [String], default: ['en', 'hi'] },
  communication: { smsSenderId: String, emailFrom: String, whatsappNumber: String },
});
schema.index({ tenantId: 1, key: 1 }, { unique: true });
export const HospitalSettings = defineModel('HospitalSettings', schema);

/** Prefix, reset and width of each document number series (spec 5.1 "Numbering series"). */
const seriesSchema = new Schema({
  series: { type: String, required: true },
  prefix: { type: String, required: true },
  reset: { type: String, enum: ['YEARLY', 'MONTHLY', 'NEVER'], required: true },
  width: { type: Number, min: 3, max: 9, required: true },
  perBranch: { type: Boolean, default: true },
});
seriesSchema.index({ tenantId: 1, series: 1 }, { unique: true });
export const NumberSeries = defineModel('NumberSeries', seriesSchema);
