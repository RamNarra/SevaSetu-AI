import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';
import { genai, parseJsonResponse, MODELS } from '@/lib/ai/client';
import { ReportStatus } from '@/types';
import { extractedSignalSchema } from '@/lib/ai/schemas';
import { TypeSchema } from '@google/genai';

// The required system prompt for extraction.
const EXTRACTION_PROMPT = `You are an AI assistant for SevaSetu AI, an NGO resource allocation platform for community health camps in India.

Analyze the provided field report.
Return ONLY a valid JSON object representing the ExtractedSignal with these exact fields:
{
  "locality": {
    "canonicalId": "null (unless identified)",
    "rawName": "string - village/area/block name",
    "confidence": number (0.0 to 1.0)
  },
  "needs": [
    {
      "taxonomyCode": "string - e.g. tb, waterborne, dengue, medicine, consultation",
      "label": "string - human readable label",
      "severity": number (1 to 5),
      "affectedEstimate": number,
      "evidenceSpan": "string - exact quote describing the need",
      "confidence": number (0.0 to 1.0)
    }
  ],
  "urgencySignals": [
    {
      "type": "death" | "hospitalization" | "outbreak" | "supply_stockout" | "access_blocked" | "vulnerable_group",
      "evidenceSpan": "string - exact quote",
      "confidence": number (0.0 to 1.0)
    }
  ],
  "geo": {
    "lat": null,
    "lng": null,
    "geohash": null,
    "source": "report_text"
  },
  "model": {
    "provider": "vertex-ai",
    "name": "gemini",
    "version": "3.1-pro",
    "promptVersion": "1.0"
  }
}`;

export async function POST(request: NextRequest) {
  let reportId: string | undefined;

  try {
    const body = await request.json();
    reportId = body.reportId;
    const text = body.text;

    if (!reportId || !text) {
      return NextResponse.json({ success: false, error: 'Missing reportId or text' }, { status: 400 });
    }

    // Update status to PROCESSING
    // Since Phase 1 might be partially applied and writes to `raw_reports`, we will update both if we can,
    // but the plan says `community_reports`. To be safe for Phase 0, we write to `community_reports`
    // but also `raw_reports` since `pipeline.ts` created `raw_reports/{id}`.
    const rawReportRef = adminDb.collection('raw_reports').doc(reportId);
    const commReportRef = adminDb.collection('community_reports').doc(reportId);

    // Ensure we trigger updates without failing if one doesn't exist
    await rawReportRef.update({
      status: ReportStatus.PROCESSING,
      updatedAt: FieldValue.serverTimestamp()
    }).catch(() => {});
    
    await commReportRef.set({
      status: ReportStatus.PROCESSING,
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true }).catch(() => {});

    // Do Extraction
    const response = await genai.models.generateContent({
      model: MODELS.extraction,
      contents: [{
        role: 'user',
        parts: [
          { text: EXTRACTION_PROMPT + "\n\nField Report Text:\n" + text }
        ]
      }],
      config: {
        temperature: 0.1,
        maxOutputTokens: 2048,
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'OBJECT',
          properties: {
            locality: {
              type: 'OBJECT',
              properties: {
                canonicalId: { type: 'STRING', nullable: true },
                rawName: { type: 'STRING' },
                confidence: { type: 'NUMBER' }
              },
              required: ['rawName', 'confidence']
            },
            needs: {
              type: 'ARRAY',
              items: {
                type: 'OBJECT',
                properties: {
                  taxonomyCode: { type: 'STRING' },
                  label: { type: 'STRING' },
                  severity: { type: 'NUMBER' },
                  affectedEstimate: { type: 'NUMBER' },
                  evidenceSpan: { type: 'STRING' },
                  confidence: { type: 'NUMBER' }
                },
                required: ['taxonomyCode', 'label', 'severity', 'affectedEstimate', 'evidenceSpan', 'confidence']
              }
            },
            urgencySignals: {
              type: 'ARRAY',
              items: {
                type: 'OBJECT',
                properties: {
                  type: { type: 'STRING', enum: ['death', 'hospitalization', 'outbreak', 'supply_stockout', 'access_blocked', 'vulnerable_group'] },
                  evidenceSpan: { type: 'STRING' },
                  confidence: { type: 'NUMBER' }
                },
                required: ['type', 'evidenceSpan', 'confidence']
              }
            },
            geo: {
              type: 'OBJECT',
              properties: {
                lat: { type: 'NUMBER', nullable: true },
                lng: { type: 'NUMBER', nullable: true },
                geohash: { type: 'STRING', nullable: true },
                source: { type: 'STRING', enum: ['map_geocode', 'report_text', 'user_pin', 'unknown'] }
              },
              required: ['source']
            },
            model: {
              type: 'OBJECT',
              properties: {
                provider: { type: 'STRING', enum: ['vertex-ai'] },
                name: { type: 'STRING' },
                version: { type: 'STRING' },
                promptVersion: { type: 'STRING' }
              },
              required: ['provider', 'name', 'version', 'promptVersion']
            }
          },
          required: ['locality', 'needs', 'urgencySignals', 'geo', 'model']
        } as TypeSchema
      }
    });

    const responseText = response.text || '';
    let result: Record<string, unknown>;

    try {
      result = parseJsonResponse(responseText) as Record<string, unknown>;
      
      // Strictly validate with Zod
      const parsedData = extractedSignalSchema.parse(result);
      result = parsedData;
    } catch {
      // On failure write status = FAILED
      await rawReportRef.update({ status: ReportStatus.FAILED }).catch(() => {});
      await commReportRef.update({ status: ReportStatus.FAILED }).catch(() => {});
      
      return NextResponse.json({ success: false, error: 'Failed to parse extraction as JSON' });
    }

    // Write extracted_reports
    const extractedData = {
      ...result,
      reportId,
      processedAt: FieldValue.serverTimestamp()
    };
    await adminDb.collection('extracted_reports').doc(reportId).set(extractedData);

    // Update status to EXTRACTED and append report_events
    await rawReportRef.update({
      status: ReportStatus.EXTRACTED,
      report_events: FieldValue.arrayUnion({ type: 'extraction_completed', timestamp: Date.now() }),
      updatedAt: FieldValue.serverTimestamp()
    }).catch(() => {});

    await commReportRef.update({
      status: ReportStatus.EXTRACTED,
      report_events: FieldValue.arrayUnion({ type: 'extraction_completed', timestamp: Date.now() }),
      updatedAt: FieldValue.serverTimestamp()
    }).catch(() => {});

    return NextResponse.json({ success: true, result, reportId });
  } catch (error) {
    console.error('API /api/ai/extract Error:', error);
    if (reportId) {
      try {
        await adminDb.collection('raw_reports').doc(reportId).update({ status: ReportStatus.FAILED }).catch(() => {});
        await adminDb.collection('community_reports').doc(reportId).update({ status: ReportStatus.FAILED }).catch(() => {});
      } catch {
         // ignore
      }
    }
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}