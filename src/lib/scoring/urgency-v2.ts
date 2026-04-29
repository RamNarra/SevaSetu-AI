import { ExtractedSignal } from '@/types';

export interface LocalityHistoricalData {
  vulnerabilityIndex: number; // 0.0 to 1.0
  lastCampDate?: Date;
}

export interface UrgencyV2Breakdown {
  medicalSeverity: number;
  velocityRecurrence: number;
  ageDecay: number;
  geospatialVulnerability: number;
  baseReserve: number;
  rawScore: number;
  averageConfidence: number;
  confidencePenalty: number;
  finalScore: number;
  recentReportCount: number;
  oldestSignalAgeDays: number;
  decayBypassed: boolean;
}

const URGE_WEIGHTS = {
  MEDICAL: 40,
  VELOCITY: 20,
  AGE: 15,
  GEO: 15,
  BASE: 10,
};

function getSignalTimestamp(signal: ExtractedSignal): number {
  if (signal.createdAt && typeof signal.createdAt.toMillis === 'function') {
    return signal.createdAt.toMillis();
  }

  if (signal.processedAt && typeof signal.processedAt.toMillis === 'function') {
    return signal.processedAt.toMillis();
  }

  return Date.now();
}

export function calculateUrgencyScore(
  signals: ExtractedSignal[],
  historicalData: LocalityHistoricalData
): number {
  return analyzeUrgencyScore(signals, historicalData).finalScore;
}

export function analyzeUrgencyScore(
  signals: ExtractedSignal[],
  historicalData: LocalityHistoricalData
): UrgencyV2Breakdown {
  if (!signals || signals.length === 0) {
    return {
      medicalSeverity: 0,
      velocityRecurrence: 0,
      ageDecay: 0,
      geospatialVulnerability: 0,
      baseReserve: 0,
      rawScore: 0,
      averageConfidence: 0.5,
      confidencePenalty: 0,
      finalScore: 0,
      recentReportCount: 0,
      oldestSignalAgeDays: 0,
      decayBypassed: false,
    };
  }

  const now = new Date().getTime();

  let medicalScore = 0;
  let hasNoDecaySignals = false;
  let totalConfidence = 0;
  let signalCount = 0;

  // Track reports in the last 72 hours
  const recentReports = signals.filter((signal) => {
    const sigTime = getSignalTimestamp(signal);
    return (now - sigTime) <= 72 * 60 * 60 * 1000;
  });

  // 2. Velocity/Recurrence (Maximum 20)
  // Base off number of recent reports. Assume 5 reports in 72 hours is maximum panic (20 points).
  const velocityScore = Math.min(URGE_WEIGHTS.VELOCITY, (recentReports.length / 5) * URGE_WEIGHTS.VELOCITY);

  // Analyze features
  let oldestSignalAgeDays = 0;
  
  signals.forEach((signal) => {
    const sigTime = getSignalTimestamp(signal);
    const ageDays = (now - sigTime) / (1000 * 60 * 60 * 24);
    if (ageDays > oldestSignalAgeDays) oldestSignalAgeDays = ageDays;

    if (signal.urgencySignals && signal.urgencySignals.length > 0) {
      signal.urgencySignals.forEach((u) => {
        // Multiply by confidence of the individual urgency signal
        const conf = u.confidence || 0.5;
        
        switch (u.type) {
          case 'death':
            medicalScore += 40 * conf;
            hasNoDecaySignals = true;
            break;
          case 'outbreak':
            medicalScore += 30 * conf;
            break;
          case 'hospitalization':
            medicalScore += 20 * conf;
            break;
          case 'access_blocked':
            medicalScore += 15 * conf;
            hasNoDecaySignals = true;
            break;
          case 'supply_stockout':
            medicalScore += 15 * conf;
            break;
          case 'vulnerable_group':
            medicalScore += 10 * conf;
            break;
        }
      });
    }

    signal.needs?.forEach((n) => {
      const conf = n.confidence || 0.5;
      medicalScore += n.severity * 2 * conf;
    });

    totalConfidence += (signal.locality?.confidence || 0.8);
    signalCount++;
  });

  // 1. Medical Severity (Maximum 40)
  medicalScore = Math.min(URGE_WEIGHTS.MEDICAL, medicalScore);

  // 3. Age Decay (Maximum 15)
  // Baseline given full 15 points. If older than 14 days, decays to 0, unless hasNoDecaySignals is true.
  let ageScore = URGE_WEIGHTS.AGE;
  if (!hasNoDecaySignals) {
    const decayFactor = Math.max(0, 1 - (oldestSignalAgeDays / 14));
    ageScore = ageScore * decayFactor;
  }

  // 4. Geospatial Vulnerability (Maximum 15)
  // Simple multiplier against the vulnerability index.
  const geoScore = URGE_WEIGHTS.GEO * Math.max(0, Math.min(1, historicalData.vulnerabilityIndex));

  // Base setup
  const rawScore = medicalScore + velocityScore + ageScore + geoScore + URGE_WEIGHTS.BASE;

  // 5. Confidence Penalty (10%)
  // Treat average signal confidence as the penalization multiplier
  const averageConfidence = signalCount > 0 ? (totalConfidence / signalCount) : 0.5;
  
  // Final Score Cap (0-100)
  const finalScore = Math.min(100, Math.max(0, Math.round(rawScore * averageConfidence)));
  const confidencePenalty = Math.max(0, Number((rawScore - rawScore * averageConfidence).toFixed(1)));

  return {
    medicalSeverity: Number(medicalScore.toFixed(1)),
    velocityRecurrence: Number(velocityScore.toFixed(1)),
    ageDecay: Number(ageScore.toFixed(1)),
    geospatialVulnerability: Number(geoScore.toFixed(1)),
    baseReserve: URGE_WEIGHTS.BASE,
    rawScore: Number(rawScore.toFixed(1)),
    averageConfidence: Number(averageConfidence.toFixed(2)),
    confidencePenalty,
    finalScore,
    recentReportCount: recentReports.length,
    oldestSignalAgeDays: Number(oldestSignalAgeDays.toFixed(1)),
    decayBypassed: hasNoDecaySignals,
  };
}

