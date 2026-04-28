'use client';

import { useCallback, useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import { useAuth } from '@/contexts/AuthContext';
import {
  listOutboxEvents,
  markOutboxAttempt,
  patchOutboxEvent,
  removeOutboxEvent,
} from '@/lib/offline/outbox';
import { submitRawReportToPipeline } from '@/lib/reports/pipeline';

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

export default function OfflineSync() {
  const { user } = useAuth();
  const isSyncingRef = useRef(false);

  const replayOutbox = useCallback(async () => {
    if (isSyncingRef.current || !user || typeof navigator === 'undefined' || !navigator.onLine) {
      return;
    }

    isSyncingRef.current = true;

    try {
      const queuedEvents = await listOutboxEvents();
      const userEvents = queuedEvents.filter(
        (event) => event.payload.submittedBy === user.uid
      );

      if (userEvents.length === 0) {
        return;
      }

      let syncedCount = 0;

      for (const event of userEvents) {
        try {
          const attemptedEvent = await markOutboxAttempt(event.clientEventId);

          await patchOutboxEvent(event.clientEventId, {
            lastError: undefined,
          });

          await submitRawReportToPipeline({
            clientEventId: event.clientEventId,
            rawText: event.payload.rawText,
            submittedBy: event.payload.submittedBy,
            submitterName: event.payload.submitterName,
            source: event.payload.source,
            createdAt: event.createdAt,
            attempts: attemptedEvent.attempts,
            files: event.payload.files,
          });

          await removeOutboxEvent(event.clientEventId);
          syncedCount += 1;
        } catch (error) {
          await patchOutboxEvent(event.clientEventId, {
            lastError: toErrorMessage(error),
          });

          break;
        }
      }

      if (syncedCount > 0) {
        toast.success(
          syncedCount === 1
            ? '1 offline report synced successfully.'
            : `${syncedCount} offline reports synced successfully.`
        );
      }
    } catch (error) {
      console.error('Offline sync failed:', error);
    } finally {
      isSyncingRef.current = false;
    }
  }, [user]);

  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      return;
    }

    navigator.serviceWorker
      .register('/sw.js', {
        scope: '/',
        updateViaCache: 'none',
      })
      .catch((error) => {
        console.error('Service worker registration failed:', error);
      });
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const handleOnline = () => {
      void replayOutbox();
    };

    window.addEventListener('online', handleOnline);

    if (navigator.onLine) {
      void replayOutbox();
    }

    return () => {
      window.removeEventListener('online', handleOnline);
    };
  }, [replayOutbox]);

  return null;
}
