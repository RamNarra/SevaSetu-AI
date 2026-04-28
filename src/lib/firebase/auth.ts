import {
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User,
} from 'firebase/auth';
import { doc, getDoc, setDoc, getDocs, collection, Timestamp } from 'firebase/firestore/lite';
import { auth, db } from './config';
import { UserDoc, UserRole } from '@/types';

const googleProvider = new GoogleAuthProvider();
const PUBLIC_ONBOARDING_ROLES = new Set<UserRole>([
  UserRole.DOCTOR,
  UserRole.PHARMACIST,
  UserRole.FIELD_VOLUNTEER,
  UserRole.SUPPORT,
]);

function isPublicOnboardingRole(role: UserRole): boolean {
  return PUBLIC_ONBOARDING_ROLES.has(role);
}

/**
 * Sign in with Google — tries popup first, falls back to redirect if popup fails.
 */
export async function signInWithGoogle(): Promise<User> {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code;
    // Popup blocked or closed — fall back to redirect
    if (
      code === 'auth/popup-blocked' ||
      code === 'auth/popup-closed-by-user' ||
      code === 'auth/cancelled-popup-request'
    ) {
      await signInWithRedirect(auth, googleProvider);
      // This will redirect; the result is recovered via getRedirectResult below
      throw new Error('Redirecting to Google sign-in...');
    }
    throw err;
  }
}

/**
 * Check for redirect result on page load (when signInWithRedirect was used).
 */
export async function checkRedirectResult(): Promise<User | null> {
  try {
    const result = await getRedirectResult(auth);
    return result?.user || null;
  } catch {
    return null;
  }
}

export async function signOut(): Promise<void> {
  await firebaseSignOut(auth);
}

export function onAuthChange(callback: (user: User | null) => void): () => void {
  return onAuthStateChanged(auth, callback);
}

/**
 * Promise that rejects after a timeout
 */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error('Firestore timeout')), ms)
    ),
  ]);
}

/**
 * Check if user document exists in Firestore
 */
export async function getUserDoc(uid: string): Promise<UserDoc | null> {
  const docRef = doc(db, 'users', uid);
  try {
    const docSnap = await withTimeout(getDoc(docRef), 8000);
    return docSnap.exists() ? (docSnap.data() as UserDoc) : null;
  } catch (err) {
    console.warn('getUserDoc failed:', err instanceof Error ? err.message : err);
    return null;
  }
}

/**
 * Create user document after sign-in.
 */
export async function createUserDoc(
  user: User,
  role?: UserRole
): Promise<UserDoc> {
  const assignedRole = role && isPublicOnboardingRole(role)
    ? role
    : UserRole.FIELD_VOLUNTEER;

  const userDoc: UserDoc = {
    uid: user.uid,
    displayName: user.displayName || 'Anonymous',
    email: user.email || '',
    photoURL: user.photoURL || '',
    role: assignedRole,
    createdAt: Timestamp.now(),
  };

  await withTimeout(setDoc(doc(db, 'users', user.uid), userDoc), 5000);
  return userDoc;
}

/**
 * Update user role
 */
export async function updateUserRole(uid: string, role: UserRole): Promise<void> {
  if (role === UserRole.COORDINATOR) {
    throw new Error('Coordinator role cannot be assigned from the client.');
  }

  await setDoc(doc(db, 'users', uid), { role }, { merge: true });
}
