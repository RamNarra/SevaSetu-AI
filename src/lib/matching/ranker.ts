import { VolunteerProfile, ExtractedSignal, UserRole } from '@/types';
import { filterCandidates } from './constraints';
import { explainMatch } from './explain';
import { genai, MODELS, parseJsonResponse } from '@/lib/ai/client';

export interface RankedMatch {
  volunteer: VolunteerProfile;
  matchScore: number;
  explanation: string;
}

export async function rankVolunteers(
  signal: ExtractedSignal,
  volunteers: VolunteerProfile[]
): Promise<RankedMatch[]> {
  // Phase 1.4: Deterministic constraint solver first
  const constraints = {
    needsRole: signal.needs?.length > 0 ? UserRole.DOCTOR : UserRole.FIELD_VOLUNTEER
  };
  
  const eligible = filterCandidates(volunteers, signal, constraints);

  // Apply deterministic ranking formula
  const ranked = eligible.map(v => {
    let baseScore = 0.5; // default 
    if (v.role === constraints.needsRole) baseScore += 0.3;
    if (v.metrics?.rating) baseScore += (v.metrics.rating / 5) * 0.1;
    
    return {
      volunteer: v,
      matchScore: Math.min(1.0, baseScore),
      explanation: explainMatch(v, signal)
    };
  }).sort((a, b) => b.matchScore - a.matchScore);

  const topCands = ranked.slice(0, 3);

  // LLM Explanation phase for top candidates
  try {
    const prompt = `You are a scheduling AI. Explain why these volunteers were matched for report ${signal.reportId}. 
      Candidates: ${JSON.stringify(topCands.map(c => ({id: c.volunteer.uid, score: c.matchScore, role: c.volunteer.role})))}
      Return a JSON map: { [volunteerUid]: "1 sentence reason" }`;
      
    const res = await genai.models.generateContent({
      model: MODELS.routing,
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: { responseMimeType: 'application/json' }
    });
    
    const parsed = parseJsonResponse(res.text || '') as Record<string, string>;
    
    topCands.forEach(c => {
      const uid = c.volunteer.uid;
      // Reject hallucinated IDs implicitly by mapping to known keys
      if (uid && parsed[uid]) {
        c.explanation = parsed[uid];
      }
    });
  } catch (e) {
    console.error("LLM reasoning fallback to deterministic explanation", e);
  }

  return topCands;
}
