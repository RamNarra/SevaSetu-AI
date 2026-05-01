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

CRITICAL: Start your response DIRECTLY with "# Camp Impact Snapshot". Do NOT write any introduction, preamble, or "As an AI..." opener. Output ONLY the markdown structure below — nothing before the first heading.

Structure:
1. # Camp Impact Snapshot
| Metric | Value |
|--------|-------|
(table with: Total Patients, Consultations Completed, Referrals Made, Follow-ups Needed, Medicines Dispensed)

2. ## Key Health Trends
(bullet points from the patient data)

3. ## Predictive Follow-ups
(CRITICAL: Analyze patient data and predict who else needs follow-up, not just those already marked)

4. ## Resource Gaps & Recommendations
(Next-step actions for the coordinator)

Use a professional and supportive tone.`;

    let summaryText: string;
    try {
      const response = await generateContentWithFallback({
        model: MODEL,
        contents: prompt,
        config: { temperature: 0.4, maxOutputTokens: 2048 },
      });
      summaryText = response.text || '';
      // Strip any preamble before the first markdown heading
      const firstHash = summaryText.indexOf('#');
      if (firstHash > 0) summaryText = summaryText.slice(firstHash);
    } catch (modelErr) {
      console.warn('[summarize] model call failed, using fallback:', modelErr instanceof Error ? modelErr.message : modelErr);
      const visitCount = Array.isArray(patientVisits) ? patientVisits.length : 0;
      const dispenseCount = Array.isArray(dispenseLogs) ? dispenseLogs.length : 0;
      const followupCount = Array.isArray(followups) ? followups.length : 0;
      summaryText = `# Camp Impact Snapshot\n\n| Metric | Value |\n|--------|-------|\n| Patients Seen | ${visitCount} |\n| Medicines Dispensed | ${dispenseCount} |\n| Follow-ups Scheduled | ${followupCount} |\n\n# Key Health Trends\n\n- ${visitCount} patients received care during this camp session\n- ${dispenseCount} medicine dispensing events recorded\n- ${followupCount} follow-up visits planned\n\n# Predictive Follow-ups\n\n- Patients with chronic conditions should be revisited within 2 weeks\n- Any referrals made should be tracked for completion\n\n# Resource Gaps & Recommendations\n\n- Review medicine stock levels before next camp\n- Ensure adequate volunteer coverage for follow-up visits`;
    }

    if (!summaryText.trim()) {
      summaryText = 'Summary generation returned empty. Please try again.';
    }

    void recordAiAudit({
      op: 'summarize',
      model: MODEL,
      promptVersion: 'summarize.v1',
      latencyMs: Date.now() - t0,
      validationPassed: true,
    });

    return NextResponse.json({
      success: true,
      summary: summaryText,
    });
  } catch (error) {
    console.error('Summary generation error:', error);
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
});
