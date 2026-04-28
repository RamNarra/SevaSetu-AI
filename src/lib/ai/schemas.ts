import { z } from 'zod';

export const extractedSignalSchema = z.object({
  locality: z.object({
    canonicalId: z.string().nullable(),
    rawName: z.string(),
    confidence: z.number().min(0).max(1),
  }),
  needs: z.array(
    z.object({
      taxonomyCode: z.string(),
      label: z.string(),
      severity: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]),
      affectedEstimate: z.number(),
      evidenceSpan: z.string(),
      confidence: z.number().min(0).max(1),
    })
  ),
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
      confidence: z.number().min(0).max(1),
    })
  ),
  geo: z.object({
    lat: z.number().nullable(),
    lng: z.number().nullable(),
    geohash: z.string().nullable(),
    source: z.enum(['map_geocode', 'report_text', 'user_pin', 'unknown']),
  }),
  model: z.object({
    provider: z.enum(['vertex-ai']),
    name: z.string(),
    version: z.string(),
    promptVersion: z.string(),
  }),
});

export type ExtractedSignal = z.infer<typeof extractedSignalSchema>;