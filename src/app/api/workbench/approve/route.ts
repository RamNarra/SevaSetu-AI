import { FieldValue } from 'firebase-admin/firestore';
import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const reportId = typeof body.reportId === 'string' ? body.reportId.trim() : '';

    if (!reportId) {
      return NextResponse.json({ success: false, error: 'Missing reportId' }, { status: 400 });
    }

    const rawReportRef = adminDb.collection('raw_reports').doc(reportId);
    await rawReportRef.update({
      status: 'HUMAN_APPROVED',
      updatedAt: FieldValue.serverTimestamp(),
    });

    const extractedRef = adminDb.collection('extracted_reports').doc(reportId);
    await extractedRef.set({
      status: 'APPROVED',
      humanReviewDecision: 'approve',
      humanReviewedAt: FieldValue.serverTimestamp(),
    }, { merge: true });

    return NextResponse.json({ success: true, reportId });
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
