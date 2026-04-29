import { z } from 'zod';

// Lenient confidence: accept 0..1 floats OR 0..100 percentages and clamp.
const confidenceField = z.preprocess((raw) => {
  let v: unknown = raw;
  if (typeof v === 'string') v = Number(v);
  if (typeof v !== 'number' || Number.isNaN(v)) return 0.5;
  let n = v as number;
  if (n > 1) n = n / 100;
  return Math.max(0, Math.min(1, n));
}, z.number().min(0).max(1));

const severityField = z.preprocess((raw) => {
  const n = typeof raw === 'string' ? Number(raw) : raw;
  if (typeof n !== 'number' || Number.isNaN(n)) return 3;
  return Math.max(1, Math.min(5, Math.round(n)));
}, z.number().int().min(1).max(5));

const numericField = z.preprocess((raw) => {
  const n = typeof raw === 'string' ? Number(raw) : raw;
  return typeof n === 'number' && !Number.isNaN(n) ? n : 0;
}, z.number());

export const extractedSignalSchema = z.object({
  locality: z.object({
    canonicalId: z.string().nullable().optional().default(null),
    rawName: z.string().min(1),
    confidence: confidenceField,
  }),
  needs: z.array(
    z.object({
      taxonomyCode: z.string(),
      label: z.string(),
      severity: severityField,
      affectedEstimate: numericField,
      evidenceSpan: z.string(),
      confidence: confidenceField,
    })
  ).default([]),
  urgencySignals: z.array(
    z.object({
      type: z.enum([
        'death',
        'hospitalization',
        'outbreak',
        'supply_stockout',
        'access_blocked',
        'vulnerable_group',
      ]),
      evidenceSpan: z.string(),
      confidence: confidenceField,
    })
  ).default([]),
  geo: z.object({
    lat: z.number().nullable().optional().default(null),
    lng: z.number().nullable().optional().default(null),
    geohash: z.string().nullable().optional().default(null),
    source: z.enum(['map_geocode', 'report_text', 'user_pin', 'unknown']).default('report_text'),
  }).optional().default({
    lat: null, lng: null, geohash: null, source: 'report_text',
  }),
  model: z.object({
    provider: z.string().default('gemini-developer-api'),
    name: z.string().default('gemini'),
    version: z.string().default('2.5-flash'),
    promptVersion: z.string().default('extract.v2'),
  }).optional().default({
    provider: 'gemini-developer-api',
    name: 'gemini',
    version: '2.5-flash',
    promptVersion: 'extract.v2',
  }),
});

export type ExtractedSignal = z.infer<typeof extractedSignalSchema>;