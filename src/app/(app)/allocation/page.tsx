'use client';
import PageShell from '@/components/layout/PageShell';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, Star, CheckCircle2, Target, Sparkles, ShieldAlert, Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { getCollection, orderBy } from '@/lib/firebase/firestore';
import { VolunteerProfile, CampPlan, UserRole } from '@/types';
import { roleLabel, getInitials } from '@/lib/utils';
import toast from 'react-hot-toast';

const roleFilters = [
  { value: 'ALL', label: 'All Roles' },
  { value: UserRole.DOCTOR, label: '🩺 Doctors' },
  { value: UserRole.PHARMACIST, label: '💊 Pharmacists' },
  { value: UserRole.FIELD_VOLUNTEER, label: '📋 Field' },
  { value: UserRole.SUPPORT, label: '🤝 Support' },
];

function MatchScoreBar({ score }: { score: number }) {
  const color = score >= 80 ? '#2D6A4F' : score >= 60 ? '#D97706' : '#DC2626';
  return (
    <div className="flex items-center gap-2 mt-2">
      <div className="flex-1 h-2 rounded-full bg-[#E5E2DC] overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${score}%` }}
          transition={{ duration: 0.8, ease: [0.4, 0, 0.2, 1] }}
          className="h-full rounded-full"
          style={{ background: color }}
        />
      </div>
      <span className="text-xs font-bold min-w-[32px] text-right" style={{ color }}>{score}%</span>
    </div>
  );
}

interface MatchCandidate {
  volunteerId: string;
  volunteer: VolunteerProfile;
  matchScore: number;
  explanation: string;
  conflictAlert: boolean;
}

