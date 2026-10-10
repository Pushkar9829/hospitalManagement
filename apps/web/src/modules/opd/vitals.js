import { useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { cleanResolver } from '../../lib/forms.js';

export const PRIORITIES = ['GREEN', 'AMBER', 'RED'];

/** Vitals schema with translated messages; numbers arrive as text from the inputs. */
export function vitalsSchema(t, { withComplaint = true } = {}) {
  const num = (min, max, key) =>
    z.coerce
      .number({ error: t(`opd.vitals.errors.${key}`) })
      .min(min, t(`opd.vitals.errors.${key}`))
      .max(max, t(`opd.vitals.errors.${key}`))
      .optional();
  return z
    .object({
      bp: z
        .string()
        .regex(/^\d{2,3}\s*\/\s*\d{2,3}$/, t('opd.vitals.errors.bp'))
        .optional(),
      pulse: num(30, 220, 'pulse'),
      tempF: num(90, 110, 'temp'),
      spo2: num(50, 100, 'spo2'),
      weightKg: num(0.5, 300, 'weight'),
      heightCm: num(30, 250, 'height'),
      sugar: num(20, 600, 'sugar'),
      painScore: num(0, 10, 'pain'),
      complaint: withComplaint
        ? z.string().trim().min(3, t('opd.vitals.errors.complaint'))
        : z.string().optional(),
      priority: z.enum(PRIORITIES),
      priorityReason: z.string().optional(),
    })
    .superRefine((v, ctx) => {
      if (v.priority === 'RED' && !String(v.priorityReason ?? '').trim())
        ctx.addIssue({
          code: 'custom',
          path: ['priorityReason'],
          message: t('opd.vitals.errors.reason'),
        });
    });
}

/** The vitals fields as text for the form from a saved reading. */
export function vitalsDefaults(v, complaint = '') {
  const s = (x) => (x == null ? '' : String(x));
  return {
    bp: s(v?.bp),
    pulse: s(v?.pulse),
    tempF: s(v?.tempF),
    spo2: s(v?.spo2),
    weightKg: s(v?.weightKg),
    heightCm: s(v?.heightCm),
    sugar: s(v?.sugar),
    painScore: s(v?.painScore),
    complaint: v?.complaint || complaint || '',
    priority: v?.priority ?? 'GREEN',
    priorityReason: v?.priorityReason ?? '',
  };
}

/** The vitals form (React Hook Form + Zod, validated on blur and on submit). */
export function useVitalsForm({ defaults, withComplaint = true }) {
  const { t } = useTranslation();
  const schema = useMemo(() => vitalsSchema(t, { withComplaint }), [t, withComplaint]);
  return useForm({ resolver: cleanResolver(schema), mode: 'onBlur', defaultValues: defaults });
}

