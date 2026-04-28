'use client';

import { getDoc, setDoc, doc, Timestamp } from 'firebase/firestore/lite';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { auth, db, storage } from '@/lib/firebase/config';
import { ReportStatus, type OutboxEventStatus, type RawReport, type ReportSource } from '@/types';

export interface UploadableReportFile {
  name: string;
  type: string;
  size: number;
  lastModified: number;
  blob: Blob;
}

export interface SubmitRawReportInput {
  clientEventId: string;
  rawText: string;
  submittedBy: string;
  submitterName: string;
  source: ReportSource;
  createdAt: number;
  files?: UploadableReportFile[];
  attempts?: number;
}

export interface SubmitRawReportResult {
  reportId: string;
  fileUrls: string[];
  storageUri: string | null;
  alreadyProcessed: boolean;
}

interface UploadedReportAsset {
  url: string;
  storageUri: string;
}

function sanitizeFileName(fileName: string): string {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

async function upsertOutboxEventStatus(
  input: SubmitRawReportInput,
  status: OutboxEventStatus,
  errorMessage?: string
): Promise<void> {
  const timestamp = Timestamp.now();

  await setDoc(
    doc(db, 'outbox_events', input.clientEventId),
    {
      clientEventId: input.clientEventId,
      reportId: input.clientEventId,
      submittedBy: input.submittedBy,
      submitterName: input.submitterName,
      source: input.source,
      status,
      attempts: input.attempts ?? 0,
      createdAt: Timestamp.fromMillis(input.createdAt),
      lastAttemptAt: timestamp,
      ...(status === 'SYNCED' ? { lastSyncedAt: timestamp } : {}),
      ...(errorMessage ? { errorMessage } : {}),
    },
    { merge: true }
  );
}

async function uploadReportAssets(
  userId: string,
  clientEventId: string,
  files: UploadableReportFile[]
): Promise<UploadedReportAsset[]> {
  const uploads: UploadedReportAsset[] = [];

  for (const file of files) {
    const storageRef = ref(
      storage,
      `raw_reports/${userId}/${clientEventId}/${sanitizeFileName(file.name)}`
    );

    await uploadBytes(storageRef, file.blob, {
      contentType: file.type || 'application/octet-stream',
    });

    uploads.push({
      url: await getDownloadURL(storageRef),
      storageUri: `gs://${storageRef.bucket}/${storageRef.fullPath}`,
    });
  }

  return uploads;
}

export async function submitRawReportToPipeline(
  input: SubmitRawReportInput
): Promise<SubmitRawReportResult> {
  const currentUser = auth.currentUser;

  if (!currentUser) {
    throw new Error('Must be authenticated to submit or sync reports');
  }

  if (currentUser.uid !== input.submittedBy) {
    throw new Error('Signed-in user does not match the queued report owner');
  }

  const reportId = input.clientEventId;
  const reportRef = doc(db, 'raw_reports', reportId);
  const existingSnap = await getDoc(reportRef);
  const existingData = existingSnap.exists()
    ? (existingSnap.data() as Partial<RawReport>)
    : null;

  try {
    await upsertOutboxEventStatus(input, 'SYNCING');

    let fileUrls = existingData?.fileUrls ?? [];
    let storageUri = existingData?.storageUri ?? null;

    if (fileUrls.length === 0 && (input.files?.length ?? 0) > 0) {
      const uploads = await uploadReportAssets(currentUser.uid, input.clientEventId, input.files ?? []);
      fileUrls = uploads.map((upload) => upload.url);
      storageUri = uploads[0]?.storageUri ?? null;
    }

    if (!existingSnap.exists()) {
      await setDoc(reportRef, {
        clientEventId: input.clientEventId,
        submittedBy: input.submittedBy,
        submitterName: input.submitterName,
        rawText: input.rawText.trim(),
        fileUrls,
        storageUri,
        source: input.source,
        status: ReportStatus.RAW,
        createdAt: Timestamp.fromMillis(input.createdAt),
        updatedAt: Timestamp.now(),
        lastSyncedAt: Timestamp.now(),
      });
    } else if (
      (existingData?.fileUrls?.length ?? 0) === 0 &&
      fileUrls.length > 0
    ) {
      await setDoc(
        reportRef,
        {
          fileUrls,
          storageUri,
          updatedAt: Timestamp.now(),
          lastSyncedAt: Timestamp.now(),
        },
        { merge: true }
      );
    }

    // The client stops here by design. In deployed environments, Eventarc or a
    // backend onDocumentCreated trigger observes `raw_reports/{reportId}` and
    // invokes the extraction worker webhook without any client-side fetch.

    await upsertOutboxEventStatus(input, 'SYNCED');

    return {
      reportId,
      fileUrls,
      storageUri,
      alreadyProcessed: existingSnap.exists(),
    };
  } catch (error) {
    await upsertOutboxEventStatus(input, 'FAILED', toErrorMessage(error));
    throw error;
  }
}
