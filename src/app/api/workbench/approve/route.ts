import { FieldValue } from 'firebase-admin/firestore';
import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { withRoles } from '@/lib/auth/withAuth';
import { workbenchApproveRequestSchema } from '@/lib/ai/requestSchemas';
import { ExtractedSignal, Locality, UserRole, UrgencyLevel } from '@/types';
import { analyzeUrgencyScore } from '@/lib/scoring/urgency-v2';

function scoreToUrgencyLevel(score: number): UrgencyLevel {
  if (score >= 75) return UrgencyLevel.CRITICAL;
  if (score >= 55) return UrgencyLevel.HIGH;
  if (score >= 35) return UrgencyLevel.MEDIUM;
  return UrgencyLevel.LOW;
}

/** Recalculate and persist locality urgency in the background after approval. */
async function updateLocalityUrgency(reportId: string): Promise<void> {
  const extractedRef = adminDb.collection('extracted_reports').doc(reportId);
  const approvedExtractedSnap = await extractedRef.get();
  const approvedExtracted = approvedExtractedSnap.data() as ExtractedSignal | undefined;
  const localityId = approvedExtracted?.locality?.canonicalId ?? null;
  const localityName = approvedExtracted?.locality?.rawName?.toLowerCase() ?? null;

  if (!localityId && !localityName) return;

  let localityRef = localityId
    ? adminDb.collection('localities').doc(localityId)
    : null;
  let localityDoc = localityRef ? await localityRef.get() : null;

  if ((!localityDoc || !localityDoc.exists) && localityName) {
    const localitiesSnap = await adminDb.collection('localities').get();
    const matchedDoc = localitiesSnap.docs.find((doc) => {
      const data = doc.data() as Locality;
      return data.name?.toLowerCase() === localityName;
    });
    if (matchedDoc) {
      localityRef = matchedDoc.ref;
      localityDoc = matchedDoc;
    }
  }

  if (!localityRef || !localityDoc?.exists) return;

  const localityData = localityDoc.data() as Locality;
  const extractedSnap = await adminDb.collection('extracted_reports').get();
  const relatedSignals = extractedSnap.docs
    .map((doc) => doc.data() as ExtractedSignal & { status?: string })
    .filter((signal) => {
      const status = (signal as { status?: string }).status;
      const canonicalId = signal.locality?.canonicalId?.toLowerCase() ?? null;
      const rawName = signal.locality?.rawName?.toLowerCase() ?? null;
      return (
        (!status || status === 'APPROVED' || status === 'EXTRACTED' || status === 'HUMAN_APPROVED') &&
        ((localityId && canonicalId === localityId.toLowerCase()) || (!!localityName && rawName === localityName))
      );
    });

  const urgency = analyzeUrgencyScore(relatedSignals, {
    vulnerabilityIndex: localityData.vulnerabilityIndex,
    lastCampDate: localityData.lastCampDate?.toDate?.(),
  });

  await localityRef.update({
    urgencyScore: urgency.finalScore,
    urgencyLevel: scoreToUrgencyLevel(urgency.finalScore),
    updatedAt: FieldValue.serverTimestamp(),
    aiReasoning: localityData.aiReasoning || 'Urgency recalculated from approved field evidence.',
  });
}

export const POST = withRoles([UserRole.COORDINATOR], async (request: NextRequest, ctx) => {
  try {
    const body = await request.json();
    const parsed = workbenchApproveRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid request', issues: parsed.error.issues },
        { status: 400 }
      );
    }
    const { reportId } = parsed.data;

    const rawReportRef = adminDb.collection('raw_reports').doc(reportId);
    const extractedRef = adminDb.collection('extracted_reports').doc(reportId);

    // Both writes in parallel — no need to sequence them
    await Promise.all([
      rawReportRef.update({
        status: 'HUMAN_APPROVED',
        humanReviewerUid: ctx.uid,
        updatedAt: FieldValue.serverTimestamp(),
      }),
      extractedRef.set(
        {
          status: 'APPROVED',
          humanReviewDecision: 'approve',
          humanReviewerUid: ctx.uid,
          humanReviewedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      ),
    ]);

    // Locality urgency recalculation is expensive (collection scans + scoring).
    // Fire it off without blocking the HTTP response.
    void updateLocalityUrgency(reportId).catch((e) =>
      console.warn('[approve] background locality update failed:', e)
    );

    return NextResponse.json({ success: true, reportId });
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
});
