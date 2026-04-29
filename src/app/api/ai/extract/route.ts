import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';
import { generateContentWithFallback, parseJsonResponse, MODELS } from '@/lib/ai/client';
import { ReportStatus } from '@/types';
import { extractedSignalSchema } from '@/lib/ai/schemas';
import { withAuth } from '@/lib/auth/withAuth';
import { extractRequestSchema } from '@/lib/ai/requestSchemas';
import { recordAiAudit } from '@/lib/ai/audit';
import { embedText, reportSummaryString } from '@/lib/ai/embeddings';
import { encodeGeohash } from '@/lib/maps/geohash';

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

export const POST = withAuth(async (request: NextRequest) => {
  let reportId: string | undefined;
  const t0 = Date.now();

  try {
    const body = await request.json();
    const parsed = extractRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid request', issues: parsed.error.issues },
        { status: 400 }
      );
    }
    reportId = parsed.data.reportId;
    let text = parsed.data.text ?? '';
    let attachments = parsed.data.attachments ?? [];

    const rawReportRef = adminDb.collection('raw_reports').doc(reportId);
    const commReportRef = adminDb.collection('community_reports').doc(reportId);

    // If the caller didn't supply text/attachments (e.g. a retry from the
    // Workbench), hydrate them from the raw_report document.
    if (!text.trim() && attachments.length === 0) {
      const snap = await rawReportRef.get();
      if (!snap.exists) {
        return NextResponse.json(
          { success: false, error: 'raw_report not found' },
          { status: 404 }
        );
      }
      const raw = snap.data() as { rawText?: string; fileUrls?: string[]; storageUri?: string; attachments?: Array<{ storageUri?: string; url?: string; mimeType: string }> };
      text = raw.rawText ?? '';
      if (Array.isArray(raw.attachments) && raw.attachments.length > 0) {
        attachments = raw.attachments as typeof attachments;
      } else if (raw.storageUri) {
        attachments = [{ storageUri: raw.storageUri, mimeType: 'image/jpeg' }];
      }
    }

    await rawReportRef
      .update({
        status: ReportStatus.PROCESSING,
        updatedAt: FieldValue.serverTimestamp(),
      })
      .catch(() => {});

    await commReportRef
      .set(
        {
          status: ReportStatus.PROCESSING,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      )
      .catch(() => {});

    // Build multimodal parts. Gemini accepts either a public file URI or
    // an inlineData base64 payload. We prefer fileData for storageUri, fallback
    // to fetching+inline-encoding if only a public URL is supplied.
    type Part =
      | { text: string }
      | { inlineData: { mimeType: string; data: string } }
      | { fileData: { fileUri: string; mimeType: string } };

    const parts: Part[] = [{ text: EXTRACTION_PROMPT }];
    if (text && text.trim().length > 0) {
      parts.push({ text: 'Field Report Text:\n' + text });
    }

    for (const att of attachments) {
      try {
        if (att.storageUri) {
          parts.push({ fileData: { fileUri: att.storageUri, mimeType: att.mimeType } });
        } else if (att.url) {
          // Best-effort: fetch and inline-encode (works for small images / PDFs)
          const r = await fetch(att.url);
          if (!r.ok) continue;
          const buf = Buffer.from(await r.arrayBuffer());
          if (buf.length > 18 * 1024 * 1024) continue; // ~Gemini 20MB ceiling
          parts.push({
            inlineData: { mimeType: att.mimeType, data: buf.toString('base64') },
          });
        }
      } catch (err) {
        console.warn('[extract] attachment skipped:', err instanceof Error ? err.message : err);
      }
    }

    const multimodal = attachments.length > 0;

    // Do Extraction (with model fallback for quota / 5xx)
    const response = await generateContentWithFallback({
      model: MODELS.extraction,
      contents: [{
        role: 'user',
        parts: parts as unknown as Array<{ text?: string }>,
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
        } as unknown as Record<string, unknown>
      }
    });

    const responseText = response.text || '';
    let result: Record<string, unknown>;
    let zodErrors: string[] | undefined;

    try {
      result = parseJsonResponse(responseText) as Record<string, unknown>;
      const parsedData = extractedSignalSchema.parse(result);
      result = parsedData;
    } catch (validationErr) {
      zodErrors = [validationErr instanceof Error ? validationErr.message : String(validationErr)];
      await rawReportRef.update({ status: ReportStatus.FAILED }).catch(() => {});
      await commReportRef.update({ status: ReportStatus.FAILED }).catch(() => {});
      void recordAiAudit({
        op: 'extract',
        model: MODELS.extraction,
        promptVersion: 'extract.v2.multimodal',
        latencyMs: Date.now() - t0,
        validationPassed: false,
        zodErrors,
        documentId: reportId,
        collection: 'extracted_reports',
      });
      return NextResponse.json({
        success: false,
        error: 'Failed to parse extraction as JSON',
      });
    }

    // Geohash + embedding (best-effort, never blocks the user)
    const geo = (result as { geo?: { lat?: number | null; lng?: number | null } }).geo;
    let geohash: string | null = null;
    if (geo && typeof geo.lat === 'number' && typeof geo.lng === 'number') {
      geohash = encodeGeohash(geo.lat, geo.lng, 6);
    }

    let embedding: number[] | null = null;
    try {
      const summary = reportSummaryString(result as Parameters<typeof reportSummaryString>[0]);
      if (summary) embedding = await embedText(summary);
    } catch {
      embedding = null;
    }

    const extractedData: Record<string, unknown> = {
      ...result,
      reportId,
      processedAt: FieldValue.serverTimestamp(),
      multimodal,
      attachments: attachments.length,
    };
    if (geohash) extractedData.geohash6 = geohash;
    if (embedding) extractedData.embedding = embedding;
    await adminDb.collection('extracted_reports').doc(reportId).set(extractedData);

    void recordAiAudit({
      op: 'extract',
      model: MODELS.extraction,
      promptVersion: 'extract.v2.multimodal',
      latencyMs: Date.now() - t0,
      validationPassed: true,
      documentId: reportId,
      collection: 'extracted_reports',
      notes: multimodal ? `multimodal:${attachments.length}` : 'text',
    });

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
});