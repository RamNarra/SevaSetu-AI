import { UrgencyBreakdown, UrgencyLevel, ExtractedReport, Locality } from '@/types';
import { Timestamp } from 'firebase/firestore';

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
function computeSeverity(reports: ExtractedReport[]): number {
  const criticalKeywords = ['outbreak', 'epidemic', 'death', 'infant mortality', 'malnutrition', 'waterborne', 'cholera', 'dengue', 'tuberculosis'];
  const highKeywords = ['chronic', 'diabetes', 'hypertension', 'maternal', 'anemia', 'diarrhea', 'fever', 'skin disease'];
  const mediumKeywords = ['cold', 'cough', 'eye', 'dental', 'minor injury', 'headache'];

  let maxSeverity = 0;

  for (const report of reports) {
    const text = [...report.issueTypes, ...report.urgencySignals].join(' ').toLowerCase();

    if (criticalKeywords.some((k) => text.includes(k))) {
      maxSeverity = Math.max(maxSeverity, 25);
    } else if (highKeywords.some((k) => text.includes(k))) {
      maxSeverity = Math.max(maxSeverity, 18);
    } else if (mediumKeywords.some((k) => text.includes(k))) {
      maxSeverity = Math.max(maxSeverity, 10);
    } else {
      maxSeverity = Math.max(maxSeverity, 5);
    }
  }

  return maxSeverity;
}

/**
 * Compute recency score — how recent are the reports?
 */
function computeRecency(reports: ExtractedReport[]): number {
  if (reports.length === 0) return 0;

  const now = Date.now();
  const mostRecent = reports.reduce((latest, r) => {
    const t = r.processedAt instanceof Timestamp ? r.processedAt.toMillis() : now;
    return Math.max(latest, t);
  }, 0);

  const daysSinceReport = (now - mostRecent) / (1000 * 60 * 60 * 24);

  if (daysSinceReport <= 7) return 20;
  if (daysSinceReport <= 14) return 16;
  if (daysSinceReport <= 30) return 12;
  if (daysSinceReport <= 60) return 8;
  return 4;
}

/**
 * Compute repeat complaint frequency.
 */
function computeRepeatComplaints(reports: ExtractedReport[]): number {
  const issueSet = new Map<string, number>();
  for (const report of reports) {
    for (const issue of report.issueTypes) {
      const key = issue.toLowerCase().trim();
      issueSet.set(key, (issueSet.get(key) || 0) + 1);
    }
  }

  const repeats = Array.from(issueSet.values()).filter((count) => count > 1).length;

  if (repeats >= 5) return 20;
  if (repeats >= 3) return 15;
  if (repeats >= 1) return 10;
  return 0;
}

/**
 * Compute service gap — days since last camp.
 */
function computeServiceGap(locality: Partial<Locality>): number {
  if (!locality.lastCampDate) return 15; // Never served = max gap

  const lastCamp = locality.lastCampDate instanceof Timestamp
    ? locality.lastCampDate.toMillis()
    : Date.now();
  const daysSinceCamp = (Date.now() - lastCamp) / (1000 * 60 * 60 * 24);

  if (daysSinceCamp > 180) return 15;
  if (daysSinceCamp > 90) return 12;
  if (daysSinceCamp > 45) return 8;
  if (daysSinceCamp > 14) return 4;
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
  reports: ExtractedReport[],
  locality: Partial<Locality>
): { score: number; breakdown: UrgencyBreakdown } {
  const breakdown: UrgencyBreakdown = {
    severity: computeSeverity(reports),
    recency: computeRecency(reports),
    repeatComplaints: computeRepeatComplaints(reports),
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
