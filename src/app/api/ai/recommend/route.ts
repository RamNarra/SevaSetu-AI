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

    const response = await genai.models.generateContent({
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

    return NextResponse.json({ success: true, result });
  } catch (error) {
    console.error('Resource matching error:', error);
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
