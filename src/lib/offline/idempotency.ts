import { adminDb } from '@/lib/firebase/admin';

/**
 * Phase 2.3 outbox pattern: 
 * Retries are idempotent, server stores processed event IDs.
 */
export async function isEventProcessed(clientEventId: string): Promise<boolean> {
  const doc = await adminDb.collection('outbox_events').doc(clientEventId).get();
  return doc.exists;
}

export async function markEventProcessed(clientEventId: string, payload: Record<string, unknown>): Promise<void> {
  await adminDb.collection('outbox_events').doc(clientEventId).set({
    processedAt: new Date(),
    payload
  });
}
