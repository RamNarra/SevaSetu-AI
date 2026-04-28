import { VolunteerProfile, ExtractedSignal, UserRole } from '@/types';

export interface MatchConstraints {
  needsRole?: UserRole;
  maxDistanceKm?: number;
}

export function filterCandidates(
  volunteers: VolunteerProfile[], 
  signal: ExtractedSignal, 
  constraints: MatchConstraints
): VolunteerProfile[] {
  return volunteers.filter(v => {
    // 1. Role match
    if (constraints.needsRole && v.role !== constraints.needsRole) {
      if (v.role !== UserRole.COORDINATOR) { // coordinators can do anything in mvp
        return false;
      }
    }
    
    // 2. Active assignments check (not currently implemented fully)
    if (v.availability === 'ON_LEAVE' || v.availability === 'BUSY') return false;
    
    return true;
  });
}
