import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { computeBaseUrgency } from "@/lib/scoring/urgency-v2";
import { applyFairnessCorrection } from "@/lib/scoring/fairness";
import { generateScoreCard } from "@/lib/scoring/explain";
import { withAuth } from "@/lib/auth/withAuth";
import { scoringRecomputeRequestSchema } from "@/lib/ai/requestSchemas";

export const POST = withAuth(async (req: NextRequest) => {
  try {
    const body = await req.json();
    const parsed = scoringRecomputeRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", issues: parsed.error.issues },
        { status: 400 }
      );
    }
    const { localityId } = parsed.data;

    const localityRef = adminDb.collection("localities").doc(localityId);
    const doc = await localityRef.get();
    if (!doc.exists) {
      return NextResponse.json({ error: "Locality not found" }, { status: 404 });
    }

    const data = doc.data() ?? {};
    const features = {
      populationDensity: data.metrics?.populationDensity ?? Math.min(1, (data.population ?? 1000) / 50000),
      resourceScarcity:
        data.metrics?.resourceScarcity ?? (data.lastCampDate ? 0.5 : 0.8),
      incidentSeverity:
        data.metrics?.incidentSeverity ?? (data.urgencyScore ? data.urgencyScore / 100 : 0.6),
      vulnerabilityIndex: data.metrics?.vulnerabilityIndex ?? data.vulnerabilityIndex ?? 0.5,
    };

    const fairnessContext = {
      districtAllocationRatio: data.metrics?.districtAllocationRatio ?? 0.3,
      historicalNeglectIndex:
        data.metrics?.historicalNeglectIndex ?? (1 - features.resourceScarcity),
    };

    const scoreResult = computeBaseUrgency(features);
    const fairnessResult = applyFairnessCorrection(scoreResult, fairnessContext);
    const scoreCard = generateScoreCard(scoreResult, fairnessResult);

    await localityRef.update({
      score_version: "v2",
      urgencyScore: scoreCard.overallScore,
      urgencyLevel: scoreCard.level,
      scoreDetails: {
        features,
        adjustments: fairnessResult.adjustments,
        explanations: scoreCard.explanations,
        components: scoreResult.components,
        calculatedAt: new Date().toISOString(),
      },
      updatedAt: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      localityId,
      scoreCard,
      features,
    });
  } catch (error) {
    console.error("Error recomputing score:", error);
    const msg = error instanceof Error ? error.message : "Internal error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
});
