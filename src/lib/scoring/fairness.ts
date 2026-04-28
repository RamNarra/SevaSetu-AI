import { ScoreResult } from "./explain";

export interface FairnessContext {
  districtAllocationRatio: number; // 0 to 1, how much this district has already received relative to its needs
  historicalNeglectIndex: number; // 0 to 1, higher means more historically neglected
}

export interface FairnessResult {
  finalScore: number;
  adjustments: {
    districtAdjustment: number;
    historicalAdjustment: number;
  };
}

export function applyFairnessCorrection(
  scoreResult: ScoreResult,
  context: FairnessContext
): FairnessResult {
  // If district has received a lot (high ratio), slightly penalize
  const districtAdjustment = (0.5 - context.districtAllocationRatio) * 0.1;

  // Boost score for historically neglected areas
  const historicalAdjustment = context.historicalNeglectIndex * 0.15;

  let finalScore = scoreResult.baseScore + districtAdjustment + historicalAdjustment;
  
  // Clamp between 0 and 1
  finalScore = Math.min(Math.max(finalScore, 0), 1);

  return {
    finalScore,
    adjustments: {
      districtAdjustment,
      historicalAdjustment,
    },
  };
}
