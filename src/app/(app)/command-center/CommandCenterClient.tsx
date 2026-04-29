'use client';

import type { ElementType } from 'react';
import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Loader2,
  RefreshCw,
  Shield,
  Sparkles,
  Users,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { CampPlan, ExtractedSignal, Locality, VolunteerPresence, VolunteerProfile } from '@/types';
import { analyzeUrgencyScore, type UrgencyV2Breakdown } from '@/lib/scoring/urgency-v2';
import { cn, formatNumber, roleLabel, urgencyColor } from '@/lib/utils';
import { getCollection, orderBy } from '@/lib/firebase/firestore';
import { authFetch } from '@/lib/firebase/authFetch';
import VolunteerCoverageMap from '@/components/command-center/VolunteerCoverageMap';

interface SimulationCandidate {
  volunteerId: string;
  displayName: string;
  role: VolunteerProfile['role'];
  matchScore: number;
  explanation: string;
  coordinates?: { lat: number; lng: number };
}

interface FatigueMeta {
  score: number;
  estimated: boolean;
}

interface CommandCenterZone {
  locality: Locality;
  reports: ExtractedSignal[];
  urgencyV2: UrgencyV2Breakdown;
  averageConfidence: number;
  primaryReportId: string | null;
  primarySignal: string | null;
}

interface SimulationState {
  zone: CommandCenterZone;
  reportId: string;
  loading: boolean;
  error: string | null;
  candidates: SimulationCandidate[];
}

const urgencySignalWeights: Record<string, number> = {
  death: 40,
  hospitalization: 26,
  outbreak: 22,
  supply_stockout: 14,
  access_blocked: 12,
  vulnerable_group: 10,
};

