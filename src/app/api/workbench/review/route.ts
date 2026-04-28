import { FieldValue } from 'firebase-admin/firestore';
import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { ReportStatus } from '@/types';

type ReviewDecision = 'approve' | 'reject';

function toStatus(decision: ReviewDecision): ReportStatus {
  return decision === 'approve'
    ? ReportStatus.HUMAN_APPROVED
    : ReportStatus.HUMAN_REJECTED;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const reportId = typeof body.reportId === 'string' ? body.reportId.trim() : '';
    const decision = body.decision as ReviewDecision;

    if (!reportId) {
      return NextResponse.json(
        { success: false, error: 'Missing reportId' },
        { status: 400 }
      );
    }

    if (decision !== 'approve' && decision !== 'reject') {
      return NextResponse.json(
        { success: false, error: 'Invalid review decision' },
        { status: 400 }
      );
    }

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
        updatedAt: FieldValue.serverTimestamp(),
        lastSyncedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    await adminDb.collection('extracted_reports').doc(reportId).set(
      {
        humanReviewDecision: decision,
        humanReviewedAt: FieldValue.serverTimestamp(),
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
}
