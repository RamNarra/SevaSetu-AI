import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { computeBaseUrgency } from "@/lib/scoring/urgency-v2";
import { applyFairnessCorrection } from "@/lib/scoring/fairness";
import { generateScoreCard } from "@/lib/scoring/explain";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { localityId } = body;

    if (!localityId) {
      return NextResponse.json({ error: "localityId is required" }, { status: 400 });
    }

    const localityRef = adminDb.collection("localities").doc(localityId);
    const doc = await localityRef.get();

    if (!doc.exists) {
      return NextResponse.json({ error: "Locality not found" }, { status: 404 });
    }

    const data = doc.data();

    // Mock extraction of features from locality data
    // In production, this would aggregate real sub-collection data (reports, supplies, etc.)
    const features = {
      populationDensity: data?.metrics?.populationDensity ?? 0.5,
      resourceScarcity: data?.metrics?.resourceScarcity ?? 0.6,
      incidentSeverity: data?.metrics?.incidentSeverity ?? 0.7,
      vulnerabilityIndex: data?.metrics?.vulnerabilityIndex ?? 0.4,
    };

    const fairnessContext = {
      districtAllocationRatio: data?.metrics?.districtAllocationRatio ?? 0.3,
      historicalNeglectIndex: data?.metrics?.historicalNeglectIndex ?? 0.5,
    };

    // 1. Calculate Base Urgency
    const scoreResult = computeBaseUrgency(features);
    
    // 2. Apply Fairness Corrections
    const fairnessResult = applyFairnessCorrection(scoreResult, fairnessContext);

    // 3. Generate Human Readable Explainability
    const scoreCard = generateScoreCard(scoreResult, fairnessResult);

    // 4. Update the document
    await localityRef.update({
      score_version: "v2",
      urgencyScore: scoreCard.overallScore, // 0-100 
      urgencyLevel: scoreCard.level,
      scoreDetails: {
        features,
        adjustments: fairnessResult.adjustments,
        explanations: scoreCard.explanations,
        calculatedAt: new Date().toISOString(),
      },
      updatedAt: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      localityId,
      scoreCard,
    });

  } catch (error: any) {
    console.error("Error recomputing score:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
