import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { CampPlan, ExtractedSignal, UserRole, VolunteerProfile } from '@/types';
import { generateContentWithFallback, MODELS, parseJsonResponse } from '@/lib/ai/client';
import { semanticRankVolunteers } from '@/lib/matching/semantic';
import { neighborCells } from '@/lib/maps/geohash';
import { withAuth } from '@/lib/auth/withAuth';
import { allocationRecommendRequestSchema } from '@/lib/ai/requestSchemas';
import { recordAiAudit } from '@/lib/ai/audit';

export const POST = withAuth(async (request: NextRequest) => {
  const t0 = Date.now();
  try {
    const body = await request.json();
    const parsed = allocationRecommendRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid request', issues: parsed.error.issues },
        { status: 400 }
      );
    }
    const { campId, reportId, constraints: c, topK } = parsed.data;

    const campSnap = await adminDb.collection('camp_plans').doc(campId).get();
    if (!campSnap.exists) {
      return NextResponse.json({ success: false, error: 'Camp not found' }, { status: 404 });
    }
    const camp = campSnap.data() as CampPlan;

    // Resolve camp coordinates + geohash neighbor cells for prefilter
    let campLat: number | null = null;
    let campLng: number | null = null;
    let campGeohash: string | undefined;
    const locSnap = await adminDb.collection('localities').doc(camp.localityId).get();
    if (locSnap.exists) {
      const ld = locSnap.data() ?? {};
      campLat = ld.coordinates?.lat ?? null;
      campLng = ld.coordinates?.lng ?? null;
      campGeohash = ld.geohash6 ?? ld.geohash;
    }

    // Geohash neighbor prefilter — falls back to full collection if missing
    let volSnaps;
    if (campGeohash) {
      const cells = neighborCells(campGeohash);
      const queries = cells.map((cell) =>
        adminDb.collection('volunteer_profiles').where('geohash6', '==', cell).get()
      );
      const results = await Promise.all(queries);
      const seen = new Set<string>();
      const docs: FirebaseFirestore.QueryDocumentSnapshot[] = [];
      for (const r of results) {
        for (const d of r.docs) {
          if (!seen.has(d.id)) {
            seen.add(d.id);
            docs.push(d);
          }
        }
      }
      volSnaps = docs;
    }
    if (!volSnaps || volSnaps.length === 0) {
      const all = await adminDb.collection('volunteer_profiles').get();
      volSnaps = all.docs;
    }

    const volunteers: VolunteerProfile[] = volSnaps.map((d) => {
      const data = d.data() as VolunteerProfile;
      return { ...data, id: d.id, userId: data.userId ?? d.id };
    });

    // Build a synthetic ExtractedSignal as the matching context
    let signal: ExtractedSignal | null = null;
    if (reportId) {
      const reportSnap = await adminDb.collection('extracted_reports').doc(reportId).get();
      if (reportSnap.exists) signal = reportSnap.data() as ExtractedSignal;
    }
    if (!signal) {
      signal = {
        reportId: campId,
        locality: { canonicalId: camp.localityId, rawName: camp.localityName, confidence: 1 },
        needs: [],
        urgencySignals: [],
        geo: { lat: campLat, lng: campLng, geohash: campGeohash ?? null, source: 'map_geocode' },
        model: { provider: 'vertex-ai', name: 'synthetic', version: '1', promptVersion: '1' },
      };
    } else {
      // Hydrate geo with locality coords if extracted signal lacks them
      if (signal.geo.lat == null && campLat !== null) signal.geo.lat = campLat;
      if (signal.geo.lng == null && campLng !== null) signal.geo.lng = campLng;
    }

    // Translate request constraints → solver constraints
    const reqRoles = c?.roles ?? [];
    const needsRole =
      reqRoles.length === 0 || reqRoles.includes('ALL') ? undefined : (reqRoles[0] as UserRole);

    const solverConstraints = {
      needsRole,
      maxDistanceKm: c?.maxDistance ?? undefined,
      requiredLanguages: c?.requiredLanguages ?? (c?.language ? [c.language] : undefined),
      requiredCertifications: c?.genderSensitive ? ['gender_sensitive_care'] : c?.requiredCertifications,
      preferredSkills: c?.preferredSkills ?? (c?.genderSensitive ? ['gender_sensitive_care'] : undefined),
      maxFatigueScore: c?.maxFatigue ?? undefined,
      cooldownHours: c?.cooldownHours ?? undefined,
      strictAvailability: c?.availableOnly !== false,
    };

    const { matches, mode } = await semanticRankVolunteers({
      signal,
      volunteers,
      constraints: solverConstraints,
      topK,
    });

    // Optional LLM rerank of top-5 with explicit reasoning
    let llmAdjustments: Array<{ id: string; adjustedScore?: number; explanation?: string }> = [];
    const top5 = matches.slice(0, 5);
    if (top5.length > 0) {
      try {
        const prompt = `You are SevaSetu AI's coordinator assistant. We have already ranked candidates with a constraint solver and ${mode === 'vector' ? 'semantic vector similarity' : 'lexical similarity'}. Your job: write a 1-sentence judge-defensible reasoning for each, and you MAY adjust the score by ±5 if a critical context is being missed (e.g., perfect skill alignment, rare certification, language overlap with vulnerable community).

Camp: "${camp.title}" at ${camp.localityName}.
Top needs: ${signal.needs.slice(0, 3).map((n) => n.label).join(', ') || 'general health camp'}.

Candidates:
${JSON.stringify(top5.map((m) => ({
  id: m.volunteer.userId ?? m.volunteer.id,
  name: m.volunteer.displayName,
  role: m.volunteer.role,
  skills: m.volunteer.skills,
  certifications: m.volunteer.certifications,
  languages: m.volunteer.languages,
  rating: m.volunteer.rating,
  completedCamps: m.volunteer.completedCamps,
  initialScore: m.matchScore,
  semantic: m.semanticScore,
  distanceKm: m.distanceKm,
  reasons: m.reasons,
})), null, 2)}

Return ONLY a JSON array:
[{ "id": "string", "adjustedScore": number (0-100), "explanation": "string" }]`;

        const llmStart = Date.now();
        const aiRes = await generateContentWithFallback({
          model: MODELS.routing,
          contents: prompt,
          config: { temperature: 0.2, responseMimeType: 'application/json', maxOutputTokens: 1024 },
        });
        llmAdjustments = parseJsonResponse(aiRes.text || '[]') as typeof llmAdjustments;

        void recordAiAudit({
          op: 'recommend',
          model: MODELS.routing,
          promptVersion: 'recommend.v2',
          latencyMs: Date.now() - llmStart,
          validationPassed: Array.isArray(llmAdjustments),
          documentId: campId,
          collection: 'camp_plans',
        });
      } catch (err) {
        console.warn('[recommend] LLM rerank skipped:', err instanceof Error ? err.message : err);
      }
    }

    const finalMatches = matches.map((m) => {
      const id = m.volunteer.userId ?? m.volunteer.id ?? '';
      const llm = llmAdjustments.find((x) => x.id === id);
      const llmScore = typeof llm?.adjustedScore === 'number' ? llm.adjustedScore : null;
      const conflict = llmScore !== null && Math.abs(llmScore - m.matchScore) > 15;
      return {
        volunteerId: id,
        volunteer: m.volunteer,
        matchScore: llmScore ?? m.matchScore,
        deterministicScore: m.matchScore,
        semanticScore: m.semanticScore,
        constraintScore: m.constraintScore,
        proximityScore: m.proximityScore,
        distanceKm: m.distanceKm,
        embeddingMode: m.embeddingMode,
        explanation:
          llm?.explanation ??
          (m.reasons.length > 0 ? m.reasons.slice(0, 3).join('; ') : 'Meets all hard constraints.'),
        reasons: m.reasons,
        conflictAlert: conflict,
      };
    });

    return NextResponse.json({
      success: true,
      campId,
      mode,
      matches: finalMatches,
      latencyMs: Date.now() - t0,
    });
  } catch (error) {
    console.error('Allocation recommend error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
});

