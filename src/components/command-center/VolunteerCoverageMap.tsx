'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Radio } from 'lucide-react';
import { Locality, VolunteerPresence, VolunteerProfile } from '@/types';
import { formatNumber, urgencyColor } from '@/lib/utils';
import { loadMapsLibrary, loadMarkerLibrary } from '@/lib/maps/config';

interface VolunteerCoverageMapProps {
  localities: Locality[];
  presence: VolunteerPresence[];
  volunteerLookup: Map<string, VolunteerProfile>;
}

function isDegradedPresence(volunteerPresence: VolunteerPresence) {
  return (
    volunteerPresence.batteryLevel < 20 ||
    volunteerPresence.networkClass === '2g' ||
    volunteerPresence.networkClass === 'slow-2g' ||
    volunteerPresence.networkClass === 'offline'
  );
}

function getPresenceTone(volunteerPresence: VolunteerPresence) {
  if (volunteerPresence.networkClass === 'offline') {
    return {
      fill: '#fb7185',
      glow: 'rgba(251, 113, 133, 0.28)',
      label: 'Offline',
    };
  }

  if (volunteerPresence.batteryLevel < 20 || volunteerPresence.networkClass === '2g' || volunteerPresence.networkClass === 'slow-2g') {
    return {
      fill: '#fbbf24',
      glow: 'rgba(251, 191, 36, 0.28)',
      label: 'Constrained',
    };
  }

  return {
    fill: '#34d399',
    glow: 'rgba(52, 211, 153, 0.28)',
    label: 'Healthy',
  };
}

function resolveVolunteerName(uid: string, volunteerLookup: Map<string, VolunteerProfile>) {
  return volunteerLookup.get(uid)?.displayName ?? uid;
}

