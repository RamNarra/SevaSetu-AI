export interface ScoreResult {
  baseScore: number;
  features: {
    incidentSeverity: number;
    resourceScarcity: number;
  };
}

import { FairnessResult } from "./fairness";

export interface ScoreCard {
  overallScore: number;
  level: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  explanations: string[];
}

export function generateScoreCard(
  scoreResult: ScoreResult,
  fairnessResult: FairnessResult
): ScoreCard {
  const explanations: string[] = [];

  if (scoreResult.features.incidentSeverity > 0.8) {
    explanations.push("Critical incident severity reported in the area.");
  }
  if (scoreResult.features.resourceScarcity > 0.7) {
    explanations.push("High regional resource scarcity detected.");
  }
  
  if (fairnessResult.adjustments.historicalAdjustment > 0.1) {
    explanations.push("Score increased due to historical vulnerability indexing.");
  }
  
  if (fairnessResult.adjustments.districtAdjustment < 0) {
    explanations.push("Score slightly moderated due to recent resource allocations in the district.");
  }

  if (explanations.length === 0) {
    explanations.push("Score derived from standard baseline reporting.");
  }

  const score = fairnessResult.finalScore;
  let level: ScoreCard["level"] = "LOW";
  if (score >= 0.8) level = "CRITICAL";
  else if (score >= 0.6) level = "HIGH";
  else if (score >= 0.4) level = "MEDIUM";

  // Format explicitly as 0-100 for readability
  return {
    overallScore: Math.round(score * 100),
    level,
    explanations,
  };
}
