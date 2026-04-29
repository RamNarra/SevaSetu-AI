import { FieldValue } from 'firebase-admin/firestore';
import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { withRoles } from '@/lib/auth/withAuth';
import { workbenchApproveRequestSchema } from '@/lib/ai/requestSchemas';
import { UserRole } from '@/types';

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
    await rawReportRef.update({
      status: 'HUMAN_APPROVED',
      humanReviewerUid: ctx.uid,
      updatedAt: FieldValue.serverTimestamp(),
    });

    const extractedRef = adminDb.collection('extracted_reports').doc(reportId);
    await extractedRef.set(
      {
        status: 'APPROVED',
        humanReviewDecision: 'approve',
        humanReviewerUid: ctx.uid,
        humanReviewedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    return NextResponse.json({ success: true, reportId });
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
});
