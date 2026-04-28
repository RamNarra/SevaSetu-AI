import { VolunteerProfile, ExtractedSignal } from '@/types';

export function explainMatch(candidate: VolunteerProfile, _incident: ExtractedSignal): string {
  // Fallback deterministic reason if LLM fails!
  return `Matched based on role ${candidate.role} and availability.`;
}
