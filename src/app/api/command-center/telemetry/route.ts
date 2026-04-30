import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { withAuth } from '@/lib/auth/withAuth';

function millisFromTimestampLike(value: unknown) {
  return value && typeof value === 'object' && 'toMillis' in value && typeof (value as { toMillis?: () => number }).toMillis === 'function'
    ? (value as { toMillis: () => number }).toMillis()
    : 0;
}

export const GET = withAuth(async () => {
  try {
    const [localitiesSnap, reportsSnap, volunteersSnap, campsSnap, presenceSnap] = await Promise.all([
      adminDb.collection('localities').get(),
      adminDb.collection('extracted_reports').get(),
      adminDb.collection('volunteer_profiles').get(),
      adminDb.collection('camp_plans').get(),
      adminDb.collection('volunteer_presence').get(),
    ]);

    const localities = localitiesSnap.docs
      .map((doc) => ({ id: doc.id, ...doc.data() }))
      .sort((left, right) => Number((right as { urgencyScore?: number }).urgencyScore ?? 0) - Number((left as { urgencyScore?: number }).urgencyScore ?? 0));

    const reports = reportsSnap.docs
      .map((doc) => ({ id: doc.id, ...doc.data() }))
      .filter((report) => {
        const status = (report as { status?: string }).status;
        return !status || status === 'APPROVED' || status === 'EXTRACTED' || status === 'HUMAN_APPROVED';
      });

    const volunteers = volunteersSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    const camps = campsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    const presence = presenceSnap.docs
      .map((doc) => ({ id: doc.id, ...doc.data() }))
      .sort((left, right) => millisFromTimestampLike((right as { lastSeenAt?: unknown }).lastSeenAt) - millisFromTimestampLike((left as { lastSeenAt?: unknown }).lastSeenAt));

    return NextResponse.json({
      success: true,
      localities,
      reports,
      volunteers,
      camps,
      presence,
    });
  } catch (error) {
    console.error('Command center telemetry route failed:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
});
