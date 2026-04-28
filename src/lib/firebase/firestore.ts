import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  writeBatch,
  Timestamp,
  QueryConstraint,
  DocumentData,
} from 'firebase/firestore/lite';
import { db } from './config';
import { demoDb } from './demo';

// ---- Generic CRUD helpers ----

export async function getDocument<T>(
  collectionName: string,
  docId: string
): Promise<T | null> {
  if (demoDb.isDemoMode()) {
    return demoDb.getDocument<T & { id?: string; uid?: string }>(collectionName, docId);
  }
  const docRef = doc(db, collectionName, docId);
  const docSnap = await getDoc(docRef);
  if (docSnap.exists()) {
    return { id: docSnap.id, ...docSnap.data() } as T;
  }
  return null;
}

export async function getCollection<T>(
  collectionName: string,
  ...constraints: QueryConstraint[]
): Promise<T[]> {
  if (demoDb.isDemoMode()) {
    return demoDb.getCollection<T>(collectionName);
  }
  const q = constraints.length > 0
    ? query(collection(db, collectionName), ...constraints)
    : collection(db, collectionName);
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as T));
}

export async function addDocument(
  collectionName: string,
  data: DocumentData,
  docId?: string
): Promise<string> {
  if (demoDb.isDemoMode()) {
    return docId || Math.random().toString(36).substring(7);
  }
  if (docId) {
    await setDoc(doc(db, collectionName, docId), data);
    return docId;
  }
  const docRef = doc(collection(db, collectionName));
  await setDoc(docRef, data);
  return docRef.id;
}

export async function updateDocument(
  collectionName: string,
  docId: string,
  data: Partial<DocumentData>
): Promise<void> {
  await updateDoc(doc(db, collectionName, docId), data);
}

export async function deleteDocument(
  collectionName: string,
  docId: string
): Promise<void> {
  await deleteDoc(doc(db, collectionName, docId));
}

/**
 * Poll-based collection watcher (replaces real-time onSnapshot).
 * Returns an unsubscribe function to stop polling.
 */
export function subscribeToCollection<T>(
  collectionName: string,
  callback: (data: T[]) => void,
  ...constraints: QueryConstraint[]
): () => void {
  let active = true;

  async function poll() {
    if (!active) return;
    try {
      const data = await getCollection<T>(collectionName, ...constraints);
      if (active) callback(data);
    } catch (err) {
      console.warn(`[Firestore] poll(${collectionName}) error:`, err);
    }
  }

  // Initial fetch
  poll();
  // Poll every 5 seconds
  const interval = setInterval(poll, 5000);

  return () => {
    active = false;
    clearInterval(interval);
  };
}

/**
 * Poll-based document watcher.
 */
export function subscribeToDocument<T>(
  collectionName: string,
  docId: string,
  callback: (data: T | null) => void
): () => void {
  let active = true;

  async function poll() {
    if (!active) return;
    try {
      const data = await getDocument<T>(collectionName, docId);
      if (active) callback(data);
    } catch (err) {
      console.warn(`[Firestore] pollDoc(${collectionName}/${docId}) error:`, err);
    }
  }

  poll();
  const interval = setInterval(poll, 5000);

  return () => {
    active = false;
    clearInterval(interval);
  };
}

/**
 * Batch write for seeding data
 */
export async function batchWrite(
  operations: Array<{
    collection: string;
    docId?: string;
    data: DocumentData;
  }>
): Promise<void> {
  const batch = writeBatch(db);

  for (const op of operations) {
    const docRef = op.docId
      ? doc(db, op.collection, op.docId)
      : doc(collection(db, op.collection));
    batch.set(docRef, op.data);
  }

  await batch.commit();
}

// Re-export useful Firestore utilities
export { collection, doc, query, where, orderBy, limit, Timestamp };
