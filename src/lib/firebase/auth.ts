import {
  GoogleAuthProvider,
  signInWithPopup,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User,
} from 'firebase/auth';
import { doc, getDoc, setDoc, getDocs, collection, Timestamp } from 'firebase/firestore';
import { auth, db } from './config';
import { UserDoc, UserRole } from '@/types';

const googleProvider = new GoogleAuthProvider();

export async function signInWithGoogle(): Promise<User> {
  const result = await signInWithPopup(auth, googleProvider);
  return result.user;
}

export async function signOut(): Promise<void> {
  await firebaseSignOut(auth);
}

export function onAuthChange(callback: (user: User | null) => void): () => void {
  return onAuthStateChanged(auth, callback);
}

/**
 * Check if user document exists in Firestore
 */
export async function getUserDoc(uid: string): Promise<UserDoc | null> {
  const docRef = doc(db, 'users', uid);
  const docSnap = await getDoc(docRef);
  if (docSnap.exists()) {
    return docSnap.data() as UserDoc;
  }
  return null;
}

/**
 * Create user document after sign-in.
 * First user in the system is auto-assigned COORDINATOR role (bootstrap).
 */
export async function createUserDoc(
  user: User,
  role?: UserRole
): Promise<UserDoc> {
  // Bootstrap: if no users exist, first user becomes COORDINATOR
  let assignedRole = role;
  if (!assignedRole) {
    const usersSnap = await getDocs(collection(db, 'users'));
    assignedRole = usersSnap.empty ? UserRole.COORDINATOR : UserRole.FIELD_VOLUNTEER;
  }

  const userDoc: UserDoc = {
    uid: user.uid,
    displayName: user.displayName || 'Anonymous',
    email: user.email || '',
    photoURL: user.photoURL || '',
    role: assignedRole,
    createdAt: Timestamp.now(),
  };

  await setDoc(doc(db, 'users', user.uid), userDoc);
  return userDoc;
}

/**
 * Update user role
 */
export async function updateUserRole(uid: string, role: UserRole): Promise<void> {
  await setDoc(doc(db, 'users', uid), { role }, { merge: true });
}
