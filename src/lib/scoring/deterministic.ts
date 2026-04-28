import { UrgencyBreakdown, UrgencyLevel, ExtractedSignal, Locality } from '@/types';
import { Timestamp } from 'firebase/firestore/lite';

/**
 * Deterministic urgency scoring engine.
 * Computes a transparent base score from structured data.
 * AI layer (Gemini) refines and explains after.
 *
 * Base Score = severity(0-25) + recency(0-20) + repeatComplaints(0-20) + serviceGap(0-15) + vulnerability(0-20)
 * Total possible: 100
 */

/**
 * Compute severity score based on issue types found in extracted reports.
 */
/**
 * Compute severity score based on extracted issue types and their inherent weights.
 * Instead of simple keyword matching, we assign weights to categories.
 */
function computeSeverity(reports: ExtractedSignal[]): number {
  if (reports.length === 0) return 0;

  const weights: Record<string, number> = {
    // Critical (25)
    'outbreak': 25, 'epidemic': 25, 'death': 25, 'cholera': 25, 'malnutrition': 25,
    // High (18)
    'maternal': 18, 'infant': 18, 'waterborne': 18, 'dengue': 18, 'tb': 18, 'tuberculosis': 18,
    // Medium (12)
    'diabetes': 12, 'hypertension': 12, 'anemia': 12, 'fever': 12,
    // Low (5)
    'cold': 5, 'dental': 5, 'eye': 5, 'skin': 5
  };

  let totalSeverity = 0;
  const uniqueIssues = new Set<string>();

  for (const report of reports) {
    report.needs.forEach(need => {
      const issue = need.label;
      const normalized = issue.toLowerCase().trim();
      uniqueIssues.add(normalized);
      
      // Check for substring matches in weights
      let matchWeight = 5; // Default low
      for (const [key, weight] of Object.entries(weights)) {
        if (normalized.includes(key)) {
          matchWeight = Math.max(matchWeight, weight);
        }
      }
      totalSeverity = Math.max(totalSeverity, matchWeight);
    });
  }

  // Bonus for diversity of issues (max +5)
  const diversityBonus = Math.min(5, uniqueIssues.size);
  
  return Math.min(25, totalSeverity + (reports.length > 1 ? diversityBonus : 0));
}

/**
 * Compute recency score — decays over time.
 */
function computeRecency(reports: ExtractedSignal[]): number {
  if (reports.length === 0) return 0;

  const now = Date.now();
  const mostRecent = reports.reduce((latest, r) => {
    const timestampObj = r.processedAt || r.createdAt;
    const t = timestampObj instanceof Timestamp ? timestampObj.toMillis() : now;
    return Math.max(latest, t);
  }, 0);

  const daysSinceReport = (now - mostRecent) / (1000 * 60 * 60 * 24);

  if (daysSinceReport <= 3) return 20;
  if (daysSinceReport <= 7) return 17;
  if (daysSinceReport <= 14) return 12;
  if (daysSinceReport <= 30) return 8;
  return 4;
}

/**
 * Compute Impact Score — accounts for the scale of the problem.
 */
function computeImpactScale(reports: ExtractedSignal[]): number {
  const totalAffected = reports.reduce((sum, r) => sum + ((r.needs?.reduce((s, n) => s + (n.affectedEstimate || 0), 0) || 0)), 0);
  const avgAffected = reports.length > 0 ? totalAffected / reports.length : 0;

  if (avgAffected > 500) return 20;
  if (avgAffected > 100) return 15;
  if (avgAffected > 50) return 10;
  if (avgAffected > 10) return 5;
  return 2;
}

/**
 * Compute service gap — days since last camp.
 */
function computeServiceGap(locality: Partial<Locality>): number {
  if (!locality.lastCampDate) return 15; 

  const lastCamp = locality.lastCampDate instanceof Timestamp
    ? locality.lastCampDate.toMillis()
    : Date.now();
  const daysSinceCamp = (Date.now() - lastCamp) / (1000 * 60 * 60 * 24);

  if (daysSinceCamp > 180) return 15;
  if (daysSinceCamp > 90) return 10;
  if (daysSinceCamp > 30) return 5;
  return 0;
}

/**
 * Compute vulnerability index score.
 */
function computeVulnerability(locality: Partial<Locality>): number {
  const vi = locality.vulnerabilityIndex ?? 0.5;
  return Math.round(vi * 20);
}

/**
 * Main scoring function: compute deterministic urgency score.
 */
export function computeBaseUrgencyScore(
  reports: ExtractedSignal[],
  locality: Partial<Locality>
): { score: number; breakdown: UrgencyBreakdown } {
  const breakdown: UrgencyBreakdown = {
    severity: computeSeverity(reports),
    recency: computeRecency(reports),
    repeatComplaints: computeImpactScale(reports), // Re-purposing this for scale/impact
    serviceGap: computeServiceGap(locality),
    vulnerability: computeVulnerability(locality),
  };

  const score =
    breakdown.severity +
    breakdown.recency +
    breakdown.repeatComplaints +
    breakdown.serviceGap +
    breakdown.vulnerability;

  return { score: Math.min(score, 100), breakdown };
}

/**
 * Convert numeric score to UrgencyLevel enum.
 */
export function scoreToLevel(score: number): UrgencyLevel {
  if (score >= 75) return UrgencyLevel.CRITICAL;
  if (score >= 55) return UrgencyLevel.HIGH;
  if (score >= 35) return UrgencyLevel.MEDIUM;
  return UrgencyLevel.LOW;
}