export default function VolunteerCoverageMap({
  localities,
  presence,
  volunteerLookup,
}: VolunteerCoverageMapProps) {
  const mapNodeRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const localityMarkersRef = useRef<google.maps.marker.AdvancedMarkerElement[]>([]);
  const volunteerMarkersRef = useRef<google.maps.marker.AdvancedMarkerElement[]>([]);
  const urgencyCirclesRef = useRef<google.maps.Circle[]>([]);
  const [mapError, setMapError] = useState<string | null>(null);

  const trackedPresence = useMemo(
    () => presence.filter((entry) => Number.isFinite(entry.lat) && Number.isFinite(entry.lng)),
    [presence]
  );
  const degradedCount = trackedPresence.filter(isDegradedPresence).length;
  const healthyCount = trackedPresence.length - degradedCount;
  const averageBattery = trackedPresence.length > 0
    ? Math.round(trackedPresence.reduce((sum, entry) => sum + entry.batteryLevel, 0) / trackedPresence.length)
    : 0;

  useEffect(() => {
    let cancelled = false;

    async function initMap() {
      if (!mapNodeRef.current || mapRef.current) {
        return;
      }

      if (!process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY) {
        setMapError('Google Maps is not configured in this build. Showing fallback coverage telemetry instead.');
        return;
      }

      try {
        const { Map } = await loadMapsLibrary();
        if (cancelled || !mapNodeRef.current) {
          return;
        }

        mapRef.current = new Map(mapNodeRef.current, {
          center: { lat: 22.5, lng: 79 },
          zoom: 5,
          mapId: 'DEMO_MAP_ID',
          mapTypeId: 'hybrid',
          disableDefaultUI: false,
          zoomControl: true,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: true,
        });
        setMapError(null);
      } catch (error) {
        console.error('Coverage map failed to initialize:', error);
        if (!cancelled) {
          setMapError('Map telemetry is unavailable. Showing fallback coverage telemetry instead.');
        }
      }
    }

    void initMap();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function drawMapLayers() {
      if (!mapRef.current) {
        return;
      }

      try {
        const { AdvancedMarkerElement } = await loadMarkerLibrary();
        if (cancelled || !mapRef.current) {
          return;
        }

        localityMarkersRef.current.forEach((marker) => {
          marker.map = null;
        });
        volunteerMarkersRef.current.forEach((marker) => {
          marker.map = null;
        });
        urgencyCirclesRef.current.forEach((circle) => {
          circle.setMap(null);
        });
        localityMarkersRef.current = [];
        volunteerMarkersRef.current = [];
        urgencyCirclesRef.current = [];

        const map = mapRef.current;
        const bounds = new google.maps.LatLngBounds();

        // Draw urgency hotzone circles — one per locality.
        // google.maps.Circle works on vector maps (mapId set); HeatmapLayer does not.
        localities.forEach((locality) => {
          if (!Number.isFinite(locality.coordinates?.lat) || !Number.isFinite(locality.coordinates?.lng)) {
            return;
          }

          const score = Math.min(Math.max(locality.urgencyScore ?? 0, 0), 100);
          // Radius scales with urgency: 20 → ~30km, 80+ → ~90km
          const radiusM = 30000 + score * 700;
          const fillColor = urgencyColor(locality.urgencyLevel);

          const circle = new google.maps.Circle({
            map,
            center: locality.coordinates,
            radius: radiusM,
            fillColor,
            fillOpacity: 0.22 + (score / 100) * 0.28,
            strokeColor: fillColor,
            strokeOpacity: 0.6,
            strokeWeight: 1.5,
            clickable: false,
          });

          urgencyCirclesRef.current.push(circle);
          bounds.extend(locality.coordinates);
        });

        // Locality pin markers on top of the circles
        localities.forEach((locality) => {
          if (!Number.isFinite(locality.coordinates?.lat) || !Number.isFinite(locality.coordinates?.lng)) {
            return;
          }

          const pin = document.createElement('div');
          const accent = urgencyColor(locality.urgencyLevel);
          pin.innerHTML = `
            <div style="
              width: 18px;
              height: 18px;
              border-radius: 999px;
              border: 2px solid rgba(255,255,255,0.85);
              background: ${accent};
              box-shadow: 0 0 16px ${accent}88;
            "></div>
          `;

          const marker = new AdvancedMarkerElement({
            map,
            position: locality.coordinates,
            content: pin,
            title: `${locality.name} • Urgency ${locality.urgencyScore}`,
          });

          localityMarkersRef.current.push(marker);
        });

        trackedPresence.forEach((entry) => {
          const tone = getPresenceTone(entry);
          const volunteerName = resolveVolunteerName(entry.uid, volunteerLookup);
          const markerNode = document.createElement('div');

          markerNode.innerHTML = `
            <div style="position: relative; width: 22px; height: 22px;">
              <div style="
                position: absolute;
                inset: 0;
                border-radius: 999px;
                background: ${tone.glow};
                filter: blur(2px);
              "></div>
              <div style="
                position: absolute;
                inset: 3px;
                border-radius: 999px;
                background: ${tone.fill};
                border: 2px solid rgba(255, 255, 255, 0.95);
                box-shadow: 0 0 12px ${tone.glow};
              "></div>
            </div>
          `;

          const marker = new AdvancedMarkerElement({
            map,
            position: { lat: entry.lat, lng: entry.lng },
            content: markerNode,
            title: `${volunteerName} • ${entry.batteryLevel}% battery • ${entry.networkClass} • ${tone.label}${entry.activeCampId ? ` • Camp ${entry.activeCampId}` : ''}`,
          });

          volunteerMarkersRef.current.push(marker);
          bounds.extend({ lat: entry.lat, lng: entry.lng });
        });

        if (!bounds.isEmpty()) {
          map.fitBounds(bounds, 72);
        }
        setMapError(null);
      } catch (error) {
        console.error('Coverage map layers failed:', error);
        if (!cancelled) {
          setMapError('Volunteer markers could not be rendered on the map. Showing fallback telemetry instead.');
        }
      }
    }

    void drawMapLayers();

    return () => {
      cancelled = true;
    };
  }, [localities, trackedPresence, volunteerLookup]);

  const atRiskResponders = trackedPresence
    .filter(isDegradedPresence)
    .slice(0, 3);
  const fallbackLocalities = localities
    .filter((locality) => Number.isFinite(locality.coordinates?.lat) && Number.isFinite(locality.coordinates?.lng))
    .slice(0, 5);

  return (
    <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-5 md:p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-zinc-500">Volunteer Coverage Map</p>
          <h2 className="mt-2 text-2xl font-semibold text-white">Live presence, heat bands, and field-device risk</h2>
          <p className="mt-1 text-sm text-zinc-400">
            Locality urgency heat is layered with volunteer presence so dispatchers can see coverage holes before assigning staff.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <div className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs font-medium text-emerald-100">
            {healthyCount} healthy signal
          </div>
          <div className="rounded-full border border-amber-300/20 bg-amber-400/10 px-3 py-1 text-xs font-medium text-amber-100">
            {degradedCount} constrained
          </div>
          <div className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs font-medium text-zinc-300">
            Avg battery {averageBattery}%
          </div>
        </div>
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_300px]">
        <div className="overflow-hidden rounded-[24px] border border-white/10 bg-slate-950/90 flex flex-col">
          {mapError ? (
            <div className="relative h-[420px] w-full overflow-hidden">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(52,211,153,0.16),transparent_32%),radial-gradient(circle_at_top_right,rgba(251,191,36,0.14),transparent_24%),linear-gradient(180deg,#020617_0%,#0f172a_100%)]" />
              <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:34px_34px] opacity-40" />
              <div className="relative flex h-full flex-col justify-between p-5">
                <div className="max-w-md rounded-3xl border border-amber-300/20 bg-black/30 p-4 backdrop-blur">
                  <p className="text-sm font-semibold text-amber-50">Fallback coverage mode</p>
                  <p className="mt-2 text-sm leading-6 text-zinc-200">{mapError}</p>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <div className="rounded-3xl border border-white/10 bg-black/25 p-4">
                    <p className="text-xs uppercase tracking-[0.24em] text-zinc-500">Urgency Heat Bands</p>
                    <div className="mt-4 space-y-3">
                      {fallbackLocalities.length === 0 ? (
                        <p className="text-sm text-zinc-400">No localities are available for fallback rendering yet.</p>
                      ) : (
                        fallbackLocalities.map((locality) => (
                          <div key={locality.id ?? locality.name}>
                            <div className="mb-1 flex items-center justify-between gap-3 text-sm text-zinc-200">
                              <span className="truncate">{locality.name}</span>
                              <span>{locality.urgencyScore}</span>
                            </div>
                            <div className="h-2 overflow-hidden rounded-full bg-white/8">
                              <div
                                className="h-full rounded-full"
                                style={{
                                  width: `${Math.max(8, Math.min(locality.urgencyScore, 100))}%`,
                                  backgroundColor: urgencyColor(locality.urgencyLevel),
                                }}
                              />
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  <div className="rounded-3xl border border-white/10 bg-black/25 p-4">
                    <p className="text-xs uppercase tracking-[0.24em] text-zinc-500">Live Field Presence</p>
                    <div className="mt-4 space-y-3">
                      {trackedPresence.length === 0 ? (
                        <p className="text-sm text-zinc-400">No responder presence snapshots are available yet.</p>
                      ) : (
                        trackedPresence.slice(0, 5).map((entry) => {
                          const tone = getPresenceTone(entry);
                          return (
                            <div key={`${entry.uid}-${entry.activeCampId ?? 'reserve'}`} className="rounded-2xl border border-white/8 bg-slate-950/80 p-3">
                              <div className="flex items-center justify-between gap-3">
                                <p className="truncate text-sm font-medium text-white">
                                  {resolveVolunteerName(entry.uid, volunteerLookup)}
                                </p>
                                <span className="text-xs" style={{ color: tone.fill }}>{tone.label}</span>
                              </div>
                              <div className="mt-2 flex items-center justify-between text-xs text-zinc-400">
                                <span>{entry.batteryLevel}% battery</span>
                                <span>{entry.networkClass}</span>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div
              ref={mapNodeRef}
              className="flex-1 min-h-[420px] w-full"
              aria-label="Volunteer coverage map"
            />
          )}

          {mapError && (
            <div className="border-t border-white/10 bg-amber-400/10 px-4 py-3 text-sm text-amber-50">
              {mapError}
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="rounded-3xl border border-white/10 bg-black/20 p-4">
            <p className="text-xs uppercase tracking-[0.24em] text-zinc-500">Coverage Legend</p>
            <div className="mt-4 space-y-3 text-sm text-zinc-200">
              {[
                { color: 'bg-emerald-400', label: 'Healthy field device' },
                { color: 'bg-amber-300', label: 'Battery below 20% or 2G / slow-2G' },
                { color: 'bg-rose-400', label: 'Offline presence risk' },
              ].map((item) => (
                <div key={item.label} className="flex items-center gap-3">
                  <span className={`h-3.5 w-3.5 rounded-full ${item.color}`} />
                  <span>{item.label}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-black/20 p-4">
            <div className="flex items-center gap-2 text-amber-100">
              <AlertTriangle className="h-4 w-4" />
              <p className="text-xs uppercase tracking-[0.24em]">Responder Warnings</p>
            </div>

            {atRiskResponders.length === 0 ? (
              <p className="mt-4 text-sm text-zinc-300">No active device constraints detected in the latest presence snapshot.</p>
            ) : (
              <div className="mt-4 space-y-3">
                {atRiskResponders.map((entry) => {
                  const tone = getPresenceTone(entry);
                  return (
                    <div key={entry.uid} className="rounded-2xl border border-white/8 bg-slate-950/80 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-white">
                            {resolveVolunteerName(entry.uid, volunteerLookup)}
                          </p>
                          <p className="mt-1 text-xs text-zinc-400">
                            {entry.activeCampId ? `Camp ${entry.activeCampId}` : 'Reserve pool'}
                          </p>
                        </div>
                        <div className="rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-1 text-[11px] font-medium text-zinc-200">
                          {tone.label}
                        </div>
                      </div>

                      <div className="mt-3 flex items-center justify-between text-xs text-zinc-400">
                        <span>{entry.batteryLevel}% battery</span>
                        <span>{entry.networkClass}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="rounded-3xl border border-white/10 bg-black/20 p-4">
            <div className="flex items-center gap-2 text-zinc-200">
              <Radio className="h-4 w-4 text-emerald-300" />
              <p className="text-xs uppercase tracking-[0.24em] text-zinc-500">Tracked Responders</p>
            </div>
            <p className="mt-3 text-3xl font-semibold text-white">{formatNumber(trackedPresence.length)}</p>
            <p className="mt-1 text-sm text-zinc-400">
              Latest presence pings currently available to the Command Center.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
