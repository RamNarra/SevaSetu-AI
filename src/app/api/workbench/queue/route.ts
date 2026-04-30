import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { withRoles } from '@/lib/auth/withAuth';
import { ReportStatus, UserRole } from '@/types';

function millisFromTimestampLike(value: unknown) {
  return value && typeof value === 'object' && 'toMillis' in value && typeof (value as { toMillis?: () => number }).toMillis === 'function'
    ? (value as { toMillis: () => number }).toMillis()
    : 0;
}

export const GET = withRoles([UserRole.COORDINATOR], async () => {
  try {
    const [rawSnap, extractedSnap] = await Promise.all([
      adminDb.collection('raw_reports').get(),
      adminDb.collection('extracted_reports').get(),
    ]);

    const rawReports = rawSnap.docs
      .map((doc) => ({ id: doc.id, ...doc.data() }))
      .sort((left, right) => millisFromTimestampLike((right as { createdAt?: unknown }).createdAt) - millisFromTimestampLike((left as { createdAt?: unknown }).createdAt))
      .filter((report) => {
        const status = (report as { status?: ReportStatus }).status;
        return status !== ReportStatus.HUMAN_APPROVED && status !== ReportStatus.HUMAN_REJECTED;
      });

    const extractedReports = extractedSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

    return NextResponse.json({
      success: true,
      rawReports,
      extractedReports,
    });
  } catch (error) {
    console.error('Workbench queue route failed:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
});
