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
  onSnapshot,
  writeBatch,
  Timestamp,
  QueryConstraint,
  DocumentData,
} from 'firebase/firestore';
import { db } from './config';

// ---- Generic CRUD helpers ----

export async function getDocument<T>(
  collectionName: string,
  docId: string
): Promise<T | null> {
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
 * Real-time listener for a collection
 */
export function subscribeToCollection<T>(
  collectionName: string,
  callback: (data: T[]) => void,
  ...constraints: QueryConstraint[]
): () => void {
  const q = constraints.length > 0
    ? query(collection(db, collectionName), ...constraints)
    : collection(db, collectionName);

  return onSnapshot(q, (snapshot) => {
    const data = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as T));
    callback(data);
  });
}

/**
 * Real-time listener for a single document
 */
export function subscribeToDocument<T>(
  collectionName: string,
  docId: string,
  callback: (data: T | null) => void
): () => void {
  return onSnapshot(doc(db, collectionName, docId), (snapshot) => {
    if (snapshot.exists()) {
      callback({ id: snapshot.id, ...snapshot.data() } as T);
    } else {
      callback(null);
    }
  });
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
