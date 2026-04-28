import { ExtractedSignal, VolunteerProfile } from '@/types';

// Compute distance between two coordinates in km
function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export interface MatchedCandidate {
  volunteer: VolunteerProfile;
  matchScore: number;
  explanation: string;
}

export function rankVolunteers(
  signal: ExtractedSignal,
  volunteers: VolunteerProfile[]
): MatchedCandidate[] {
  // Required skills based on extracted taxonomy codes
  const requiredSkills = signal.needs?.map((n) => n.taxonomyCode.toLowerCase()) || [];

  // Pass 1: Deterministic Constraints
  const candidates = volunteers.filter((vol) => {
    // Must be available
    if (vol.availability !== 'AVAILABLE') return false;

    // Prevent burnout
    if (vol.fatigueScore !== undefined && vol.fatigueScore > 80) return false;

    // Must possess at least one required taxonomyCode (or basic medical/support if empty)
    if (requiredSkills.length > 0) {
      const hasSkill = vol.skills.some((s) => requiredSkills.includes(s.toLowerCase())) ||
                       vol.certifications.some((c) => requiredSkills.includes(c.toLowerCase()));
      if (!hasSkill) return false;
    }

    return true;
  });

  const now = Date.now();

  // Pass 2: Weighted Ranker
  const scoredCandidates = candidates.map((vol) => {
    let score = 0;
    const reasons: string[] = [];

    // 1. Semantic/Skill fit (40%)
    let skillScore = 0;
    if (requiredSkills.length === 0) {
      skillScore = 40; // No specific skills required, perfect base fit
      reasons.push('General availability verified.');
    } else {
      let matchedCount = 0;
      requiredSkills.forEach((req) => {
        if (
          vol.skills.some((s) => s.toLowerCase() === req) ||
          vol.certifications.some((c) => c.toLowerCase() === req)
        ) {
          matchedCount++;
        }
      });
      const skillRatio = matchedCount / requiredSkills.length;
      skillScore = skillRatio * 40;
      if (skillRatio === 1) {
        reasons.push(`Exact credential match for required skills.`);
      } else {
        reasons.push(`${Math.round(skillRatio * 100)}% partial credential match.`);
      }
    }
    score += skillScore;

    // 2. Geospatial Travel Friction (30%)
    let geoScore = 0;
    const signalLat = signal.geo?.lat;
    const signalLng = signal.geo?.lng;
    const volLat = vol.coordinates?.lat;
    const volLng = vol.coordinates?.lng;

    if (signalLat && signalLng && volLat && volLng) {
      const distance = haversine(signalLat, signalLng, volLat, volLng);
      // Perfect (30) if 0km, decays linearily to 0 at travelRadiusKm (or 50km default)
      const maxRadius = vol.travelRadiusKm || 50;
      
      if (distance <= maxRadius) {
        geoScore = 30 * Math.max(0, 1 - distance / maxRadius);
        reasons.push(`${distance.toFixed(1)}km away within travel radius.`);
      } else {
        // Exceeds preferred radius, apply a friction penalty
        geoScore = 5;
        reasons.push(`${distance.toFixed(1)}km away (outside primary radius).`);
      }
    } else {
      // Mock distance or unknown
      geoScore = 15; // Mean fallback
      reasons.push('Location proximity estimated.');
    }
    score += geoScore;

    // 3. Reliability Rating (20%)
    // Base rating is 0 to 5. So (rating / 5) * 20
    const ratingScore = (vol.rating / 5) * 20;
    score += ratingScore;
    if (vol.rating >= 4.5) {
      reasons.push(`Excellent reliability record (${vol.rating}/5 stars).`);
    } else if (vol.rating >= 3.0) {
      reasons.push(`Solid historical completion rate.`);
    }

    // 4. Fairness / Load Balance (10%)
    let loadScore = 10;
    if (vol.lastAssigned) {
      const lastAssignedMs = typeof vol.lastAssigned.toMillis === 'function' ? vol.lastAssigned.toMillis() : new Date(vol.lastAssigned as any).getTime();
      const daysSince = (now - lastAssignedMs) / (1000 * 60 * 60 * 24);
      
      // If assigned within the last 2 days, score 0. If 14 days, score 10.
      loadScore = 10 * Math.max(0, Math.min(1, daysSince / 14));
    }
    if (loadScore === 10) {
      reasons.push('Prioritized for load balancing.');
    }
    score += loadScore;

    return {
      volunteer: vol,
      matchScore: Math.round(score),
      explanation: `${Math.round(score)}% Match: ${reasons.join(' ')}`
    };
  });

  // Sort descending
  scoredCandidates.sort((a, b) => b.matchScore - a.matchScore);

  return scoredCandidates;
}