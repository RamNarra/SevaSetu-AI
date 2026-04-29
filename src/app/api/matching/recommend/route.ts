import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { semanticRankVolunteers } from '@/lib/matching/semantic';
import { VolunteerProfile, ExtractedSignal } from '@/types';
import { withAuth } from '@/lib/auth/withAuth';
import { z } from 'zod';

const bodySchema = z.object({
  reportId: z.string().min(1),
  topK: z.number().int().min(1).max(20).optional().default(5),
});

export const POST = withAuth(async (request: NextRequest) => {
  try {
    const body = await request.json();
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid request', issues: parsed.error.issues },
        { status: 400 }
      );
    }
    const { reportId, topK } = parsed.data;

    const reportDoc = await adminDb.collection('extracted_reports').doc(reportId).get();
    if (!reportDoc.exists) {
      return NextResponse.json(
        { success: false, error: 'Report not found or not extracted' },
        { status: 404 }
      );
    }
    const signal = reportDoc.data() as ExtractedSignal;

    const volunteersSnap = await adminDb.collection('volunteer_profiles').get();
    const allVolunteers: VolunteerProfile[] = volunteersSnap.docs.map((d) => {
      const data = d.data() as VolunteerProfile;
      return { ...data, id: d.id, userId: data.userId ?? d.id };
    });

    const { matches, mode } = await semanticRankVolunteers({
      signal,
      volunteers: allVolunteers,
      constraints: { strictAvailability: true },
      topK,
    });

    return NextResponse.json({
      success: true,
      reportId,
      mode,
      candidates: matches.map((m) => ({
        volunteerId: m.volunteer.userId ?? m.volunteer.id,
        displayName: m.volunteer.displayName,
        role: m.volunteer.role,
        matchScore: m.matchScore,
        semanticScore: m.semanticScore,
        constraintScore: m.constraintScore,
        proximityScore: m.proximityScore,
        explanation: m.reasons.slice(0, 3).join('; '),
        coordinates: m.volunteer.coordinates ?? null,
      })),
    });
  } catch (error) {
    console.error('Matching engine error:', error);
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
});
