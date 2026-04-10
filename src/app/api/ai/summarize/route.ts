import { NextRequest, NextResponse } from 'next/server';
import { genai, MODEL } from '@/lib/ai/client';

export async function POST(request: NextRequest) {
  try {
    const { campTitle, patientVisits, dispenseLogs, followups } = await request.json();

    const prompt = `You are a summary generation AI for SevaSetu AI, an NGO health camp platform.

Generate a comprehensive camp summary for "${campTitle}".

Patient visit data: ${JSON.stringify(patientVisits)}
Medicine dispensing: ${JSON.stringify(dispenseLogs)}
Follow-ups needed: ${JSON.stringify(followups)}

Generate a professional, concise camp summary in markdown format including:
1. Key statistics (patients served, consultations, medicines dispensed, referrals, follow-ups)
2. Notable health patterns observed
3. Critical cases requiring follow-up
4. Recommendations for the next camp in this area
5. Resource adequacy assessment

Keep it clear and actionable for NGO coordinators.`;

    const response = await genai.models.generateContent({
      model: MODEL,
      contents: prompt,
      config: { temperature: 0.4, maxOutputTokens: 2048 },
    });

    return NextResponse.json({
      success: true,
      summary: response.text || 'Summary generation failed.',
    });
  } catch (error) {
    console.error('Summary generation error:', error);
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
