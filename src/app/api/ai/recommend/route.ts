import { NextRequest, NextResponse } from 'next/server';
import { genai, MODEL, parseJsonResponse } from '@/lib/ai/client';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { campTitle, localityName, requiredRoles, volunteers } = body;

    if (!campTitle || typeof campTitle !== 'string') {
      return NextResponse.json({ success: false, error: 'campTitle is required' }, { status: 400 });
    }
    if (!Array.isArray(volunteers) || volunteers.length === 0) {
      return NextResponse.json({ success: false, error: 'volunteers array is required' }, { status: 400 });
    }

    const prompt = `You are a resource matching AI for SevaSetu AI, an NGO health camp platform.

Camp: "${campTitle}" at ${localityName}
Required roles: ${JSON.stringify(requiredRoles)}

Available volunteers:
${JSON.stringify(volunteers, null, 2)}

For each required role, recommend the best-matching volunteers from the list. Consider: skills, certifications, language match, availability, travel distance to the locality, and experience.

Return ONLY valid JSON array:
[
  {
    "volunteerId": "string",
    "volunteerName": "string",
    "role": "string (DOCTOR/PHARMACIST/FIELD_VOLUNTEER/SUPPORT)",
    "matchScore": number (0-100),
    "reasoning": "string - 1 sentence why this person is a good match"
  }
]

Rank by match score descending. Include ALL available volunteers with scores.`;

    const response = await genai.models.generateContent({
      model: MODEL,
      contents: prompt,
      config: { temperature: 0.3, maxOutputTokens: 8192 },
    });

    const text = response.text || '';
    const result = parseJsonResponse(text);

    return NextResponse.json({ success: true, result });
  } catch (error) {
    console.error('Resource matching error:', error);
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