export default function AllocationPage() {
  const [camps, setCamps] = useState<CampPlan[]>([]);
  const [selectedCamp, setSelectedCamp] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [loadingAI, setLoadingAI] = useState(false);
  const [candidates, setCandidates] = useState<MatchCandidate[]>([]);
  
  // Constraints
  const [roleConstraint, setRoleConstraint] = useState('ALL');
  const [langConstraint, setLangConstraint] = useState('');
  const [maxDistance, setMaxDistance] = useState(50);
  const [maxFatigue, setMaxFatigue] = useState(80);
  const [genderSensitive, setGenderSensitive] = useState(false);
  const [availableOnly, setAvailableOnly] = useState(true);
  
  const [assigningId, setAssigningId] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      getCollection<CampPlan>('camp_plans', orderBy('createdAt', 'desc')),
    ]).then(([cps]) => {
      setCamps(cps);
      if (cps.length > 0) setSelectedCamp(cps[0].id || '');
      setLoading(false);
    });
  }, []);

  const currentCamp = camps.find((c) => c.id === selectedCamp);

  async function generateMatches() {
    if (!currentCamp) return;
    setLoadingAI(true);
    setCandidates([]);
    try {
      const constraints = {
        roles: roleConstraint === 'ALL' ? [] : [roleConstraint],
        language: langConstraint || undefined,
        maxDistance,
        maxFatigue,
        genderSensitive,
        availableOnly,
      };

      const res = await fetch('/api/allocation/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campId: currentCamp.id,
          constraints,
        }),
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.matches)) {
        setCandidates(data.matches);
        toast.success(`Found ${data.matches.length} candidates`);
      } else {
        toast.error(data.error || 'Failed to find matches');
      }
    } catch { 
      toast.error('Failed to load match scores'); 
    }
    setLoadingAI(false);
  }

  async function handleAssign(c: MatchCandidate) {
    if (!currentCamp) return;
    setAssigningId(c.volunteerId);
    try {
      const res = await fetch('/api/allocation/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campId: currentCamp.id,
          volunteerId: c.volunteerId,
          role: c.volunteer.role,
          matchScore: c.matchScore,
          matchReasoning: c.explanation,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`${c.volunteer.displayName} assigned!`);
        // Remove locally
        setCandidates(prev => prev.filter(x => x.volunteerId !== c.volunteerId));
      } else {
        toast.error(data.error || 'Assignment failed');
      }
    } catch (e) {
      toast.error(String(e));
    }
    setAssigningId(null);
  }

  if (loading) {
    return (
      <PageShell title="Allocation Cockpit" subtitle="Intelligent Staffing">
        <div className="flex justify-center items-center h-64"><Loader2 className="w-8 h-8 animate-spin text-[#F4A261]" /></div>
      </PageShell>
    );
  }

  return (
    <PageShell title="Allocation Cockpit" subtitle="Constraint-Driven Staffing">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Constraints & Configuration */}
        <div className="lg:col-span-1 space-y-6">
          
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-[#E5E2DC]">
            <h2 className="text-lg font-bold text-[#1B2E25] mb-4 flex items-center justify-between">
              Target Camp
            </h2>
            <select 
              value={selectedCamp} 
              onChange={(e) => setSelectedCamp(e.target.value)}
              className="w-full p-3 rounded-xl border border-[#E5E2DC] bg-[#FAFAFA] text-sm focus:ring-2 focus:ring-[#2D6A4F] focus:border-[#2D6A4F] outline-none transition-all"
            >
              {camps.map(c => (
                <option key={c.id} value={c.id}>{c.title} • {c.localityName}</option>
              ))}
            </select>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-sm border border-[#E5E2DC]">
            <h2 className="text-lg font-bold text-[#1B2E25] mb-4 flex items-center gap-2">
              <Target className="w-5 h-5 text-[#2D6A4F]" /> Match Constraints
            </h2>
            
            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-[#1B2E25]/60 uppercase tracking-wider mb-2 block">Role Required</label>
                <select value={roleConstraint} onChange={e => setRoleConstraint(e.target.value)} className="w-full p-2.5 rounded-xl border border-[#E5E2DC] bg-[#FAFAFA] text-sm">
                  {roleFilters.map(r => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-[#1B2E25]/60 uppercase tracking-wider mb-2 block">Required Language</label>
                <input type="text" placeholder="e.g. Hindi" value={langConstraint} onChange={(e) => setLangConstraint(e.target.value)} className="w-full p-2.5 rounded-xl border border-[#E5E2DC] bg-[#FAFAFA] text-sm" />
              </div>

              <div>
                <label className="text-xs font-semibold text-[#1B2E25]/60 uppercase tracking-wider mb-2 flex justify-between">
                  <span>Max Travel Distance</span>
                  <span>{maxDistance} km</span>
                </label>
                <input type="range" min="5" max="150" step="5" value={maxDistance} onChange={e => setMaxDistance(Number(e.target.value))} className="w-full accent-[#2D6A4F]" />
              </div>

              <div>
                <label className="text-xs font-semibold text-[#1B2E25]/60 uppercase tracking-wider mb-2 flex justify-between">
                  <span>Max Fatigue Score</span>
                  <span>{maxFatigue}</span>
                </label>
                <input type="range" min="10" max="100" step="10" value={maxFatigue} onChange={e => setMaxFatigue(Number(e.target.value))} className="w-full accent-[#F4A261]" />
              </div>

              <label className="flex items-center gap-3 p-3 rounded-xl border border-[#E5E2DC] bg-[#FAFAFA] cursor-pointer">
                <input type="checkbox" checked={genderSensitive} onChange={e => setGenderSensitive(e.target.checked)} className="w-4 h-4 rounded text-[#2D6A4F] focus:ring-[#2D6A4F]" />
                <span className="text-sm font-medium text-[#1B2E25]">Require Gender-Sensitive Care Cert</span>
              </label>

              <label className="flex items-center gap-3 p-3 rounded-xl border border-[#E5E2DC] bg-[#FAFAFA] cursor-pointer">
                <input type="checkbox" checked={availableOnly} onChange={e => setAvailableOnly(e.target.checked)} className="w-4 h-4 rounded text-[#2D6A4F] focus:ring-[#2D6A4F]" />
                <span className="text-sm font-medium text-[#1B2E25]">Strict Availability Window</span>
              </label>

              <button
                onClick={generateMatches}
                disabled={loadingAI || !currentCamp}
                className="w-full py-3.5 bg-gradient-to-r from-[#2D6A4F] to-[#1B2E25] text-white font-bold rounded-xl shadow-lg shadow-[#2D6A4F]/20 hover:shadow-xl hover:shadow-[#2D6A4F]/30 hover:-translate-y-0.5 transition-all text-sm flex items-center justify-center gap-2"
              >
                {loadingAI ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
                {loadingAI ? 'Calculating Matrix...' : 'Generate Matrix'}
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Recommendations Matrix */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-[#E5E2DC] h-full flex flex-col">
            <h2 className="text-lg font-bold text-[#1B2E25] mb-1">Recommendation Matrix</h2>
            <p className="text-sm text-[#1B2E25]/60 mb-6">Deterministic constraint solver output ranked by LLM</p>

            <div className="flex-1 space-y-4 overflow-y-auto pr-2">
              {candidates.length === 0 && !loadingAI && (
                <div className="h-full flex flex-col items-center justify-center text-center p-8 bg-[#FAFAFA] rounded-xl border border-dashed border-[#E5E2DC]">
                  <Users className="w-12 h-12 text-[#1B2E25]/20 mb-3" />
                  <p className="text-[#1B2E25]/50 font-medium">No candidates generated</p>
                  <p className="text-sm text-[#1B2E25]/40 mt-1">Adjust constraints and generate matrix to see recommended volunteers.</p>
                </div>
              )}

              {loadingAI && (
                <div className="space-y-4">
                  {[1,2,3].map(i => (
                    <div key={i} className="animate-pulse bg-[#FAFAFA] rounded-xl p-5 border border-[#E5E2DC]/50 h-32" />
                  ))}
                </div>
              )}

              <AnimatePresence mode="popLayout">
                {candidates.map((c, i) => (
                  <motion.div
                    key={c.volunteerId}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ delay: i * 0.05 }}
                    className="bg-white rounded-xl p-5 border border-[#E5E2DC] shadow-sm hover:shadow-md transition-all group"
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-[#1B2E25] text-white flex items-center justify-center font-bold text-sm shadow-inner overflow-hidden shrink-0">
                          {c.volunteer.photoURL ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={c.volunteer.photoURL} alt="" className="w-full h-full object-cover" />
                          ) : (
                            getInitials(c.volunteer.displayName)
                          )}
                        </div>
                        <div>
                          <h3 className="font-bold text-[#1B2E25]">{c.volunteer.displayName}</h3>
                          <div className="flex items-center gap-2 text-xs font-medium text-[#1B2E25]/60">
                            <span className="px-2 py-0.5 rounded-full bg-[#FAFAFA] border border-[#E5E2DC]">
                              {roleLabel(c.volunteer.role)}
                            </span>
                            {c.volunteer.rating >= 4.5 && (
                              <span className="flex items-center gap-0.5 text-amber-600">
                                <Star className="w-3 h-3 fill-current" /> {c.volunteer.rating}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-col items-end">
                        <button
                          onClick={() => handleAssign(c)}
                          disabled={assigningId === c.volunteerId}
                          className="px-4 py-2 bg-[#2D6A4F] text-white text-xs font-bold rounded-lg hover:bg-[#1B2E25] transition-colors flex items-center gap-2"
                        >
                          {assigningId === c.volunteerId ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                          Assign & Lock
                        </button>
                      </div>
                    </div>

                    <div className="p-3 rounded-lg bg-blue-50 border border-blue-100 text-sm text-blue-900 leading-snug">
                      <span className="font-semibold">Match Reasoning:</span> {c.explanation}
                    </div>

                    {c.conflictAlert && (
                      <div className="mt-3 p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800 flex items-start gap-2 shadow-sm">
                        <ShieldAlert className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
                        <div>
                          <span className="font-bold block">Constraint Alert</span>
                          LLM reasoning deviated significantly from deterministic constraints. Override requires review.
                        </div>
                      </div>
                    )}

                    <div className="mt-4">
                      <MatchScoreBar score={c.matchScore} />
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>
        </div>

      </div>
    </PageShell>
  );
}
