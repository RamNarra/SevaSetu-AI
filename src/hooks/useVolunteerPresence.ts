'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Timestamp } from 'firebase/firestore/lite';
import { addDocument, deleteDocument, getCollection, where } from '@/lib/firebase/firestore';
import { CampPlan, NetworkClass, VolunteerPresence } from '@/types';

const DEFAULT_INTERVAL_MS = 60_000;

interface BatteryManagerLike {
  level: number;
}

interface NetworkInformationLike {
  effectiveType?: NetworkClass;
}

interface NavigatorWithPresence extends Navigator {
  connection?: NetworkInformationLike;
  mozConnection?: NetworkInformationLike;
  webkitConnection?: NetworkInformationLike;
  getBattery?: () => Promise<BatteryManagerLike>;
}

type PresenceStatus = 'idle' | 'paused' | 'locating' | 'syncing' | 'live' | 'unsupported' | 'error';

interface UseVolunteerPresenceOptions {
  uid?: string | null;
  eligible?: boolean;
  intervalMs?: number;
}

interface UseVolunteerPresenceResult {
  trackingEnabled: boolean;
  setTrackingEnabled: (next: boolean) => void;
  status: PresenceStatus;
  error: string | null;
  lastUpdatedAt: number | null;
  snapshot: VolunteerPresence | null;
  syncNow: () => Promise<void>;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

function buildGeohash(lat: number, lng: number) {
  return `${lat.toFixed(3)}:${lng.toFixed(3)}`;
}

function getOptInStorageKey(uid?: string | null) {
  return uid ? `sevasetu_presence_opt_in:${uid}` : 'sevasetu_presence_opt_in';
}

function resolveNetworkClass() {
  if (typeof navigator === 'undefined') {
    return '4g' satisfies NetworkClass;
  }

  if (!navigator.onLine) {
    return 'offline' satisfies NetworkClass;
  }

  const nav = navigator as NavigatorWithPresence;
  const connection = nav.connection ?? nav.mozConnection ?? nav.webkitConnection;
  const effectiveType = connection?.effectiveType;

  if (effectiveType === 'slow-2g' || effectiveType === '2g' || effectiveType === '3g' || effectiveType === '4g') {
    return effectiveType;
  }

  return '4g' satisfies NetworkClass;
}

async function resolveBatteryLevel() {
  if (typeof navigator === 'undefined') {
    return 100;
  }

  const nav = navigator as NavigatorWithPresence;
  if (typeof nav.getBattery !== 'function') {
    return 100;
  }

  try {
    const battery = await nav.getBattery();
    return clamp(Math.round((battery.level ?? 1) * 100), 0, 100);
  } catch {
    return 100;
  }
}

function getCurrentPosition() {
  return new Promise<GeolocationPosition>((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      reject(new Error('Geolocation is unavailable on this device.'));
      return;
    }

    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: false,
      timeout: 15_000,
      maximumAge: 30_000,
    });
  });
}

async function resolveActiveCampId(uid: string) {
  const assignedCamps = await getCollection<CampPlan>('camp_plans', where('assignedStaff', 'array-contains', uid));
  const matchingCamps = assignedCamps.filter((camp) => camp.assignedStaff.includes(uid));

  const activeCamp = matchingCamps.find((camp) => camp.status === 'ACTIVE');
  if (activeCamp?.id) {
    return activeCamp.id;
  }

  return matchingCamps.find((camp) => camp.status === 'PLANNED')?.id ?? null;
}

export function useVolunteerPresence({
  uid,
  eligible = true,
  intervalMs = DEFAULT_INTERVAL_MS,
}: UseVolunteerPresenceOptions): UseVolunteerPresenceResult {
  const [trackingEnabled, setTrackingEnabledState] = useState(false);
  const [status, setStatus] = useState<PresenceStatus>('paused');
  const [error, setError] = useState<string | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<number | null>(null);
  const [snapshot, setSnapshot] = useState<VolunteerPresence | null>(null);

  const storageKey = useMemo(() => getOptInStorageKey(uid), [uid]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const hydrationTimer = window.setTimeout(() => {
      const storedValue = window.localStorage.getItem(storageKey) === 'true';
      setTrackingEnabledState(eligible ? storedValue : false);
      setStatus(eligible ? (storedValue ? 'idle' : 'paused') : 'paused');
    }, 0);

    return () => {
      window.clearTimeout(hydrationTimer);
    };
  }, [eligible, storageKey]);

  const setTrackingEnabled = useCallback(
    (next: boolean) => {
      if (typeof window === 'undefined' || !eligible) {
        setTrackingEnabledState(false);
        setStatus('paused');
        return;
      }

      window.localStorage.setItem(storageKey, String(next));
      setTrackingEnabledState(next);
      setError(null);
      setStatus(next ? 'idle' : 'paused');

      if (!next && uid) {
        setSnapshot(null);
        setLastUpdatedAt(null);
        void deleteDocument('volunteer_presence', uid).catch((deleteError) => {
          console.warn('Failed to clear volunteer presence:', deleteError);
        });
      }
    },
    [eligible, storageKey, uid]
  );

  const syncNow = useCallback(async () => {
    if (!uid || !eligible || !trackingEnabled) {
      return;
    }

    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setStatus('unsupported');
      setError('Geolocation is not available on this device.');
      return;
    }

    try {
      setStatus('locating');
      setError(null);

      const [position, batteryLevel, activeCampId] = await Promise.all([
        getCurrentPosition(),
        resolveBatteryLevel(),
        resolveActiveCampId(uid),
      ]);

      const presence: VolunteerPresence = {
        uid,
        geohash: buildGeohash(position.coords.latitude, position.coords.longitude),
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        lastSeenAt: Timestamp.now(),
        batteryLevel,
        networkClass: resolveNetworkClass(),
        activeCampId,
      };

      setStatus('syncing');
      await addDocument('volunteer_presence', presence, uid);
      setSnapshot(presence);
      setLastUpdatedAt(Date.now());
      setStatus('live');
    } catch (syncError) {
      setStatus('error');
      setError(getErrorMessage(syncError));
    }
  }, [eligible, trackingEnabled, uid]);

  useEffect(() => {
    if (!trackingEnabled || !uid || !eligible) {
      return;
    }

    const initialSyncTimer = window.setTimeout(() => {
      void syncNow();
    }, 0);

    const syncInterval = window.setInterval(() => {
      void syncNow();
    }, intervalMs);

    const handleOnline = () => {
      void syncNow();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void syncNow();
      }
    };

    window.addEventListener('online', handleOnline);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.clearTimeout(initialSyncTimer);
      window.clearInterval(syncInterval);
      window.removeEventListener('online', handleOnline);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [eligible, intervalMs, syncNow, trackingEnabled, uid]);

  return {
    trackingEnabled,
    setTrackingEnabled,
    status,
    error,
    lastUpdatedAt,
    snapshot,
    syncNow,
  };
}
