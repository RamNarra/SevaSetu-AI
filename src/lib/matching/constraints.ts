import { VolunteerProfile, ExtractedSignal, UserRole } from '@/types';
import { haversineKm } from '@/lib/maps/geohash';

export interface MatchConstraints {
  needsRole?: UserRole;
  /** Hard cap on travel distance in km. */
  maxDistanceKm?: number;
  /** At least one of these languages must overlap with the volunteer. */
  requiredLanguages?: string[];
  /** All of these certifications must be present. */
  requiredCertifications?: string[];
  /** Reject volunteers above this fatigue score (0-100). */
  maxFatigueScore?: number;
  /** Hours that must have elapsed since their last assignment. */
  cooldownHours?: number;
  /** Skill tags that boost score (soft). */
  preferredSkills?: string[];
  /** If false, BUSY/ON_LEAVE volunteers are still allowed (they will sort lower). */
  strictAvailability?: boolean;
}

export interface FilterReason {
  volunteerId: string;
  rejected: boolean;
  reasons: string[];
  distanceKm?: number;
}

const HOUR_MS = 60 * 60 * 1000;

function getLastAssignedMs(v: VolunteerProfile): number {
  const ts = v.lastAssigned as unknown as { toMillis?: () => number } | undefined;
  if (ts && typeof ts.toMillis === 'function') return ts.toMillis();
  return 0;
}

/** Hard-rule filter. Returns only candidates that satisfy every constraint. */
export function filterCandidates(
  volunteers: VolunteerProfile[],
  signal: ExtractedSignal,
  constraints: MatchConstraints
): VolunteerProfile[] {
  const { kept } = filterCandidatesWithReasons(volunteers, signal, constraints);
  return kept;
}

/** Same as filterCandidates but returns rejection reasons for explainability. */
export function filterCandidatesWithReasons(
  volunteers: VolunteerProfile[],
  signal: ExtractedSignal,
  constraints: MatchConstraints
): { kept: VolunteerProfile[]; rejected: FilterReason[] } {
  const kept: VolunteerProfile[] = [];
  const rejected: FilterReason[] = [];

  const campLat = signal.geo?.lat ?? null;
  const campLng = signal.geo?.lng ?? null;
  const reqLangs = (constraints.requiredLanguages ?? []).map((l) => l.toLowerCase());
  const reqCerts = constraints.requiredCertifications ?? [];

  for (const v of volunteers) {
    const reasons: string[] = [];
    let distanceKm: number | undefined;

    // 1. Role match (Coordinator can substitute, but not for Doctor)
    if (
      constraints.needsRole &&
      v.role !== constraints.needsRole &&
      !(v.role === UserRole.COORDINATOR && constraints.needsRole !== UserRole.DOCTOR)
    ) {
      reasons.push(`role mismatch (${v.role} ≠ ${constraints.needsRole})`);
    }

    // 2. Availability (default strict)
    const strict = constraints.strictAvailability !== false;
    if (strict && v.availability !== 'AVAILABLE') {
      reasons.push(`availability=${v.availability}`);
    }

    // 3. Distance
    if (
      constraints.maxDistanceKm !== undefined &&
      campLat !== null &&
      campLng !== null &&
      v.coordinates?.lat !== undefined &&
      v.coordinates?.lng !== undefined
    ) {
      distanceKm = haversineKm(campLat, campLng, v.coordinates.lat, v.coordinates.lng);
      if (distanceKm > constraints.maxDistanceKm) {
        reasons.push(`distance ${distanceKm.toFixed(1)}km > ${constraints.maxDistanceKm}km`);
      }
    }

    // 4. Languages — at least one overlap
    if (reqLangs.length > 0) {
      const have = (v.languages ?? []).map((l) => l.toLowerCase());
      const overlap = reqLangs.some((l) => have.includes(l));
      if (!overlap) reasons.push(`no required language match`);
    }

    // 5. Certifications — full superset required
    if (reqCerts.length > 0) {
      const have = new Set(v.certifications ?? []);
      const missing = reqCerts.filter((c) => !have.has(c));
      if (missing.length > 0) reasons.push(`missing certs: ${missing.join(', ')}`);
    }

    // 6. Fatigue cap
    if (
      constraints.maxFatigueScore !== undefined &&
      typeof v.fatigueScore === 'number' &&
      v.fatigueScore > constraints.maxFatigueScore
    ) {
      reasons.push(`fatigue ${v.fatigueScore} > ${constraints.maxFatigueScore}`);
    }

    // 7. Cooldown since last assignment
    if (constraints.cooldownHours && constraints.cooldownHours > 0) {
      const lastMs = getLastAssignedMs(v);
      if (lastMs > 0) {
        const hoursSince = (Date.now() - lastMs) / HOUR_MS;
        if (hoursSince < constraints.cooldownHours) {
          reasons.push(`cooldown active (${hoursSince.toFixed(1)}h < ${constraints.cooldownHours}h)`);
        }
      }
    }

    if (reasons.length === 0) {
      kept.push(v);
    } else {
      rejected.push({
        volunteerId: v.userId ?? v.id ?? '',
        rejected: true,
        reasons,
        distanceKm,
      });
    }
  }

  return { kept, rejected };
}

