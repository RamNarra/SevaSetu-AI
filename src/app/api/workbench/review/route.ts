import { FieldValue } from 'firebase-admin/firestore';
import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { ReportStatus, UserRole } from '@/types';
import { withRoles } from '@/lib/auth/withAuth';
import { workbenchReviewRequestSchema } from '@/lib/ai/requestSchemas';

type ReviewDecision = 'approve' | 'reject';

function toStatus(decision: ReviewDecision): ReportStatus {
  return decision === 'approve'
    ? ReportStatus.HUMAN_APPROVED
    : ReportStatus.HUMAN_REJECTED;
}

export const POST = withRoles(
  [UserRole.COORDINATOR],
  async (request: NextRequest, ctx) => {
  try {
    const body = await request.json();
    const parsed = workbenchReviewRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid request', issues: parsed.error.issues },
        { status: 400 }
      );
    }
    const { reportId, decision, notes } = parsed.data;

    const rawReportRef = adminDb.collection('raw_reports').doc(reportId);
    const rawReportSnap = await rawReportRef.get();

    if (!rawReportSnap.exists) {
      return NextResponse.json(
        { success: false, error: 'Raw report not found' },
        { status: 404 }
      );
    }

    const nextStatus = toStatus(decision);

    await rawReportRef.set(
      {
        status: nextStatus,
        humanReviewerUid: ctx.uid,
        updatedAt: FieldValue.serverTimestamp(),
        lastSyncedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    await adminDb.collection('extracted_reports').doc(reportId).set(
      {
        humanReviewDecision: decision,
        humanReviewerUid: ctx.uid,
        humanReviewedAt: FieldValue.serverTimestamp(),
        humanReviewNotes: notes ?? null,
      },
      { merge: true }
    );

    return NextResponse.json({
      success: true,
      reportId,
      status: nextStatus,
    });
  } catch (error) {
    console.error('Workbench review error:', error);
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
});