async function fetchCommandCenterData() {
  const [localities, reports, volunteers, camps, presence] = await Promise.all([
    getCollection<Locality>('localities', orderBy('urgencyScore', 'desc')),
    getCollection<ExtractedSignal & { status?: string }>('extracted_reports'),
    getCollection<VolunteerProfile>('volunteer_profiles'),
    getCollection<CampPlan>('camp_plans'),
    getCollection<VolunteerPresence>('volunteer_presence', orderBy('lastSeenAt', 'desc')),
  ]);

  return {
    localities: [...localities].sort((a, b) => b.urgencyScore - a.urgencyScore),
    // Include APPROVED (production-promoted) AND seeded/EXTRACTED entries
    // that lack an explicit status. This keeps the demo populated while still
    // hiding HUMAN_REJECTED / FAILED ones.
    reports: reports.filter(r => {
      const s = r.status;
      return !s || s === 'APPROVED' || s === 'EXTRACTED' || s === 'HUMAN_APPROVED';
    }),
    volunteers,
    camps,
    presence,
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function toMillis(value: unknown): number {
  if (value && typeof value === 'object' && 'toMillis' in value) {
    const toMillisFn = (value as { toMillis?: () => number }).toMillis;
    if (typeof toMillisFn === 'function') {
      return toMillisFn();
    }
  }

  if (value instanceof Date) {
    return value.getTime();
  }

  const parsed = value ? new Date(value as string).getTime() : NaN;
  return Number.isFinite(parsed) ? parsed : 0;
}

function titleize(value: string) {
  return value
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
    .join(' ');
}

function resolveLocalityReports(locality: Locality, reports: ExtractedSignal[]) {
  const localityId = locality.id?.toLowerCase();
  const localityName = locality.name.toLowerCase();

  return reports.filter((report) => {
    const canonicalId = report.locality?.canonicalId?.toLowerCase();
    const rawName = report.locality?.rawName?.toLowerCase();
    return canonicalId === localityId || rawName === localityName;
  });
}

function rankReportForSimulation(report: ExtractedSignal) {
  const urgencyWeight = report.urgencySignals.reduce((sum, signal) => {
    return sum + (urgencySignalWeights[signal.type] ?? 8) * (signal.confidence ?? 0.5);
  }, 0);

  const needWeight = report.needs.reduce((sum, need) => {
    const impact = clamp(need.affectedEstimate / 30, 1, 8);
    return sum + need.severity * impact * (need.confidence ?? 0.5);
  }, 0);

  const localityConfidence = (report.locality?.confidence ?? 0.5) * 10;
  const freshnessBoost = toMillis(report.createdAt) > 0
    ? clamp((Date.now() - toMillis(report.createdAt)) / (1000 * 60 * 60 * 24), 0, 14)
    : 7;

  return urgencyWeight + needWeight + localityConfidence + (14 - freshnessBoost);
}

function resolvePrimarySignal(report: ExtractedSignal | undefined) {
  if (!report) return null;
  if (report.urgencySignals.length > 0) {
    const topUrgencySignal = [...report.urgencySignals].sort(
      (left, right) => (right.confidence ?? 0.5) - (left.confidence ?? 0.5)
    )[0];
    return titleize(topUrgencySignal.type);
  }

  if (report.needs.length > 0) {
    return report.needs[0].label;
  }

  return 'General Field Need';
}

function buildZone(locality: Locality, reports: ExtractedSignal[]): CommandCenterZone {
  const localityReports = resolveLocalityReports(locality, reports);
  const urgencyV2 = analyzeUrgencyScore(localityReports, {
    vulnerabilityIndex: locality.vulnerabilityIndex,
    lastCampDate: locality.lastCampDate?.toDate?.(),
  });

  const averageConfidence = localityReports.length > 0
    ? localityReports.reduce((sum, report) => sum + (report.locality?.confidence ?? 0.5), 0) / localityReports.length
    : urgencyV2.averageConfidence;

  const primaryReport = [...localityReports].sort((left, right) => {
    return rankReportForSimulation(right) - rankReportForSimulation(left);
  })[0];

  return {
    locality,
    reports: localityReports,
    urgencyV2,
    averageConfidence,
    primaryReportId: primaryReport?.reportId ?? null,
    primarySignal: resolvePrimarySignal(primaryReport),
  };
}

function getFatigueMeta(volunteer: VolunteerProfile): FatigueMeta {
  if (typeof volunteer.fatigueScore === 'number') {
    return { score: clamp(Math.round(volunteer.fatigueScore), 0, 100), estimated: false };
  }

  let score = 34 + volunteer.completedCamps * 1.4;

  if (volunteer.availability === 'BUSY') score += 18;
  if (volunteer.availability === 'ON_LEAVE') score -= 8;
  if (volunteer.rating < 4.4) score += 4;

  const lastAssignedMs = toMillis(volunteer.lastAssigned);
  if (lastAssignedMs > 0) {
    const hoursSinceAssignment = (Date.now() - lastAssignedMs) / (1000 * 60 * 60);
    if (hoursSinceAssignment < 24) score += 18;
    else if (hoursSinceAssignment < 72) score += 10;
    else if (hoursSinceAssignment < 168) score += 5;
  }

  return {
    score: clamp(Math.round(score), 28, 92),
    estimated: true,
  };
}

function fatigueTone(score: number) {
  if (score >= 80) {
    return {
      chip: 'border-red-400/30 bg-red-500/10 text-red-200',
      bar: 'bg-red-400',
      label: 'Critical load',
    };
  }

  if (score >= 60) {
    return {
      chip: 'border-amber-400/30 bg-amber-500/10 text-amber-100',
      bar: 'bg-amber-300',
      label: 'Watch load',
    };
  }

  return {
    chip: 'border-emerald-400/30 bg-emerald-500/10 text-emerald-100',
    bar: 'bg-emerald-300',
    label: 'Reserve ready',
  };
}

function ExplainabilityMeter({ zone }: { zone: CommandCenterZone }) {
  const medicalWidth = `${zone.urgencyV2.medicalSeverity}%`;
  const recurrenceWidth = `${zone.urgencyV2.velocityRecurrence}%`;
  const confidencePenaltyWidth = `${Math.min(zone.urgencyV2.confidencePenalty, 100)}%`;
  const structuralContribution = Math.max(
    0,
    zone.urgencyV2.rawScore - zone.urgencyV2.medicalSeverity - zone.urgencyV2.velocityRecurrence
  );
  const structuralWidth = `${Math.min(structuralContribution, 100)}%`;
  const neutralWidth = `${Math.max(0, 100 - zone.urgencyV2.rawScore)}%`;

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <div className="mb-3 flex items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-zinc-400">Explainable Feature Bar</p>
          <p className="mt-1 text-sm text-zinc-300">
            Urgency V2 contributions with recurrence and confidence penalties visible to the judges.
          </p>
        </div>
        <div className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs font-semibold text-emerald-100">
          AI Confidence {Math.round(zone.averageConfidence * 100)}%
        </div>
      </div>

      <div className="overflow-hidden rounded-full border border-white/8 bg-zinc-950/80">
        <div className="flex h-3.5 w-full">
          <div className="bg-rose-400/90" style={{ width: medicalWidth }} />
          <div className="bg-amber-300/90" style={{ width: recurrenceWidth }} />
          <div className="bg-emerald-300/85" style={{ width: structuralWidth }} />
          <div className="bg-transparent" style={{ width: neutralWidth }} />
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <div className="rounded-full border border-rose-400/25 bg-rose-500/10 px-3 py-1 text-xs font-medium text-rose-100">
          Medical Severity (+{Math.round(zone.urgencyV2.medicalSeverity)})
        </div>
        <div className="rounded-full border border-amber-300/25 bg-amber-400/10 px-3 py-1 text-xs font-medium text-amber-50">
          Recurrence (+{Math.round(zone.urgencyV2.velocityRecurrence)})
        </div>
        <div className="rounded-full border border-rose-300/25 bg-rose-400/10 px-3 py-1 text-xs font-medium text-rose-50">
          AI Confidence Penalty (-{Math.round(zone.urgencyV2.confidencePenalty)})
        </div>
      </div>

      <div className="mt-3 rounded-2xl border border-white/8 bg-zinc-950/80 p-3">
        <div className="mb-2 flex items-center justify-between text-xs text-zinc-400">
          <span>Score compression from confidence weighting</span>
          <span>{zone.urgencyV2.finalScore}/100 final</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-white/6">
          <div className="h-full rounded-full bg-gradient-to-r from-rose-400 via-amber-300 to-emerald-300" style={{ width: `${zone.urgencyV2.rawScore}%` }} />
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/6">
          <div className="h-full rounded-full bg-gradient-to-r from-rose-400 to-rose-300" style={{ width: confidencePenaltyWidth }} />
        </div>
        <div className="mt-3 flex flex-wrap gap-3 text-xs text-zinc-400">
          <span>Age decay {zone.urgencyV2.ageDecay.toFixed(1)}/15</span>
          <span>Geo vulnerability {zone.urgencyV2.geospatialVulnerability.toFixed(1)}/15</span>
          <span>Base reserve {zone.urgencyV2.baseReserve}/10</span>
        </div>
      </div>
    </div>
  );
}

function HudCard({
  icon: Icon,
  label,
  value,
  caption,
  accent,
}: {
  icon: ElementType;
  label: string;
  value: string;
  caption: string;
  accent: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04] p-5"
    >
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-24 opacity-90"
        style={{ background: accent }}
      />
      <div className="relative flex items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-zinc-400">{label}</p>
          <p className="mt-3 text-3xl font-semibold text-white">{value}</p>
          <p className="mt-2 text-sm text-zinc-300">{caption}</p>
        </div>
        <div className="rounded-2xl border border-white/12 bg-black/20 p-3 text-white/90">
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </motion.div>
  );
}