/** Soft scoring contribution from constraint-aligned attributes. Returns 0..1. */
export function softScore(
  volunteer: VolunteerProfile,
  signal: ExtractedSignal,
  constraints: MatchConstraints
): { score: number; reasons: string[] } {
  const reasons: string[] = [];
  let score = 0;

  // Proximity decay (closer = higher)
  if (
    constraints.maxDistanceKm &&
    signal.geo?.lat !== null &&
    signal.geo?.lng !== null &&
    volunteer.coordinates
  ) {
    const d = haversineKm(
      signal.geo!.lat!,
      signal.geo!.lng!,
      volunteer.coordinates.lat,
      volunteer.coordinates.lng
    );
    const proximity = Math.max(0, 1 - d / constraints.maxDistanceKm);
    score += proximity * 0.35;
    if (proximity > 0.5) reasons.push(`close to camp (${d.toFixed(1)}km)`);
  }

  // Language overlap depth
  const have = (volunteer.languages ?? []).map((l) => l.toLowerCase());
  const want = (constraints.requiredLanguages ?? []).map((l) => l.toLowerCase());
  if (want.length > 0) {
    const hits = want.filter((l) => have.includes(l)).length;
    score += (hits / want.length) * 0.15;
    if (hits > 0) reasons.push(`speaks ${hits} required language${hits > 1 ? 's' : ''}`);
  }

  // Experience
  const camps = volunteer.completedCamps ?? 0;
  const expBonus = Math.min(0.15, Math.log10(camps + 1) * 0.075);
  score += expBonus;
  if (camps >= 5) reasons.push(`${camps} camps completed`);

  // Rating
  const rating = volunteer.rating ?? 0;
  score += Math.min(0.15, (rating / 5) * 0.15);
  if (rating >= 4.5) reasons.push(`rating ${rating.toFixed(1)}/5`);

  // Fatigue inverse
  const fatigue = volunteer.fatigueScore ?? 50;
  score += Math.max(0, (1 - fatigue / 100)) * 0.10;
  if (fatigue <= 40) reasons.push(`low fatigue (${fatigue})`);

  // Preferred skill overlap
  if (constraints.preferredSkills && constraints.preferredSkills.length > 0) {
    const skills = new Set(volunteer.skills ?? []);
    const hits = constraints.preferredSkills.filter((s) => skills.has(s)).length;
    if (hits > 0) {
      score += Math.min(0.10, (hits / constraints.preferredSkills.length) * 0.10);
      reasons.push(`${hits} preferred skill${hits > 1 ? 's' : ''}`);
    }
  }

  return { score: Math.min(1, score), reasons };
}