// ----------------------------------------------------------------------------
// Locality-feature scoring API (used by /api/scoring/recompute + fairness layer)
// ----------------------------------------------------------------------------

export interface LocalityFeatures {
  populationDensity: number;   // 0-1
  resourceScarcity: number;    // 0-1
  incidentSeverity: number;    // 0-1
  vulnerabilityIndex: number;  // 0-1
}

export interface ScoreResult {
  baseScore: number; // 0-1 scaled
  features: LocalityFeatures;
  components: {
    severityComponent: number;
    scarcityComponent: number;
    densityComponent: number;
    vulnerabilityComponent: number;
  };
}

const FEATURE_WEIGHTS = {
  severity: 0.40,
  scarcity: 0.25,
  vulnerability: 0.25,
  density: 0.10,
};

function clamp01(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

/**
 * Compute a base urgency score (0-1) from aggregated locality features.
 * Pure function — deterministic, explainable, judge-defensible.
 */
export function computeBaseUrgency(features: LocalityFeatures): ScoreResult {
  const f: LocalityFeatures = {
    populationDensity: clamp01(features.populationDensity),
    resourceScarcity: clamp01(features.resourceScarcity),
    incidentSeverity: clamp01(features.incidentSeverity),
    vulnerabilityIndex: clamp01(features.vulnerabilityIndex),
  };

  const severityComponent = f.incidentSeverity * FEATURE_WEIGHTS.severity;
  const scarcityComponent = f.resourceScarcity * FEATURE_WEIGHTS.scarcity;
  const vulnerabilityComponent = f.vulnerabilityIndex * FEATURE_WEIGHTS.vulnerability;
  const densityComponent = f.populationDensity * FEATURE_WEIGHTS.density;

  const baseScore = clamp01(
    severityComponent + scarcityComponent + vulnerabilityComponent + densityComponent
  );

  return {
    baseScore,
    features: f,
    components: {
      severityComponent,
      scarcityComponent,
      densityComponent,
      vulnerabilityComponent,
    },
  };
}
