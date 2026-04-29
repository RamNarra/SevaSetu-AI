/**
 * SevaSetu AI — Centralized request validation schemas (Zod).
 * Every API route uses these to validate incoming bodies, so the boundary
 * is documented and enforced in one place.
 */

import { z } from 'zod';
import { UserRole } from '@/types';

export const extractRequestSchema = z.object({
  reportId: z.string().min(1),
  text: z.string().optional().default(''),
  /** Public download URLs returned by Storage upload. Used for multimodal extraction. */
  attachments: z
    .array(
      z.object({
        url: z.string().url().optional(),
        storageUri: z.string().optional(),
        mimeType: z.string().min(1),
        name: z.string().optional(),
      })
    )
    .optional()
    .default([]),
}).refine(
  (data) => (data.text && data.text.length > 0) || (data.attachments && data.attachments.length > 0),
  { message: 'Either text or attachments must be provided' }
);

export type ExtractRequest = z.infer<typeof extractRequestSchema>;

export const matchConstraintsSchema = z.object({
  roles: z.array(z.string()).optional().default([]),
  language: z.string().optional(),
  requiredLanguages: z.array(z.string()).optional(),
  requiredCertifications: z.array(z.string()).optional(),
  preferredSkills: z.array(z.string()).optional(),
  maxDistance: z.number().min(0).max(500).optional(),
  maxFatigue: z.number().min(0).max(100).optional(),
  cooldownHours: z.number().min(0).max(168).optional(),
  genderSensitive: z.boolean().optional(),
  availableOnly: z.boolean().optional(),
});

export const allocationRecommendRequestSchema = z.object({
  campId: z.string().min(1),
  reportId: z.string().optional(),
  constraints: matchConstraintsSchema.optional().default(() => ({ roles: [] })),
  topK: z.number().int().min(1).max(25).optional().default(10),
});

export type AllocationRecommendRequest = z.infer<typeof allocationRecommendRequestSchema>;

export const allocationAssignRequestSchema = z.object({
  campId: z.string().min(1),
  volunteerId: z.string().min(1),
  role: z.nativeEnum(UserRole).optional(),
  matchScore: z.number().min(0).max(100).optional(),
  matchReasoning: z.string().optional(),
});

export const dispenseRequestSchema = z.object({
  assignmentId: z.string().min(1),
  medicineId: z.string().min(1),
  amountDispensed: z.number().int().positive(),
  dispensedBy: z.string().optional(),
});

export const scoringRecomputeRequestSchema = z.object({
  localityId: z.string().min(1),
});

export const workbenchReviewRequestSchema = z.object({
  reportId: z.string().min(1),
  decision: z.enum(['approve', 'reject']),
  notes: z.string().optional(),
});

export const workbenchApproveRequestSchema = z.object({
  reportId: z.string().min(1),
});

export const aiScoreRequestSchema = z.object({
  localityName: z.string().min(1),
  baseScore: z.number().min(0).max(100),
  breakdown: z.record(z.string(), z.number()).optional(),
  reports: z.string().optional(),
});

export const aiSummarizeRequestSchema = z.object({
  campTitle: z.string().min(1),
  patientVisits: z.unknown().optional(),
  dispenseLogs: z.unknown().optional(),
  followups: z.unknown().optional(),
});

export const aiRecommendRequestSchema = z.object({
  campTitle: z.string().min(1),
  localityName: z.string().optional(),
  requiredRoles: z.unknown().optional(),
  volunteers: z.array(z.unknown()).min(1),
});

export const matchingDispatchRequestSchema = z.object({
  volunteerId: z.string().min(1),
  campId: z.string().min(1),
  role: z.string().min(1),
});
