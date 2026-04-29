import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';

/**
 * Lightweight in-process job dispatcher.
 *
 * Endpoint accepts a `{ type, payload }` envelope and writes to the `jobs`
 * collection so an async worker (Cloud Functions / Cloud Tasks /
 * Eventarc) can pick it up. Until that worker is provisioned, this
 * endpoint can also dispatch synchronously by calling the matching
 * Next.js route handler.
 *
 * Supported job types:
 *   - 'extract'         → /api/ai/extract
 *   - 'recommend'       → /api/allocation/recommend
 *   - 'recompute'       → /api/scoring/recompute
 *
 * The same envelope is what an Eventarc Pub/Sub trigger would push.
 */

type SupportedJob = 'extract' | 'recommend' | 'recompute';

const ROUTE_MAP: Record<SupportedJob, string> = {
  extract: '/api/ai/extract',
  recommend: '/api/allocation/recommend',
  recompute: '/api/scoring/recompute',
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const type = (body?.type ?? '') as SupportedJob;
    const payload = body?.payload ?? {};
    const sync = body?.sync === true;

    if (!type || !(type in ROUTE_MAP)) {
      return NextResponse.json(
        { success: false, error: `Unknown job type: ${type}. Allowed: ${Object.keys(ROUTE_MAP).join(', ')}` },
        { status: 400 }
      );
    }

    // Persist the job for traceability (acts as a stand-in for Cloud Tasks).
    const jobRef = await adminDb.collection('jobs').add({
      type,
      payload,
      status: sync ? 'RUNNING' : 'QUEUED',
      mode: sync ? 'SYNC' : 'ASYNC',
      createdAt: FieldValue.serverTimestamp(),
    });

    if (!sync) {
      return NextResponse.json({
        success: true,
        jobId: jobRef.id,
        status: 'QUEUED',
        note: 'Picked up by jobs collection — provision a Cloud Function listener to drain.',
      });
    }

    // Best-effort sync dispatch via internal HTTP.
    const origin = req.nextUrl.origin;
    const target = origin + ROUTE_MAP[type];

    const auth = req.headers.get('authorization');
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (auth) headers['Authorization'] = auth;

    const t0 = Date.now();
    let resultJson: unknown = null;
    let ok = false;
    try {
      const res = await fetch(target, { method: 'POST', headers, body: JSON.stringify(payload) });
      ok = res.ok;
      resultJson = await res.json().catch(() => null);
    } catch (err) {
      ok = false;
      resultJson = { error: err instanceof Error ? err.message : String(err) };
    }

    await jobRef.update({
      status: ok ? 'COMPLETED' : 'FAILED',
      latencyMs: Date.now() - t0,
      result: resultJson,
      finishedAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({
      success: ok,
      jobId: jobRef.id,
      result: resultJson,
    });
  } catch (error) {
    console.error('Job dispatch failed:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
