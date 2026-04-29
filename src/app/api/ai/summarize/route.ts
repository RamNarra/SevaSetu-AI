import { NextRequest, NextResponse } from 'next/server';
import { generateContentWithFallback, MODEL } from '@/lib/ai/client';
import { withAuth } from '@/lib/auth/withAuth';
import { aiSummarizeRequestSchema } from '@/lib/ai/requestSchemas';
import { recordAiAudit } from '@/lib/ai/audit';

export const POST = withAuth(async (request: NextRequest) => {
  const t0 = Date.now();
  try {
    const body = await request.json();
    const parsed = aiSummarizeRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid request', issues: parsed.error.issues },
        { status: 400 }
      );
    }
    const { campTitle, patientVisits, dispenseLogs, followups } = parsed.data;

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

    const response = await generateContentWithFallback({
      model: MODEL,
      contents: prompt,
      config: { temperature: 0.4, maxOutputTokens: 2048 },
    });

    void recordAiAudit({
      op: 'summarize',
      model: MODEL,
      promptVersion: 'summarize.v1',
      latencyMs: Date.now() - t0,
      validationPassed: true,
    });

    return NextResponse.json({
      success: true,
      summary: response.text || 'Summary generation failed.',
    });
  } catch (error) {
    console.error('Summary generation error:', error);
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
});
