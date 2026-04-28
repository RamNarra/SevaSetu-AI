import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { rankVolunteers } from '@/lib/matching/ranker';
import { VolunteerProfile, ExtractedSignal } from '@/types';

export async function POST(request: NextRequest) {
  try {
    const { reportId } = await request.json();

    if (!reportId) {
      return NextResponse.json({ success: false, error: 'Missing reportId' }, { status: 400 });
    }

    // 1. Fetch Extracted Signal
    const reportDoc = await adminDb.collection('extracted_reports').doc(reportId).get();
    if (!reportDoc.exists) {
      return NextResponse.json({ success: false, error: 'Report not found or not extracted' }, { status: 404 });
    }

    const signal = reportDoc.data() as ExtractedSignal;

    // 2. Fetch all Volunteer Profiles
    // For MVP, we fetch all. In prod, we'd use a geo-fence query via geohash (Phase 2.4)
    const volunteersSnap = await adminDb.collection('volunteer_profiles').get();
    const allVolunteers: VolunteerProfile[] = [];
    
    volunteersSnap.forEach((doc) => {
      const data = doc.data() as VolunteerProfile;
      data.userId = doc.id;
      allVolunteers.push(data);
    });

    // 3. Run the Deterministic Two-Pass Matching Engine
    const matches = await rankVolunteers(signal, allVolunteers);

    // 4. Return the Top candidates
    const top3 = matches.map(m => ({
      volunteerId: m.volunteer.userId,
      displayName: m.volunteer.displayName,
      role: m.volunteer.role,
      matchScore: m.matchScore,
      explanation: m.explanation,
      coordinates: m.volunteer.coordinates
    }));

    return NextResponse.json({
      success: true,
      reportId,
      candidates: top3,
    });
  } catch (error) {
    console.error('Matching engine error:', error);
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}
