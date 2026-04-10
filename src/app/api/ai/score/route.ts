import { NextRequest, NextResponse } from 'next/server';
import { genai, MODEL, parseJsonResponse } from '@/lib/ai/client';

export async function POST(request: NextRequest) {
  try {
    const { localityName, baseScore, breakdown, reports } = await request.json();

    const prompt = `You are an urgency scoring AI for SevaSetu AI, an NGO health camp platform.

A locality "${localityName}" has a deterministic base urgency score of ${baseScore}/100.

Score breakdown:
- Severity: ${breakdown?.severity || 0}/25
- Recency: ${breakdown?.recency || 0}/20
- Repeat Complaints: ${breakdown?.repeatComplaints || 0}/20
- Service Gap: ${breakdown?.serviceGap || 0}/15
- Vulnerability: ${breakdown?.vulnerability || 0}/20

Recent reports summary:
${reports || 'No reports available'}

Your task:
1. Validate whether the base score seems appropriate given the reports
2. Suggest an adjustment (-10 to +10) if the formula missed something
3. Provide a clear, 2-3 sentence reasoning explaining why this locality has its urgency level

Return ONLY valid JSON:
{
  "adjustment": number (-10 to +10),
  "reasoning": "string - 2-3 sentence explanation for coordinators"
}`;

    const response = await genai.models.generateContent({
      model: MODEL,
      contents: prompt,
      config: { temperature: 0.3, maxOutputTokens: 1024 },
    });

    const text = response.text || '';
    const result = parseJsonResponse(text);

    return NextResponse.json({ success: true, result });
  } catch (error) {
    console.error('Urgency scoring error:', error);
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
