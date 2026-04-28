import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { CampPlan, VolunteerProfile } from '@/types';
import { genai, MODEL, parseJsonResponse } from '@/lib/ai/client';

function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { campId, constraints } = body;
    if (!campId) return NextResponse.json({ success: false, error: 'Missing campId' }, { status: 400 });

    const campDoc = await adminDb.collection('camp_plans').doc(campId).get();
    if (!campDoc.exists) return NextResponse.json({ success: false, error: 'Camp not found' }, { status: 404 });
    const camp = campDoc.data() as CampPlan;
    
    let campLat = 0;
    let campLng = 0;
    const locDoc = await adminDb.collection('localities').doc(camp.localityId).get();
    if (locDoc.exists) {
      const coords = locDoc.data()?.coordinates;
      if (coords) {
        campLat = coords.lat;
        campLng = coords.lng;
      }
    }

    const volSnap = await adminDb.collection('volunteer_profiles').get();
    const vols = volSnap.docs.map(d => ({ id: d.id, ...d.data() } as VolunteerProfile));

    // Phase 1: Deterministic filter & rank
    const reqRoles = constraints?.roles || ['ALL'];
    const candidates = vols.filter(v => {
      // Hard constraints
      if (constraints?.availableOnly && v.availability !== 'AVAILABLE') return false;
      if (reqRoles.length > 0 && !reqRoles.includes('ALL') && !reqRoles.includes(v.role)) return false;
      if (constraints?.maxFatigue !== undefined && v.fatigueScore !== undefined && v.fatigueScore > constraints.maxFatigue) return false;
      if (constraints?.genderSensitive && v.skills && !v.skills.includes('gender_sensitive_care')) return false;

      // Distance constraint
      let dist = 0;
      if (campLat && campLng && v.coordinates?.lat && v.coordinates?.lng) {
        dist = haversine(campLat, campLng, v.coordinates.lat, v.coordinates.lng);
      }
      if (constraints?.maxDistance !== undefined && dist > constraints.maxDistance) return false;

      return true;
    }).map(v => {
      let score = 50; 
      const reasons = [];
      
      if (v.rating >= 4.0) { score += 20; reasons.push('High rating.'); }
      if (v.completedCamps > 5) { score += 10; reasons.push('Experienced.'); }
      if (constraints?.language && v.languages && v.languages.includes(constraints.language)) { score += 20; reasons.push('Language match.'); }
      
      return { 
        volunteer: v, 
        deterministicScore: Math.min(100, score), 
        baseReasons: reasons 
      };
    }).sort((a, b) => b.deterministicScore - a.deterministicScore).slice(0, 10);

    // Phase 2: LLM Explanation
    const prompt = `You are an AI coordinator assigning staff to "${camp.title}".
We have filtered volunteers deterministically. Generate a human-readable 1-sentence reasoning for each, and you can adjust the match score slightly (-5 to +5) based on nuance (e.g. skills mapping exactly to camp's needs).
    
Candidates: ${JSON.stringify(candidates.map(c => ({ id: c.volunteer.userId, role: c.volunteer.role, skills: c.volunteer.skills, initialScore: c.deterministicScore, reasons: c.baseReasons })))}
    
Return a JSON array exactly matching this structure:
[
  { "id": "volunteerUserId", "adjustedScore": 85, "explanation": "Reasoning sentence." }
]
IMPORTANT: Only include IDs from the Candidates list.`;

    const aiRes = await genai.models.generateContent({
      model: MODEL,
      contents: prompt,
      config: { temperature: 0.2, responseMimeType: 'application/json' },
    });

    const llmMatches = parseJsonResponse(aiRes.text || '[]') as Array<{ id: string, adjustedScore: number, explanation: string }>;
    
    // Check conflicts
    const finalMatches = candidates.map(c => {
      const llmOutput = llmMatches.find(x => x.id === c.volunteer.userId);
      const isConflict = llmOutput && Math.abs(llmOutput.adjustedScore - c.deterministicScore) > 15;
      
      return {
        volunteerId: c.volunteer.userId,
        volunteer: c.volunteer,
        matchScore: llmOutput ? llmOutput.adjustedScore : c.deterministicScore,
        explanation: llmOutput ? llmOutput.explanation : c.baseReasons.join(' '),
        conflictAlert: isConflict ? true : false,
      };
    }).sort((a, b) => b.matchScore - a.matchScore);

    return NextResponse.json({ success: true, matches: finalMatches });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