export default function CommandCenterClient() {
  const [localities, setLocalities] = useState<Locality[]>([]);
  const [reports, setReports] = useState<ExtractedSignal[]>([]);
  const [volunteers, setVolunteers] = useState<VolunteerProfile[]>([]);
  const [camps, setCamps] = useState<CampPlan[]>([]);
  const [presence, setPresence] = useState<VolunteerPresence[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [simulation, setSimulation] = useState<SimulationState | null>(null);
  const [simulatingLocalityId, setSimulatingLocalityId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const data = await fetchCommandCenterData();
        if (cancelled) return;
        setLocalities(data.localities);
        setReports(data.reports);
        setVolunteers(data.volunteers);
        setCamps(data.camps);
        setPresence(data.presence);
      } catch (error) {
        console.error('Command Center load error:', error);
        if (!cancelled) {
          toast.error('Unable to load Command Center telemetry.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  async function handleRefresh() {
    setRefreshing(true);
    try {
      const data = await fetchCommandCenterData();
      setLocalities(data.localities);
      setReports(data.reports);
      setVolunteers(data.volunteers);
      setCamps(data.camps);
      setPresence(data.presence);
      toast.success('Operational telemetry refreshed.');
    } catch (error) {
      console.error('Command Center refresh error:', error);
      toast.error('Refresh failed. Using the last successful snapshot.');
    } finally {
      setRefreshing(false);
    }
  }

  async function handleSimulateStaffing(zone: CommandCenterZone) {
    if (!zone.primaryReportId) {
      toast.error('No extracted report is linked to this locality yet.');
      return;
    }

    setSimulatingLocalityId(zone.locality.id ?? zone.locality.name);
    setSimulation({
      zone,
      reportId: zone.primaryReportId,
      loading: true,
      error: null,
      candidates: [],
    });

    try {
      const response = await authFetch('/api/matching/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reportId: zone.primaryReportId }),
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Simulation request failed.');
      }

      setSimulation({
        zone,
        reportId: zone.primaryReportId,
        loading: false,
        error: null,
        candidates: Array.isArray(data.candidates) ? data.candidates : [],
      });

      toast.success(`Top ${Array.isArray(data.candidates) ? data.candidates.length : 0} responders ranked.`);
    } catch (error) {
      console.error('Simulation error:', error);
      const message = error instanceof Error ? error.message : 'Simulation failed.';
      setSimulation({
        zone,
        reportId: zone.primaryReportId,
        loading: false,
        error: message,
        candidates: [],
      });
      toast.error(message);
    } finally {
      setSimulatingLocalityId(null);
    }
  }

  async function handleDispatch(zone: CommandCenterZone, candidate: SimulationCandidate) {
    if (!zone.locality.id || !candidate.volunteerId) {
      toast.error('Missing ID for dispatch');
      return;
    }

    try {
      const res = await authFetch('/api/matching/dispatch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          volunteerId: candidate.volunteerId,
          campId: zone.locality.id, // Or a specific active camp ID if the zone maps to one, we'll use localityId as fallback
          role: candidate.role,
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to dispatch');
      }

      toast.success(`Dispatch successful! ${candidate.displayName} is assigned.`);
      
      // Optionally, we could remove the candidate from simulation state locally here
    } catch (err) {
      console.error('Dispatch transaction failed', err);
      const errorMessage = err instanceof Error ? err.message : 'Error occurred during dispatch';
      toast.error(errorMessage);
    }
  }

  const zones = localities.slice(0, 3).map((locality) => buildZone(locality, reports));
  const highRiskZones = localities.filter(
    (locality) => locality.urgencyLevel === 'CRITICAL' || locality.urgencyLevel === 'HIGH'
  ).length;

  const deployedVolunteerIds = new Set(
    camps
      .filter((camp) => camp.status === 'ACTIVE' || camp.status === 'PLANNED')
      .flatMap((camp) => camp.assignedStaff)
  );

  const volunteerLookup = new Map(volunteers.map((volunteer) => [volunteer.userId || volunteer.id || '', volunteer]));
  const trackedResponders = presence.filter((entry) => Number.isFinite(entry.lat) && Number.isFinite(entry.lng));
  const degradedResponders = trackedResponders.filter((entry) => (
    entry.batteryLevel < 20 ||
    entry.networkClass === '2g' ||
    entry.networkClass === 'slow-2g' ||
    entry.networkClass === 'offline'
  ));
  const reserveRoster = volunteers
    .map((volunteer) => ({ volunteer, fatigue: getFatigueMeta(volunteer) }))
    .filter(({ volunteer }) => volunteer.availability === 'AVAILABLE')
    .sort((left, right) => left.fatigue.score - right.fatigue.score);

  const availableReserve = reserveRoster.filter(({ fatigue }) => fatigue.score < 80).length;
  const averageConfidence = zones.length > 0
    ? zones.reduce((sum, zone) => sum + zone.averageConfidence, 0) / zones.length
    : 0;

  if (loading) {
    return (
      <div className="p-6">
        <div className="overflow-hidden rounded-[32px] border border-slate-800 bg-slate-950 p-6 text-slate-100 shadow-2xl shadow-slate-950/40">
          <div className="grid gap-4 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="h-36 animate-pulse rounded-3xl border border-white/6 bg-white/[0.04]" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="p-6">
        <section
          className="relative overflow-hidden rounded-[32px] border border-slate-800 bg-slate-950 text-slate-100 shadow-2xl shadow-slate-950/40"
          style={{
            backgroundImage:
              'radial-gradient(circle at top left, rgba(52, 211, 153, 0.16), transparent 28%), radial-gradient(circle at top right, rgba(251, 113, 133, 0.14), transparent 25%), radial-gradient(circle at bottom center, rgba(251, 191, 36, 0.12), transparent 30%), linear-gradient(180deg, #020617 0%, #09090B 52%, #111827 100%)',
          }}
        >
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:32px_32px] opacity-30" />

          <div className="relative p-6 md:p-8">
            <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
              <div className="max-w-3xl">
                <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-emerald-100">
                  <Sparkles className="h-3.5 w-3.5" />
                  Predictive Command Center
                </div>
                <h1 className="mt-4 text-3xl font-semibold tracking-tight text-white md:text-4xl">
                  Operations Center for urgency, fatigue, and confidence-aware deployment.
                </h1>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-300 md:text-base">
                  Judges can now see Urgency V2 reasoning, reserve staff readiness, and the live volunteer
                  explanations produced by the matching engine before dispatch.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <div className="rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3">
                  <p className="text-[11px] uppercase tracking-[0.24em] text-zinc-500">Telemetry Integrity</p>
                  <p className="mt-1 text-lg font-semibold text-white">{Math.round(averageConfidence * 100)}%</p>
                  <p className="text-xs text-zinc-400">Avg. AI confidence across urgent zones</p>
                </div>
                <button
                  type="button"
                  onClick={handleRefresh}
                  disabled={refreshing}
                  className="inline-flex items-center gap-2 rounded-2xl border border-white/12 bg-white/[0.05] px-4 py-3 text-sm font-medium text-white transition hover:border-amber-300/30 hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                  Refresh telemetry
                </button>
              </div>
            </div>

            <div className="mt-8 grid gap-4 xl:grid-cols-3">
              <HudCard
                icon={AlertTriangle}
                label="Active High-Risk Zones"
                value={String(highRiskZones)}
                caption="Localities currently scoring HIGH or CRITICAL urgency."
                accent="linear-gradient(180deg, rgba(248, 113, 113, 0.18) 0%, rgba(248, 113, 113, 0) 100%)"
              />
              <HudCard
                icon={Users}
                label="Volunteers Deployed"
                value={String(deployedVolunteerIds.size)}
                caption="Unique staff already committed to active or planned response."
                accent="linear-gradient(180deg, rgba(251, 191, 36, 0.18) 0%, rgba(251, 191, 36, 0) 100%)"
              />
              <HudCard
                icon={Shield}
                label="Reserve Staff (Fatigue < 80)"
                value={String(availableReserve)}
                caption="Eligible backup responders ready for a new dispatch."
                accent="linear-gradient(180deg, rgba(52, 211, 153, 0.18) 0%, rgba(52, 211, 153, 0) 100%)"
              />
            </div>

            <div className="mt-8">
              <VolunteerCoverageMap
                localities={localities}
                presence={presence}
                volunteerLookup={volunteerLookup}
              />
            </div>

            <div className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_380px]">
              <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-5 md:p-6">
                <div className="mb-6 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-[0.24em] text-zinc-500">Urgency Feed</p>
                    <h2 className="mt-2 text-2xl font-semibold text-white">Top 3 explainable localities</h2>
                    <p className="mt-1 text-sm text-zinc-400">
                      Ranked from Firestore by `urgencyScore DESC`, then unpacked with Urgency V2 feature weights.
                    </p>
                  </div>
                  <div className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs font-medium text-zinc-300">
                    {reports.length} extracted reports indexed
                  </div>
                </div>

                <div className="space-y-4">
                  {zones.length === 0 ? (
                    <div className="rounded-3xl border border-dashed border-white/12 bg-black/20 p-8 text-center text-sm text-zinc-400">
                      No localities found yet. Seed or connect Firestore to activate the Command Center.
                    </div>
                  ) : (
                    zones.map((zone, index) => {
                      const critical = zone.locality.urgencyLevel === 'CRITICAL';
                      const urgencyHex = urgencyColor(zone.locality.urgencyLevel);
                      const isSimulating = simulatingLocalityId === (zone.locality.id ?? zone.locality.name);

                      return (
                        <motion.article
                          key={zone.locality.id ?? zone.locality.name}
                          initial={{ opacity: 0, y: 14 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.08 }}
                          className={cn(
                            'rounded-[28px] border p-5 md:p-6',
                            critical
                              ? 'border-red-400/25 bg-red-500/[0.06] shadow-[0_0_40px_rgba(248,113,113,0.08)]'
                              : 'border-white/10 bg-black/20'
                          )}
                        >
                          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="rounded-full border border-white/10 bg-white/[0.06] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-300">
                                  Zone {index + 1}
                                </span>
                                <span
                                  className="rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em]"
                                  style={{
                                    color: urgencyHex,
                                    borderColor: `${urgencyHex}50`,
                                    backgroundColor: `${urgencyHex}14`,
                                  }}
                                >
                                  {zone.locality.urgencyLevel}
                                </span>
                                <span className="rounded-full border border-amber-300/20 bg-amber-400/10 px-2.5 py-1 text-[11px] font-semibold text-amber-100">
                                  {zone.reports.length} linked reports
                                </span>
                              </div>

                              <h3 className="mt-3 text-2xl font-semibold text-white">{zone.locality.name}</h3>
                              <p className="mt-1 text-sm text-zinc-400">
                                {zone.locality.district}, {zone.locality.state}
                                {zone.primarySignal ? ` • Trigger: ${zone.primarySignal}` : ''}
                              </p>
                            </div>

                            <div className="flex flex-col items-start gap-3 rounded-3xl border border-white/10 bg-black/25 px-4 py-3 lg:items-end">
                              <div className="text-right">
                                <p className="text-xs uppercase tracking-[0.24em] text-zinc-500">Urgency Score</p>
                                <p className="mt-1 text-4xl font-semibold text-white">{zone.locality.urgencyScore}</p>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleSimulateStaffing(zone)}
                                disabled={!zone.primaryReportId || isSimulating}
                                className="inline-flex items-center gap-2 rounded-2xl border border-amber-300/25 bg-amber-400/10 px-4 py-2.5 text-sm font-medium text-amber-50 transition hover:border-amber-300/40 hover:bg-amber-400/15 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                {isSimulating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Activity className="h-4 w-4" />}
                                Simulate Staffing
                              </button>
                            </div>
                          </div>

                          <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
                            <div className="rounded-2xl border border-white/8 bg-zinc-950/70 p-4">
                              <div className="mb-3 flex items-center justify-between gap-3">
                                <p className="text-xs uppercase tracking-[0.24em] text-zinc-500">AI Narrative</p>
                                <div className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs font-medium text-emerald-100">
                                  Confidence {Math.round(zone.averageConfidence * 100)}%
                                </div>
                              </div>
                              <p className="text-sm leading-6 text-zinc-200">{zone.locality.aiReasoning}</p>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                              <div className="rounded-2xl border border-white/8 bg-zinc-950/70 p-4">
                                <p className="text-xs uppercase tracking-[0.24em] text-zinc-500">Recent Velocity</p>
                                <p className="mt-2 text-2xl font-semibold text-white">
                                  {zone.urgencyV2.recentReportCount}
                                </p>
                                <p className="mt-1 text-xs text-zinc-400">reports in the last 72 hours</p>
                              </div>
                              <div className="rounded-2xl border border-white/8 bg-zinc-950/70 p-4">
                                <p className="text-xs uppercase tracking-[0.24em] text-zinc-500">Decay Behavior</p>
                                <p className="mt-2 text-2xl font-semibold text-white">
                                  {zone.urgencyV2.decayBypassed ? 'Held' : zone.urgencyV2.oldestSignalAgeDays.toFixed(1)}
                                </p>
                                <p className="mt-1 text-xs text-zinc-400">
                                  {zone.urgencyV2.decayBypassed ? 'No-decay trigger present' : 'days since oldest signal'}
                                </p>
                              </div>
                            </div>
                          </div>

                          <div className="mt-5">
                            <ExplainabilityMeter zone={zone} />
                          </div>
                        </motion.article>
                      );
                    })
                  )}
                </div>
              </div>

              <div className="space-y-6">
                <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-5 md:p-6">
                  <div className="flex items-end justify-between gap-4">
                    <div>
                      <p className="text-xs uppercase tracking-[0.24em] text-zinc-500">Reserve Readiness</p>
                      <h2 className="mt-2 text-xl font-semibold text-white">Lowest fatigue, highest availability</h2>
                    </div>
                    <div className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs font-medium text-emerald-100">
                      {availableReserve} ready
                    </div>
                  </div>

                  <div className="mt-5 space-y-3">
                    {reserveRoster.slice(0, 5).map(({ volunteer, fatigue }) => {
                      const tone = fatigueTone(fatigue.score);

                      return (
                        <div key={volunteer.userId} className="rounded-2xl border border-white/8 bg-zinc-950/70 p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-white">{volunteer.displayName}</p>
                              <p className="mt-1 text-xs text-zinc-400">{roleLabel(volunteer.role)}</p>
                            </div>
                            <div className={cn('rounded-full border px-2.5 py-1 text-[11px] font-medium', tone.chip)}>
                              Fatigue {fatigue.score}
                              {fatigue.estimated ? ' est.' : ''}
                            </div>
                          </div>
                          <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/6">
                            <div className={cn('h-full rounded-full', tone.bar)} style={{ width: `${fatigue.score}%` }} />
                          </div>
                          <div className="mt-2 flex items-center justify-between text-xs text-zinc-400">
                            <span>{tone.label}</span>
                            <span>{volunteer.completedCamps} camps completed</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-5 md:p-6">
                  <p className="text-xs uppercase tracking-[0.24em] text-zinc-500">Telemetry Snapshot</p>
                  <h2 className="mt-2 text-xl font-semibold text-white">Backend signal visibility</h2>

                  <div className="mt-5 grid gap-3">
                    {[
                      {
                        label: 'AI Confidence',
                        value: `${Math.round(averageConfidence * 100)}%`,
                        note: 'Average extracted-locality confidence across the urgent feed.',
                      },
                      {
                        label: 'Urgency Inputs',
                        value: String(reports.length),
                        note: 'Structured extracted reports available for explainable scoring.',
                      },
                      {
                        label: 'Reserve Pool',
                        value: formatNumber(reserveRoster.length),
                        note: 'Available volunteers ranked by fatigue before matching.',
                      },
                      {
                        label: 'Tracked Responders',
                        value: formatNumber(trackedResponders.length),
                        note: `${degradedResponders.length} devices currently constrained by low battery or weak connectivity.`,
                      },
                    ].map((item) => (
                      <div key={item.label} className="rounded-2xl border border-white/8 bg-zinc-950/70 p-4">
                        <div className="flex items-center justify-between gap-4">
                          <div>
                            <p className="text-sm font-medium text-white">{item.label}</p>
                            <p className="mt-1 text-xs leading-5 text-zinc-400">{item.note}</p>
                          </div>
                          <div className="text-right text-2xl font-semibold text-white">{item.value}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>

      <AnimatePresence>
        {simulation && (
          <>
            <motion.button
              type="button"
              aria-label="Close staffing simulation"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSimulation(null)}
              className="fixed inset-0 z-40 bg-slate-950/70 backdrop-blur-sm"
            />
            <motion.aside
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
              className="fixed right-0 top-0 z-50 flex h-full w-full max-w-2xl flex-col border-l border-white/10 bg-slate-950 text-slate-100 shadow-2xl shadow-black/40"
              style={{
                backgroundImage:
                  'radial-gradient(circle at top right, rgba(251, 191, 36, 0.14), transparent 28%), radial-gradient(circle at top left, rgba(52, 211, 153, 0.12), transparent 28%), linear-gradient(180deg, #020617 0%, #09090B 56%, #111827 100%)',
              }}
            >
              <div className="flex items-start justify-between gap-4 border-b border-white/10 px-6 py-5">
                <div>
                  <p className="text-xs uppercase tracking-[0.24em] text-zinc-500">Allocation Cockpit</p>
                  <h2 className="mt-2 text-2xl font-semibold text-white">{simulation.zone.locality.name}</h2>
                  <p className="mt-1 text-sm text-zinc-400">
                    Matching API report scope: <span className="font-medium text-zinc-200">{simulation.reportId}</span>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSimulation(null)}
                  className="rounded-2xl border border-white/10 bg-white/[0.04] p-2 text-zinc-300 transition hover:bg-white/[0.08] hover:text-white"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-6 py-5">
                {simulation.loading ? (
                  <div className="flex h-full items-center justify-center">
                    <div className="text-center">
                      <Loader2 className="mx-auto h-8 w-8 animate-spin text-amber-300" />
                      <p className="mt-4 text-sm text-zinc-300">Running matching recommendations...</p>
                    </div>
                  </div>
                ) : simulation.error ? (
                  <div className="rounded-3xl border border-red-400/20 bg-red-500/10 p-6">
                    <p className="text-sm font-semibold text-red-100">Simulation unavailable</p>
                    <p className="mt-2 text-sm leading-6 text-red-50/80">{simulation.error}</p>
                  </div>
                ) : simulation.candidates.length === 0 ? (
                  <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 text-sm text-zinc-300">
                    The ranker returned no eligible responders for this locality.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {simulation.candidates.map((candidate, index) => {
                      const volunteer = volunteerLookup.get(candidate.volunteerId);
                      const fatigue = volunteer ? getFatigueMeta(volunteer) : null;
                      const tone = fatigue ? fatigueTone(fatigue.score) : null;

                      return (
                        <div
                          key={candidate.volunteerId}
                          className={cn(
                            'rounded-[28px] border p-5',
                            index === 0
                              ? 'border-emerald-300/25 bg-emerald-400/[0.08] shadow-[0_0_32px_rgba(52,211,153,0.08)]'
                              : 'border-white/10 bg-white/[0.04]'
                          )}
                        >
                          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-300">
                                  Rank {index + 1}
                                </span>
                                <span className="rounded-full border border-amber-300/20 bg-amber-400/10 px-2.5 py-1 text-[11px] font-semibold text-amber-100">
                                  {candidate.matchScore}% match
                                </span>
                                {fatigue && tone && (
                                  <span className={cn('rounded-full border px-2.5 py-1 text-[11px] font-medium', tone.chip)}>
                                    Fatigue {fatigue.score}
                                    {fatigue.estimated ? ' est.' : ''}
                                  </span>
                                )}
                              </div>
                              <h3 className="mt-3 text-xl font-semibold text-white">{candidate.displayName}</h3>
                              <p className="mt-1 text-sm text-zinc-400">{roleLabel(candidate.role)}</p>
                            </div>

                            <button
                              type="button"
                              onClick={() => handleDispatch(simulation.zone, candidate)}
                              className="inline-flex items-center gap-2 rounded-2xl border border-emerald-400/25 bg-emerald-400/10 px-4 py-2.5 text-sm font-medium text-emerald-50 transition hover:border-emerald-300/40 hover:bg-emerald-400/15"
                            >
                              Dispatch (Lock Assignment)
                              <ArrowRight className="h-4 w-4" />
                            </button>
                          </div>

                          <div className="mt-4 rounded-2xl border border-white/8 bg-zinc-950/80 p-4">
                            <p className="text-xs uppercase tracking-[0.24em] text-zinc-500">AI Explanation</p>
                            <p className="mt-3 text-base leading-7 text-white">{candidate.explanation}</p>
                          </div>

                          {fatigue && tone && (
                            <div className="mt-4">
                              <div className="mb-2 flex items-center justify-between text-xs text-zinc-400">
                                <span>Reserve load profile</span>
                                <span>{tone.label}</span>
                              </div>
                              <div className="h-2 overflow-hidden rounded-full bg-white/6">
                                <div className={cn('h-full rounded-full', tone.bar)} style={{ width: `${fatigue.score}%` }} />
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
