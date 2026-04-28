import type { ReportSource } from '@/types';

const DB_NAME = 'sevasetu-offline-db';
const DB_VERSION = 1;
const OUTBOX_STORE = 'outbox_events';

export interface OutboxAttachment {
  name: string;
  type: string;
  size: number;
  lastModified: number;
  blob: Blob;
}

export interface OutboxEventPayload {
  rawText: string;
  submittedBy: string;
  submitterName: string;
  source: ReportSource;
  files: OutboxAttachment[];
}

export interface OutboxEventRecord {
  clientEventId: string;
  type: 'raw_report_submission';
  createdAt: number;
  attempts: number;
  lastAttemptAt?: number;
  lastError?: string;
  payload: OutboxEventPayload;
}

export interface QueueReportInput {
  clientEventId?: string;
  rawText: string;
  submittedBy: string;
  submitterName: string;
  source: ReportSource;
  files?: File[];
}

function isIndexedDbSupported(): boolean {
  return typeof window !== 'undefined' && 'indexedDB' in window;
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

function normalizeFiles(files: File[] = []): OutboxAttachment[] {
  return files.map((file) => ({
    name: file.name,
    type: file.type,
    size: file.size,
    lastModified: file.lastModified,
    blob: file,
  }));
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'));
  });
}

function transactionToPromise(transaction: IDBTransaction): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () =>
      reject(transaction.error ?? new Error('IndexedDB transaction failed'));
    transaction.onabort = () =>
      reject(transaction.error ?? new Error('IndexedDB transaction was aborted'));
  });
}

async function openOutboxDb(): Promise<IDBDatabase> {
  if (!isIndexedDbSupported()) {
    throw new Error('IndexedDB is not available in this browser');
  }

  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;

      if (!db.objectStoreNames.contains(OUTBOX_STORE)) {
        const store = db.createObjectStore(OUTBOX_STORE, {
          keyPath: 'clientEventId',
        });
        store.createIndex('createdAt', 'createdAt', { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Failed to open IndexedDB'));
  });
}

export function createClientEventId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `evt_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

export async function queueReportForOffline(input: QueueReportInput): Promise<OutboxEventRecord> {
  const record: OutboxEventRecord = {
    clientEventId: input.clientEventId ?? createClientEventId(),
    type: 'raw_report_submission',
    createdAt: Date.now(),
    attempts: 0,
    payload: {
      rawText: input.rawText,
      submittedBy: input.submittedBy,
      submitterName: input.submitterName,
      source: input.source,
      files: normalizeFiles(input.files),
    },
  };

  const db = await openOutboxDb();
  const transaction = db.transaction(OUTBOX_STORE, 'readwrite');
  const store = transaction.objectStore(OUTBOX_STORE);

  store.put(record);
  await transactionToPromise(transaction);

  return record;
}

export async function listOutboxEvents(): Promise<OutboxEventRecord[]> {
  const db = await openOutboxDb();
  const transaction = db.transaction(OUTBOX_STORE, 'readonly');
  const store = transaction.objectStore(OUTBOX_STORE);
  const result = await requestToPromise(store.getAll());

  await transactionToPromise(transaction);

  return result.sort((left, right) => left.createdAt - right.createdAt);
}

export async function getOutboxEvent(
  clientEventId: string
): Promise<OutboxEventRecord | undefined> {
  const db = await openOutboxDb();
  const transaction = db.transaction(OUTBOX_STORE, 'readonly');
  const store = transaction.objectStore(OUTBOX_STORE);
  const result = await requestToPromise(store.get(clientEventId));

  await transactionToPromise(transaction);

  return result ?? undefined;
}

export async function countOutboxEvents(): Promise<number> {
  const db = await openOutboxDb();
  const transaction = db.transaction(OUTBOX_STORE, 'readonly');
  const store = transaction.objectStore(OUTBOX_STORE);
  const result = await requestToPromise(store.count());

  await transactionToPromise(transaction);

  return result;
}

export async function patchOutboxEvent(
  clientEventId: string,
  patch: Partial<OutboxEventRecord>
): Promise<OutboxEventRecord> {
  const existing = await getOutboxEvent(clientEventId);

  if (!existing) {
    throw new Error(`Outbox event ${clientEventId} was not found`);
  }

  const nextRecord: OutboxEventRecord = {
    ...existing,
    ...patch,
    payload: patch.payload ?? existing.payload,
  };

  const db = await openOutboxDb();
  const transaction = db.transaction(OUTBOX_STORE, 'readwrite');
  const store = transaction.objectStore(OUTBOX_STORE);

  store.put(nextRecord);
  await transactionToPromise(transaction);

  return nextRecord;
}

export async function markOutboxAttempt(
  clientEventId: string,
  error?: unknown
): Promise<OutboxEventRecord> {
  const existing = await getOutboxEvent(clientEventId);

  if (!existing) {
    throw new Error(`Outbox event ${clientEventId} was not found`);
  }

  return patchOutboxEvent(clientEventId, {
    attempts: existing.attempts + 1,
    lastAttemptAt: Date.now(),
    lastError: error ? toErrorMessage(error) : undefined,
  });
}

export async function removeOutboxEvent(clientEventId: string): Promise<void> {
  const db = await openOutboxDb();
  const transaction = db.transaction(OUTBOX_STORE, 'readwrite');
  const store = transaction.objectStore(OUTBOX_STORE);

  store.delete(clientEventId);
  await transactionToPromise(transaction);
}
