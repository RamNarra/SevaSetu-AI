/**
 * authFetch — client-side fetch wrapper that automatically attaches the
 * current Firebase user's ID token as a Bearer authorization header.
 *
 * Every protected API route (anything under /api/allocation, /api/operations,
 * /api/matching, /api/scoring, /api/workbench, /api/ai/*) runs through
 * `withAuth` / `withRoles` on the server, which expects this header.
 *
 * In dev we honor `NEXT_PUBLIC_AUTH_DEV_BYPASS=true` to skip the token and
 * let the matching server flag (`AUTH_DEV_BYPASS=true`) accept the call.
 */

import { auth } from './config';

const DEV_BYPASS =
  typeof process !== 'undefined' &&
  process.env.NEXT_PUBLIC_AUTH_DEV_BYPASS === 'true';

export async function getIdToken(forceRefresh = false): Promise<string | null> {
  if (DEV_BYPASS) return null;
  try {
    const user = auth.currentUser;
    if (!user) return null;
    return await user.getIdToken(forceRefresh);
  } catch (err) {
    console.warn('[authFetch] getIdToken failed:', err);
    return null;
  }
}

export async function authFetch(
  input: RequestInfo | URL,
  init: RequestInit = {}
): Promise<Response> {
  const headers = new Headers(init.headers || {});
  if (!headers.has('Content-Type') && init.body && typeof init.body === 'string') {
    headers.set('Content-Type', 'application/json');
  }

  const token = await getIdToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);

  return fetch(input, { ...init, headers });
}

/** Convenience: POST JSON. */
export async function authPostJson<T = unknown>(
  url: string,
  body: unknown
): Promise<T> {
  const res = await authFetch(url, {
    method: 'POST',
    body: JSON.stringify(body ?? {}),
  });
  const text = await res.text();
  let json: unknown;
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`[authPostJson] Non-JSON response from ${url}: ${text.slice(0, 200)}`);
  }
  if (!res.ok) {
    const errMsg =
      (json as { error?: string })?.error || `${res.status} ${res.statusText}`;
    const e = new Error(errMsg) as Error & { status?: number; payload?: unknown };
    e.status = res.status;
    e.payload = json;
    throw e;
  }
  return json as T;
}
