import { NextRequest, NextResponse } from 'next/server';
import { genai, MODEL } from '@/lib/ai/client';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { campTitle, patientVisits, dispenseLogs, followups } = body;

    if (!campTitle || typeof campTitle !== 'string') {
      return NextResponse.json({ success: false, error: 'campTitle is required' }, { status: 400 });
    }

    const prompt = `You are an impact analyst AI for SevaSetu AI.
    
    Generate a comprehensive camp summary for "${campTitle}".
    
    Data:
    - Patient visit records: ${JSON.stringify(patientVisits)}
    - Medicine logs: ${JSON.stringify(dispenseLogs)}
    - Explicit follow-ups: ${JSON.stringify(followups)}
    
    Structure the markdown summary as follows:
    1. # Camp Impact Snapshot (Stats table)
    2. # Key Health Trends (Bullet points)
    3. # Predictive Follow-ups (CRITICAL: Analyze patient data and predict who else needs follow-up, not just those already marked)
    4. # Resource Gaps & Recommendations (Next-step actions for the coordinator)
    
    Use a professional and supportive tone.`;

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
