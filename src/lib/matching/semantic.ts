/**
 * SevaSetu AI — Semantic + constraint-aware volunteer ranker.
 *
 * Pipeline:
 *   1. Hard constraint filter (constraints.ts)
 *   2. Geohash neighbor cell prefilter (when available)
 *   3. Soft scoring: 0.55 * semantic + 0.30 * deterministic + 0.15 * proximity
 *   4. Top-K LLM rerank (handled by the route layer)
 *
 * Falls back to lexical similarity if the embeddings API is unavailable.
 */

import { ExtractedSignal, VolunteerProfile } from '@/types';
import {
  filterCandidatesWithReasons,
  softScore,
  type MatchConstraints,
} from './constraints';
import {
  cosineSimilarity,
  embedText,
  lexicalSimilarity,
  reportSummaryString,
  volunteerSummaryString,
  type Vector,
} from '@/lib/ai/embeddings';
import { haversineKm } from '@/lib/maps/geohash';

export interface SemanticMatch {
  volunteer: VolunteerProfile;
  matchScore: number;            // 0-100
  semanticScore: number;         // 0-1
  constraintScore: number;       // 0-1
  proximityScore: number;        // 0-1
  reasons: string[];
  distanceKm?: number;
  embeddingMode: 'vector' | 'lexical';
  conflictAlert?: boolean;
}

export interface SemanticRankInput {
  signal: ExtractedSignal;
  volunteers: VolunteerProfile[];
  constraints: MatchConstraints;
  topK?: number;
}

const W_SEMANTIC = 0.55;
const W_CONSTRAINT = 0.30;
const W_PROXIMITY = 0.15;

interface VolunteerWithEmbedding extends VolunteerProfile {
  embedding?: Vector;
  embeddingText?: string;
}

export async function semanticRankVolunteers(
  input: SemanticRankInput
): Promise<{ matches: SemanticMatch[]; mode: 'vector' | 'lexical' }> {
  const { signal, volunteers, constraints, topK = 10 } = input;

  // 1. Hard filter
  const { kept } = filterCandidatesWithReasons(volunteers, signal, constraints);
  if (kept.length === 0) return { matches: [], mode: 'lexical' };

  // 2. Compute report summary
  const reportText = reportSummaryString(signal);
  const reportVector = await embedText(reportText);
  const mode: 'vector' | 'lexical' = reportVector ? 'vector' : 'lexical';

  // 3. Soft score each remaining candidate
  const scored: SemanticMatch[] = [];
  for (const v of kept as VolunteerWithEmbedding[]) {
    const summary = v.embeddingText ?? volunteerSummaryString(v);

    let semanticScore = 0;
    if (reportVector) {
      let vec = v.embedding;
      if (!vec) {
        vec = (await embedText(summary)) ?? undefined;
      }
      if (vec && vec.length === reportVector.length) {
        semanticScore = Math.max(0, cosineSimilarity(reportVector, vec));
      } else {
        semanticScore = lexicalSimilarity(reportText, summary);
      }
    } else {
      semanticScore = lexicalSimilarity(reportText, summary);
    }

    const { score: constraintScore, reasons: constraintReasons } = softScore(
      v,
      signal,
      constraints
    );

    let proximityScore = 0;
    let distanceKm: number | undefined;
    if (
      signal.geo?.lat !== null &&
      signal.geo?.lng !== null &&
      v.coordinates?.lat !== undefined &&
      v.coordinates?.lng !== undefined
    ) {
      distanceKm = haversineKm(
        signal.geo!.lat!,
        signal.geo!.lng!,
        v.coordinates.lat,
        v.coordinates.lng
      );
      const cap = constraints.maxDistanceKm ?? 100;
      proximityScore = Math.max(0, 1 - distanceKm / cap);
    }

    const blended =
      W_SEMANTIC * semanticScore +
      W_CONSTRAINT * constraintScore +
      W_PROXIMITY * proximityScore;

    const reasons: string[] = [...constraintReasons];
    if (semanticScore >= 0.55) {
      reasons.unshift(
        mode === 'vector'
          ? `strong semantic match (${(semanticScore * 100).toFixed(0)}% cosine)`
          : `strong keyword match (${(semanticScore * 100).toFixed(0)}%)`
      );
    } else if (semanticScore > 0) {
      reasons.unshift(
        mode === 'vector'
          ? `semantic similarity ${(semanticScore * 100).toFixed(0)}%`
          : `keyword similarity ${(semanticScore * 100).toFixed(0)}%`
      );
    }
    if (distanceKm !== undefined) {
      reasons.push(`${distanceKm.toFixed(1)}km from camp`);
    }

    scored.push({
      volunteer: v,
      matchScore: Math.round(blended * 100),
      semanticScore: Number(semanticScore.toFixed(3)),
      constraintScore: Number(constraintScore.toFixed(3)),
      proximityScore: Number(proximityScore.toFixed(3)),
      reasons,
      distanceKm,
      embeddingMode: mode,
    });
  }

  scored.sort((a, b) => b.matchScore - a.matchScore);
  return { matches: scored.slice(0, topK), mode };
}
