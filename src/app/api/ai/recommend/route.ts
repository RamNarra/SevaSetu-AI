import { NextRequest, NextResponse } from 'next/server';
import { generateContentWithFallback, MODEL, parseJsonResponse } from '@/lib/ai/client';
import { withAuth } from '@/lib/auth/withAuth';
import { aiRecommendRequestSchema } from '@/lib/ai/requestSchemas';
import { recordAiAudit } from '@/lib/ai/audit';

type PlannerVolunteer = {
  id?: string;
  name?: string;
  role?: string;
  languages?: string[];
  preferredAreas?: string[];
  completedCamps?: number;
  rating?: number;
};

function buildFallbackRecommendations(
  localityName: string | undefined,
  volunteers: PlannerVolunteer[],
) {
  const locality = (localityName ?? '').toLowerCase();

  return volunteers
    .map((volunteer) => {
      const roleMatch = /doctor|pharmacist|support|field/i.test(volunteer.role ?? '') ? 25 : 10;
      const areaMatch = (volunteer.preferredAreas ?? []).some((area) => locality.includes(area.toLowerCase())) ? 20 : 0;
      const languageScore = Math.min(20, (volunteer.languages ?? []).length * 5);
      const experienceScore = Math.min(20, Math.round((volunteer.completedCamps ?? 0) * 1.2));
      const ratingScore = Math.min(15, Math.round((volunteer.rating ?? 0) * 3));
      const matchScore = Math.min(100, roleMatch + areaMatch + languageScore + experienceScore + ratingScore);

      return {
        volunteerId: volunteer.id ?? '',
        volunteerName: volunteer.name ?? 'Unknown Volunteer',
        role: volunteer.role ?? 'SUPPORT',
        matchScore,
        reasoning: [
          areaMatch > 0 ? 'preferred-area match' : null,
          (volunteer.languages ?? []).length > 0 ? `languages: ${(volunteer.languages ?? []).slice(0, 2).join(', ')}` : null,
          typeof volunteer.completedCamps === 'number' ? `${volunteer.completedCamps} prior camps` : null,
          typeof volunteer.rating === 'number' ? `rating ${volunteer.rating}` : null,
        ].filter(Boolean).join(', '),
      };
    })
    .sort((left, right) => right.matchScore - left.matchScore);
}

export const POST = withAuth(async (request: NextRequest) => {
  const t0 = Date.now();
  try {
    const body = await request.json();
    const parsed = aiRecommendRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid request', issues: parsed.error.issues },
        { status: 400 }
      );
    }
    const { campTitle, localityName, requiredRoles, volunteers } = parsed.data;

    const prompt = `You are a resource matching AI for SevaSetu AI.
    
    Camp: "${campTitle}" at ${localityName}
    Requirements: ${JSON.stringify(requiredRoles)}
    
    Volunteer Pool: ${JSON.stringify(volunteers)}
    
    Match volunteers to roles. Priority criteria:
    1. ROLE MATCH (Doctor must be DOCTOR)
    2. LANGUAGE MATCH (Crucial for communication in local area)
    3. EXPERIENCE (Previous camps completed)
    4. DISTANCE (Lower radius is better)
    
    Return a JSON array of objects:
    {
      "volunteerId": "string",
      "volunteerName": "string",
      "role": "string",
      "matchScore": number (0-100),
      "reasoning": "string (mention language/experience match)"
    }`;

    let result: unknown;
    let usedFallback = false;
    try {
      const response = await generateContentWithFallback({
        model: MODEL,
        contents: prompt,
        config: { 
          temperature: 0.3, 
          maxOutputTokens: 8192,
          responseMimeType: 'application/json',
        },
      });

      const text = response.text || '';
      result = parseJsonResponse(text);
      if (!Array.isArray(result)) {
        throw new Error('Recommendation response was not an array');
      }
    } catch (error) {
      console.warn('[ai/recommend] using deterministic fallback:', error instanceof Error ? error.message : error);
      usedFallback = true;
      result = buildFallbackRecommendations(localityName, volunteers as PlannerVolunteer[]);
    }

    void recordAiAudit({
      op: 'recommend',
      model: MODEL,
      promptVersion: 'ai.recommend.v1',
      latencyMs: Date.now() - t0,
      validationPassed: !usedFallback && Array.isArray(result),
      notes: usedFallback ? 'deterministic-fallback' : undefined,
    });

    return NextResponse.json({ success: true, result, fallbackUsed: usedFallback });
  } catch (error) {
    console.error('Resource matching error:', error);
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
});
