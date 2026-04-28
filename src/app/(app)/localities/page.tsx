'use client';
import PageShell from '@/components/layout/PageShell';
import { MapPin, List, Sparkles, Loader2, RefreshCw } from 'lucide-react';
import { motion } from 'framer-motion';
import { useEffect, useState, useRef, useCallback } from 'react';
import { getCollection, updateDocument } from '@/lib/firebase/firestore';
import { Locality, ExtractedSignal } from '@/types';
import { urgencyBgColor, urgencyColor, formatDate } from '@/lib/utils';
import { loadMapsLibrary, loadMarkerLibrary, loadVisualizationLibrary } from '@/lib/maps/config';
import { computeBaseUrgencyScore, scoreToLevel } from '@/lib/scoring/deterministic';
import toast from 'react-hot-toast';

export default function LocalitiesPage() {
  const [localities, setLocalities] = useState<Locality[]>([]);
  const [selected, setSelected] = useState<Locality | null>(null);
  const [loading, setLoading] = useState(true);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [rescoring, setRescoring] = useState(false);
  const mapRef = useRef<HTMLDivElement>(null);
  const googleMapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.marker.AdvancedMarkerElement[]>([]);

  useEffect(() => {
    getCollection<Locality>('localities').then((data) => {
      const sorted = data.sort((a, b) => b.urgencyScore - a.urgencyScore);
      setLocalities(sorted);
      if (sorted.length > 0) setSelected(sorted[0]);
      setLoading(false);
    });
  }, []);

  const initMap = useCallback(async () => {
    if (!mapRef.current || localities.length === 0 || mapLoaded) return;

    try {
      const { Map } = await loadMapsLibrary();
      const { AdvancedMarkerElement } = await loadMarkerLibrary();

      // Center on India
      const map = new Map(mapRef.current, {
        center: { lat: 22.5, lng: 79 },
        zoom: 5,
        mapId: 'sevasetu_map',
        disableDefaultUI: false,
        zoomControl: true,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: true,
        styles: [
          { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#e9e9e9' }] },
          { featureType: 'landscape', elementType: 'geometry', stylers: [{ color: '#f5f5f5' }] },
        ],
      });

      googleMapRef.current = map;

      // Add markers for each locality
      localities.forEach((loc) => {
        const markerColor = urgencyColor(loc.urgencyLevel);
        const size = loc.urgencyScore > 75 ? 22 : loc.urgencyScore > 55 ? 18 : 14;

        const pinElement = document.createElement('div');
        pinElement.className = 'custom-marker';
        pinElement.innerHTML = `
          <div style="
            width: ${size * 2}px;
            height: ${size * 2}px;
            border-radius: 50%;
            background: ${markerColor}20;
            border: 2px solid ${markerColor};
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            box-shadow: 0 0 ${size}px ${markerColor}30;
          " onmouseover="this.style.transform='scale(1.2)'; this.style.background='${markerColor}40';" onmouseout="this.style.transform='scale(1)'; this.style.background='${markerColor}20';">
            <div style="
              width: ${size}px;
              height: ${size}px;
              border-radius: 50%;
              background: ${markerColor};
              box-shadow: 0 0 10px ${markerColor}60;
            "></div>
          </div>
        `;

        const marker = new AdvancedMarkerElement({
          map,
          position: loc.coordinates,
          content: pinElement,
          title: `${loc.name} (${loc.urgencyLevel})`,
        });

        marker.addListener('click', () => {
          setSelected(loc);
          map.panTo(loc.coordinates);
          map.setZoom(10);
        });

        markersRef.current.push(marker);
      });

      // Enhanced Heatmap
      try {
        const { HeatmapLayer } = await loadVisualizationLibrary();
        const heatmapData = localities.map((loc) => ({
          location: new google.maps.LatLng(loc.coordinates.lat, loc.coordinates.lng),
          weight: loc.urgencyScore,
        }));

        new HeatmapLayer({
          data: heatmapData,
          map,
          radius: 40,
          opacity: 0.6,
          gradient: [
            'rgba(0, 0, 0, 0)',
            'rgba(64, 145, 108, 0.4)',
            'rgba(82, 183, 136, 0.5)',
            'rgba(244, 162, 97, 0.6)',
            'rgba(231, 111, 81, 0.7)',
            'rgba(220, 38, 38, 0.8)',
          ],
        });
      } catch (e) {
        console.warn('Heatmap layer failed:', e);
      }

      setMapLoaded(true);
    } catch (error) {
      console.error('Map initialization error:', error);
    }
  }, [localities, mapLoaded]);

  useEffect(() => {
    if (!loading && localities.length > 0) {
      initMap();
    }
  }, [loading, localities, initMap]);

  // When selected changes, pan map
  useEffect(() => {
    if (googleMapRef.current && selected) {
      googleMapRef.current.panTo(selected.coordinates);
      googleMapRef.current.setZoom(8);
    }
  }, [selected]);

  async function handleRescore(loc: Locality) {
    setRescoring(true);
    try {
      // Step 1: Fetch extracted reports for this locality
      const allReports = await getCollection<ExtractedSignal>('extracted_reports');
      let localityReports = allReports.filter(
        (r) => r.locality.rawName.toLowerCase() === loc.name.toLowerCase()
      );

      // Fallback: if no extracted_reports exist, synthesize from locality's own data
      if (localityReports.length === 0 && loc.issues && loc.issues.length > 0) {
        const { Timestamp: FBTimestamp } = await import('firebase/firestore/lite');
        localityReports = [{
          reportId: 'synthetic',
          locality: { rawName: loc.name, canonicalId: loc.id || null, confidence: 1.0 },
          needs: loc.issues.map(i => ({ taxonomyCode: i, label: i, severity: 3, affectedEstimate: loc.population ? Math.round(loc.population * 0.05) : 100, evidenceSpan: '', confidence: 0.7 })),
          urgencySignals: [],
          geo: { lat: loc.coordinates?.lat || null, lng: loc.coordinates?.lng || null, geohash: null, source: 'unknown' },
          model: { provider: 'vertex-ai', name: 'synthetic', version: '1.0', promptVersion: '1.0' },
          processedAt: FBTimestamp.now(),
        }];
      }

      // Step 2: Compute deterministic base score
      const { score: baseScore, breakdown } = computeBaseUrgencyScore(localityReports, loc);

      // Step 3: Call AI for adjustment + reasoning
      const response = await fetch('/api/ai/score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          localityName: loc.name,
          baseScore,
          breakdown,
          reports: localityReports.map((r) => r.needs.map((n: { label: string }) => n.label).join(', ')).join('; ') || loc.issues?.join(', '),
        }),
      });
      const data = await response.json();

      const aiAdj = data.success ? data.result.adjustment : 0;
      const aiReason = data.success ? data.result.reasoning : 'AI analysis unavailable';
      const finalScore = Math.min(100, Math.max(0, baseScore + aiAdj));

      // Step 4: Update Firestore
      if (loc.id) {
        await updateDocument('localities', loc.id, {
          baseScore,
          urgencyBreakdown: breakdown,
          urgencyScore: finalScore,
          urgencyLevel: scoreToLevel(finalScore),
          aiAdjustment: aiAdj,
          aiReasoning: aiReason,
        });
      }

      // Step 5: Update local state
      const updated = {
        ...loc,
        baseScore,
        urgencyBreakdown: breakdown,
        urgencyScore: finalScore,
        urgencyLevel: scoreToLevel(finalScore),
        aiAdjustment: aiAdj,
        aiReasoning: aiReason,
      };
      setSelected(updated);
      setLocalities((prev) =>
        prev.map((l) => (l.id === loc.id ? updated : l)).sort((a, b) => b.urgencyScore - a.urgencyScore)
      );
      toast.success(`Rescored: ${baseScore} base + ${aiAdj > 0 ? '+' : ''}${aiAdj} AI = ${finalScore}`);
    } catch (error) {
      console.error('Rescore error:', error);
      toast.error('Failed to rescore locality');
    } finally {
      setRescoring(false);
    }
  }

  return (
    <PageShell title="Locality Prioritization" subtitle="Live urgency heatmap with AI reasoning">
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          {/* Live Google Map */}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="card !p-0 overflow-hidden h-[400px] relative rounded-2xl">
            <div ref={mapRef} className="w-full h-full" />
            {!mapLoaded && (
              <div className="absolute inset-0 flex items-center justify-center bg-[#F0EDE8]">
                <div className="flex items-center gap-2 text-[#6B7280]">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span className="text-sm">Loading map...</span>
                </div>
              </div>
            )}
            {/* Map Legend */}
            <div className="absolute bottom-4 left-4 glass rounded-xl p-3 text-xs">
              <p className="font-semibold text-[#1A1A1A] mb-2">Urgency</p>
              <div className="space-y-1">
                {[
                  { label: 'Critical', color: '#DC2626' },
                  { label: 'High', color: '#EA580C' },
                  { label: 'Medium', color: '#D97706' },
                  { label: 'Low', color: '#65A30D' },
                ].map((item) => (
                  <div key={item.label} className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ background: item.color }} />
                    <span className="text-[#6B7280]">{item.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>

          {/* Ranked List */}
          <div className="card !p-0">
            <div className="flex items-center justify-between p-4 border-b border-[#E5E2DC]">
              <div className="flex items-center gap-2">
                <List className="w-4 h-4 text-[#6B7280]" />
                <h3 className="font-semibold text-[#1A1A1A]">Priority Ranking</h3>
              </div>
              <span className="text-xs text-[#6B7280]">{localities.length} localities</span>
            </div>
            <div className="divide-y divide-[#E5E2DC]">
              {loading ? (
                Array(4).fill(0).map((_, i) => (
                  <div key={i} className="p-4"><div className="skeleton h-12" /></div>
                ))
              ) : localities.length === 0 ? (
                <div className="p-8 text-center text-[#6B7280] text-sm">No locality data. Seed from Admin page.</div>
              ) : (
                localities.map((loc, i) => (
                  <motion.button
                    key={loc.id}
                    whileHover={{ x: 4 }}
                    onClick={() => setSelected(loc)}
                    className={`w-full text-left p-4 flex items-center gap-4 transition-colors ${selected?.id === loc.id ? 'bg-primary-pale' : 'hover:bg-[#FAF9F6]'}`}
                  >
                    <span className="text-sm font-bold text-[#6B7280] w-6 text-center">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-[#1A1A1A] truncate">{loc.name}</p>
                      <p className="text-xs text-[#6B7280]">{loc.district}, {loc.state}</p>
                    </div>
                    <span className={`badge ${urgencyBgColor(loc.urgencyLevel)}`}>{loc.urgencyLevel}</span>
                    <div className="text-right w-14">
                      <span className="text-lg font-bold" style={{ color: urgencyColor(loc.urgencyLevel) }}>{loc.urgencyScore}</span>
                    </div>
                  </motion.button>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Urgency Reasoning Panel */}
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }} className="card sticky top-20">
          <h3 className="font-semibold text-[#1A1A1A] mb-4">Urgency Analysis</h3>
          {selected ? (
            <div className="space-y-4">
              <div>
                <p className="text-xl font-bold text-[#1A1A1A]">{selected.name}</p>
                <p className="text-sm text-[#6B7280]">{selected.district}, {selected.state}</p>
              </div>

              <div className="flex items-center gap-3">
                <div className="text-4xl font-extrabold" style={{ color: urgencyColor(selected.urgencyLevel) }}>
                  {selected.urgencyScore}
                </div>
                <div>
                  <span className={`badge ${urgencyBgColor(selected.urgencyLevel)}`}>{selected.urgencyLevel}</span>
                  <p className="text-xs text-[#6B7280] mt-1">out of 100</p>
                </div>
              </div>

              {/* Score Breakdown */}
              <div className="space-y-2.5">
                <p className="text-xs font-bold uppercase tracking-wider text-[#6B7280]">Score Breakdown</p>
                {selected.urgencyBreakdown && Object.entries(selected.urgencyBreakdown).map(([key, val]) => {
                  const maxVal = key === 'serviceGap' ? 15 : key === 'recency' || key === 'repeatComplaints' || key === 'vulnerability' ? 20 : 25;
                  return (
                    <div key={key} className="flex items-center gap-3">
                      <div className="flex-1">
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-[#6B7280] capitalize">{key.replace(/([A-Z])/g, ' $1')}</span>
                          <span className="font-medium text-[#1A1A1A]">{val as number}/{maxVal}</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-[#E5E2DC] overflow-hidden">
                          <motion.div
                            key={`${selected.id}-${key}`}
                            initial={{ width: 0 }}
                            animate={{ width: `${((val as number) / maxVal) * 100}%` }}
                            transition={{ delay: 0.3, duration: 0.8 }}
                            className="h-full rounded-full"
                            style={{ background: urgencyColor(selected.urgencyLevel) }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* AI Reasoning */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-bold uppercase tracking-wider text-[#6B7280]">AI Analysis</p>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => handleRescore(selected)}
                    disabled={rescoring}
                    className="flex items-center gap-1 text-xs text-[#D4622B] font-medium hover:underline disabled:opacity-50"
                  >
                    {rescoring ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                    {rescoring ? 'Analyzing...' : 'Re-analyze'}
                  </motion.button>
                </div>
                {selected.aiReasoning ? (
                  <div className="p-3 rounded-xl bg-[#FAF9F6] border border-[#E5E2DC] text-sm text-[#1A1A1A] leading-relaxed">
                    <Sparkles className="w-4 h-4 text-[#F4A261] inline mr-1.5" />
                    {selected.aiReasoning}
                  </div>
                ) : (
                  <p className="text-xs text-[#6B7280]">Click re-analyze to get AI reasoning for this locality.</p>
                )}
                {selected.aiAdjustment !== 0 && (
                  <p className="text-xs text-[#6B7280] mt-2">
                    AI adjustment: <span className="font-medium text-[#1A1A1A]">{selected.aiAdjustment > 0 ? '+' : ''}{selected.aiAdjustment}</span> points
                  </p>
                )}
              </div>

              {/* Metadata */}
              <div className="text-xs text-[#6B7280] space-y-1 pt-2 border-t border-[#E5E2DC]">
                <p>Population: <span className="font-medium text-[#1A1A1A]">{selected.population?.toLocaleString()}</span></p>
                <p>Total camps: <span className="font-medium text-[#1A1A1A]">{selected.totalCamps}</span></p>
                <p>Last camp: <span className="font-medium text-[#1A1A1A]">{formatDate(selected.lastCampDate)}</span></p>
                <p>Vulnerability: <span className="font-medium text-[#1A1A1A]">{((selected.vulnerabilityIndex || 0) * 100).toFixed(0)}%</span></p>
              </div>

              {/* Issues */}
              {selected.issues && selected.issues.length > 0 && (
                <div className="pt-2">
                  <p className="text-xs font-bold uppercase tracking-wider text-[#6B7280] mb-2">Reported Issues</p>
                  <div className="flex flex-wrap gap-1.5">
                    {selected.issues.map((issue, j) => (
                      <span key={j} className="badge bg-primary-pale text-[#D4622B] border-[#D4622B]/20">{issue}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-12 text-[#6B7280]">
              <MapPin className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Select a locality to view analysis</p>
            </div>
          )}
        </motion.div>
      </div>
    </PageShell>
  );
}
