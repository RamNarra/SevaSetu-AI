/**
 * SevaSetu AI — AI audit trail.
 *
 * Every Gemini-touched document records:
 *  - prompt + model versions
 *  - latency
 *  - token usage
 *  - validation status
 *
 * Surfaces in the Workbench / Admin trace view so judges can verify every AI
 * decision is observable and reversible.
 */

import { adminDb } from '@/lib/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';

export type AiAuditOp =
  | 'extract'
  | 'embed'
  | 'recommend'
  | 'score'
  | 'summarize'
  | 'matching';

export interface AiAuditRecord {
  op: AiAuditOp;
  model: string;
  promptVersion: string;
  inputTokens?: number;
  outputTokens?: number;
  latencyMs: number;
  validationPassed: boolean;
  zodErrors?: string[];
  documentId?: string;
  collection?: string;
  actorUid?: string;
  costUsdEstimate?: number;
  notes?: string;
}

const PRICE_PER_1K_INPUT = 0.0003;  // rough Gemini Flash pricing for the demo cost line
const PRICE_PER_1K_OUTPUT = 0.0009;

export function estimateCostUsd(inputTokens?: number, outputTokens?: number): number {
  const inp = inputTokens ?? 0;
  const out = outputTokens ?? 0;
  return (inp / 1000) * PRICE_PER_1K_INPUT + (out / 1000) * PRICE_PER_1K_OUTPUT;
}

/** Fire-and-forget audit write. Never throws — never blocks the caller. */
export async function recordAiAudit(record: AiAuditRecord): Promise<void> {
  try {
    await adminDb.collection('ai_audit').add({
      ...record,
      costUsdEstimate:
        record.costUsdEstimate ?? estimateCostUsd(record.inputTokens, record.outputTokens),
      createdAt: FieldValue.serverTimestamp(),
    });
  } catch (err) {
    console.warn('[ai_audit] write failed:', err instanceof Error ? err.message : err);
  }
}

/** Time a Gemini call and record an audit row in one helper. */
export async function timedAi<T>(
  meta: Omit<AiAuditRecord, 'latencyMs' | 'validationPassed'>,
  fn: () => Promise<{ result: T; validationPassed: boolean; zodErrors?: string[]; inputTokens?: number; outputTokens?: number }>
): Promise<T> {
  const t0 = Date.now();
  try {
    const { result, validationPassed, zodErrors, inputTokens, outputTokens } = await fn();
    void recordAiAudit({
      ...meta,
      latencyMs: Date.now() - t0,
      validationPassed,
      zodErrors,
      inputTokens: inputTokens ?? meta.inputTokens,
      outputTokens: outputTokens ?? meta.outputTokens,
    });
    return result;
  } catch (err) {
    void recordAiAudit({
      ...meta,
      latencyMs: Date.now() - t0,
      validationPassed: false,
      notes: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}
