import { NextRequest, NextResponse } from 'next/server';
import { generateContentWithFallback, MODEL, parseJsonResponse } from '@/lib/ai/client';
import { withAuth } from '@/lib/auth/withAuth';
import { aiRecommendRequestSchema } from '@/lib/ai/requestSchemas';
import { recordAiAudit } from '@/lib/ai/audit';

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
    const result = parseJsonResponse(text);

    void recordAiAudit({
      op: 'recommend',
      model: MODEL,
      promptVersion: 'ai.recommend.v1',
      latencyMs: Date.now() - t0,
      validationPassed: Array.isArray(result),
    });

    return NextResponse.json({ success: true, result });
  } catch (error) {
    console.error('Resource matching error:', error);
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
});
