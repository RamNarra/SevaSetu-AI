import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';
import { ExtractedSignal, ReportStatus } from '@/types';
import { GoogleGenAI } from '@google/genai';
import { parseJsonResponse } from '@/lib/ai/client';
import { calculateUrgencyScore } from '@/lib/scoring/urgency-v2';

const project = process.env.GOOGLE_CLOUD_PROJECT || 'demo-project';
const location = process.env.GOOGLE_CLOUD_LOCATION || 'us-central1';
const MODEL = 'gemini-2.5-flash';
const genai = new GoogleGenAI({
  vertexai: true,
  project,
  location,
});

const EXTRACTION_PROMPT = `You are an AI assistant for SevaSetu AI, an NGO resource allocation platform for community health camps in India.

Analyze the provided field report (which may include text and photos).

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
    "version": "2.5-flash",
    "promptVersion": "1.0"
  }
}

Field Report Data:
`;

export async function POST(request: NextRequest) {
  let reportId: string | undefined;

  try {
    const body = await request.json();
    reportId = body.reportId;
    const text = body.text;
    const imageUrls = body.fileUrls || [];
    const storageUri = body.storageUri;

    if (!reportId) {
      return NextResponse.json({ success: false, error: 'No reportId provided' }, { status: 400 });
    }

    if (!text && imageUrls.length === 0 && !storageUri) {
      return NextResponse.json({ success: false, error: 'No text or images provided' }, { status: 400 });
    }

    const reportRef = adminDb.collection('raw_reports').doc(reportId);
    const outboxRef = adminDb.collection('outbox_events').doc(reportId);

    await outboxRef.set({
      clientEventId: reportId,
      reportId,
      status: 'SYNCING',
      lastAttemptAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    
    // 1. Update status to PROCESSING
    await reportRef.update({
      status: ReportStatus.PROCESSING,
      updatedAt: FieldValue.serverTimestamp()
    });

    const parts: Array<
      | { text: string }
      | { fileData: { fileUri: string; mimeType: string } }
      | { inlineData: { data: string; mimeType: string } }
    > = [
      { text: EXTRACTION_PROMPT + "\n\nText:\n" + (text || "No text provided") }
    ];

    if (storageUri && storageUri.startsWith('gs://')) {
      parts.push({
        fileData: {
          fileUri: storageUri,
          mimeType: 'image/jpeg'
        }
      });
    } else {
      for (const url of imageUrls) {
        if (typeof url === 'string') {
          if (url.startsWith('http')) {
            try {
              const resp = await fetch(url);
              if (resp.ok) {
                const buffer = await resp.arrayBuffer();
                const mimeType = resp.headers.get('content-type') || 'image/jpeg';
                parts.push({
                  inlineData: {
                    data: Buffer.from(buffer).toString('base64'),
                    mimeType
                  }
                });
              }
            } catch (imgErr) {
              console.error("Failed to fetch image:", url, imgErr);
            }
          }
        }
      }
    }

    const response = await genai.models.generateContent({
      model: MODEL,
      contents: [{ role: 'user', parts }],
      config: {
        temperature: 0.2,
        maxOutputTokens: 2048,
        responseMimeType: 'application/json',
      },
    });

    const responseText = response.text || '';

    // Parse JSON from response
    let result: Record<string, unknown>;
    try {
      result = parseJsonResponse(responseText) as Record<string, unknown>;
    } catch {
      await reportRef.update({
        status: ReportStatus.FAILED,
        error: 'Failed to parse AI response as JSON',
        updatedAt: FieldValue.serverTimestamp()
      });
      await outboxRef.set({
        clientEventId: reportId,
        reportId,
        status: 'FAILED',
        errorMessage: 'Failed to parse AI response as JSON',
        lastAttemptAt: FieldValue.serverTimestamp(),
      }, { merge: true });
      
      return NextResponse.json({
        success: false,
        error: 'Failed to parse AI response as JSON',
        raw: responseText,
      });
    }

    // 2. Save Gemini result to extracted_reports collection
    const extractedData = {
      ...result,
      reportId,
      createdAt: FieldValue.serverTimestamp(),
      sourceCollection: 'raw_reports',
      model: {
        provider: "vertex-ai",
        name: MODEL,
        version: "latest",
        promptVersion: "1.0"
      }
    };
    
    await adminDb.collection('extracted_reports').doc(reportId).set(extractedData);

    // 3. Update status to EXTRACTED
    await reportRef.update({
      status: ReportStatus.EXTRACTED,
      updatedAt: FieldValue.serverTimestamp(),
      lastSyncedAt: FieldValue.serverTimestamp(),
    });

    await outboxRef.set({
      clientEventId: reportId,
      reportId,
      status: 'SYNCED',
      lastSyncedAt: FieldValue.serverTimestamp(),
      errorMessage: FieldValue.delete(),
    }, { merge: true });

    // 4. Update locality urgency score
    const localityObj = result.locality as { canonicalId?: string | null } | undefined;
    const localityId = localityObj?.canonicalId && localityObj.canonicalId !== "null" ? localityObj.canonicalId : null;

    if (localityId) {
      try {
        const localityRef = adminDb.collection('localities').doc(localityId);
        const localityDoc = await localityRef.get();
        
        let vulnerabilityIndex = 0.5; // Mock default
        if (localityDoc.exists) {
          const data = localityDoc.data();
          if (data?.vulnerabilityIndex !== undefined) {
             vulnerabilityIndex = data.vulnerabilityIndex;
          }
        }

        // Fetch all extracted reports for this locality
        // For MVP, limit to last 50 reports to avoid heavy reads
        const recentSignalsSnap = await adminDb.collection('extracted_reports')
          .where('locality.canonicalId', '==', localityId)
          .orderBy('createdAt', 'desc')
          .limit(50)
          .get();

        const signals: ExtractedSignal[] = recentSignalsSnap.docs.map((doc) => doc.data() as ExtractedSignal);
        
        const newScore = calculateUrgencyScore(signals, { vulnerabilityIndex });
        
        await localityRef.update({
          urgencyScore: newScore,
          updatedAt: FieldValue.serverTimestamp()
        });
      } catch (scoreErr) {
        console.error("Failed to recompute locality urgency:", scoreErr);
      }
    }

    return NextResponse.json({ success: true, result, reportId });
  } catch (error) {
    console.error('AI extraction error:', error);
    
    if (reportId) {
      try {
        await adminDb.collection('raw_reports').doc(reportId).update({
          status: ReportStatus.FAILED,
          error: String(error),
          updatedAt: FieldValue.serverTimestamp()
        });
        await adminDb.collection('outbox_events').doc(reportId).set({
          clientEventId: reportId,
          reportId,
          status: 'FAILED',
          errorMessage: String(error),
          lastAttemptAt: FieldValue.serverTimestamp(),
        }, { merge: true });
      } catch (dbErr) {
        console.error('Failed to update report status to FAILED:', dbErr);
      }
    }

    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}
