/**
 * SevaSetu AI — API authentication middleware (Firebase ID token verifier).
 *
 * Wraps a Next.js Route Handler so it requires a valid Firebase ID token
 * from the `Authorization: Bearer <token>` header. Verifies via Admin SDK
 * and exposes the decoded claims (uid, role) to the handler.
 *
 * Includes a `withRoles` helper for coordinator-only / pharmacist-only routes.
 *
 * In `?dev=1` mode (NEXT_PUBLIC_AUTH_DEV_BYPASS=true), bypass is allowed —
 * useful only for the local Solution Challenge demo, never in production.
 */

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { getAuth as getAdminAuth } from 'firebase-admin/auth';
import { UserRole } from '@/types';

export interface AuthContext {
  uid: string;
  email?: string;
  role: UserRole | null;
  bypass: boolean;
}

const DEV_BYPASS = process.env.AUTH_DEV_BYPASS === 'true';

export async function verifyRequest(req: NextRequest): Promise<AuthContext | null> {
  const header = req.headers.get('authorization') ?? req.headers.get('Authorization');

  if (!header || !header.toLowerCase().startsWith('bearer ')) {
    if (DEV_BYPASS) {
      return { uid: 'dev-bypass', role: UserRole.COORDINATOR, bypass: true };
    }
    return null;
  }

  const token = header.slice(7).trim();
  if (!token) return null;

  try {
    const decoded = await getAdminAuth().verifyIdToken(token);
    let role: UserRole | null = null;
    try {
      const userSnap = await adminDb.collection('users').doc(decoded.uid).get();
      if (userSnap.exists) {
        role = (userSnap.data()?.role as UserRole) ?? null;
      }
    } catch {
      role = null;
    }
    return { uid: decoded.uid, email: decoded.email, role, bypass: false };
  } catch (err) {
    console.warn('[withAuth] verifyIdToken failed:', err instanceof Error ? err.message : err);
    return null;
  }
}

type Handler<T> = (req: NextRequest, ctx: AuthContext) => Promise<T>;

/** Wrap a handler so it requires a valid Firebase ID token. */
export function withAuth<T extends NextResponse | Response>(handler: Handler<T>) {
  return async (req: NextRequest): Promise<T | NextResponse> => {
    const auth = await verifyRequest(req);
    if (!auth) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized — Firebase ID token required' },
        { status: 401 }
      );
    }
    return handler(req, auth);
  };
}

/** Wrap a handler with both auth and a role allowlist. */
export function withRoles<T extends NextResponse | Response>(
  allowed: UserRole[],
  handler: Handler<T>
) {
  return async (req: NextRequest): Promise<T | NextResponse> => {
    const auth = await verifyRequest(req);
    if (!auth) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }
    if (!auth.bypass && (!auth.role || !allowed.includes(auth.role))) {
      return NextResponse.json(
        { success: false, error: `Forbidden — role ${auth.role ?? 'none'} not in allowlist` },
        { status: 403 }
      );
    }
    return handler(req, auth);
  };
}
