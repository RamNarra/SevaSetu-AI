'use client';
import PageShell from '@/components/layout/PageShell';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, Star, Search, CheckCircle2, MapPin, Target, Calendar, Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';
import { getCollection } from '@/lib/firebase/firestore';
import { VolunteerProfile, Assignment, CampPlan, UserRole } from '@/types';
import { roleLabel, getInitials, formatDate } from '@/lib/utils';
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
    <div className="flex items-center gap-2">
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

export default function AllocationPage() {
  const [volunteers, setVolunteers] = useState<VolunteerProfile[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [camps, setCamps] = useState<CampPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedVol, setSelectedVol] = useState<VolunteerProfile | null>(null);
  const [selectedCamp, setSelectedCamp] = useState<string>('');
  const [matchScores, setMatchScores] = useState<Record<string, { score: number; reasoning: string }>>({});
  const [loadingAI, setLoadingAI] = useState(false);

  useEffect(() => {
    Promise.all([
      getCollection<VolunteerProfile>('volunteer_profiles'),
      getCollection<Assignment>('assignments'),
      getCollection<CampPlan>('camp_plans'),
    ]).then(([vols, asgns, cps]) => {
      setVolunteers(vols);
      setAssignments(asgns);
      setCamps(cps);
      if (cps.length > 0) setSelectedCamp(cps[0].id || '');
      setLoading(false);
    });
  }, []);

  const currentCamp = camps.find((c) => c.id === selectedCamp);
  const campAssignments = assignments.filter((a) => a.campId === selectedCamp);
  const assignedVolIds = new Set(campAssignments.map((a) => a.volunteerId));

  const filtered = volunteers.filter((vol) => {
    if (roleFilter !== 'ALL' && vol.role !== roleFilter) return false;
    if (searchQuery && !vol.displayName.toLowerCase().includes(searchQuery.toLowerCase()) &&
      !vol.skills.some((s) => s.toLowerCase().includes(searchQuery.toLowerCase()))) return false;
    return true;
  });

  const available = volunteers.filter((v) => v.availability === 'AVAILABLE');
  const busy = volunteers.filter((v) => v.availability === 'BUSY');
  const assigned = volunteers.filter((v) => assignedVolIds.has(v.userId));

  async function getAIMatchScores() {
    if (!currentCamp) return;
    setLoadingAI(true);
    try {
      const res = await fetch('/api/ai/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campTitle: currentCamp.title,
          localityName: currentCamp.localityId,
          requiredRoles: currentCamp.requiredRoles,
          volunteers: volunteers.map((v) => ({
            id: v.userId,
            name: v.displayName,
            role: v.role,
            skills: v.skills,
            languages: v.languages,
            availability: v.availability,
            rating: v.rating,
            completedCamps: v.completedCamps,
            travelRadiusKm: v.travelRadiusKm,
          })),
        }),
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.result)) {
        const scores: Record<string, { score: number; reasoning: string }> = {};
        data.result.forEach((r: { volunteerId: string; matchScore: number; reasoning: string }) => {
          scores[r.volunteerId] = { score: r.matchScore, reasoning: r.reasoning };
        });
        setMatchScores(scores);
        toast.success('AI match scores loaded');
      }
    } catch { toast.error('Failed to load match scores'); }
    setLoadingAI(false);
  }

  // Sort filtered by match score if available
  const sortedFiltered = [...filtered].sort((a, b) => {
    const scoreA = matchScores[a.userId]?.score || 0;
    const scoreB = matchScores[b.userId]?.score || 0;
    return scoreB - scoreA;
  });

  return (
    <PageShell title="Volunteer Allocation" subtitle="Manage and assign volunteers to camp roles">
      {/* Camp Selector + AI Button */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="flex items-center gap-2 flex-1">
          <Calendar className="w-4 h-4 text-[#6B7280]" />
          <select
            value={selectedCamp}
            onChange={(e) => { setSelectedCamp(e.target.value); setMatchScores({}); }}
            className="px-3 py-2 rounded-xl border border-[#E5E2DC] text-sm focus:outline-none focus:ring-2 focus:ring-[#D4622B]/30 bg-white"
          >
            <option value="">Select Camp</option>
            {camps.map((c) => (
              <option key={c.id} value={c.id}>{c.title} — {c.status}</option>
            ))}
          </select>
        </div>
        {currentCamp && (
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={getAIMatchScores}
            disabled={loadingAI}
            className="btn bg-gradient-to-r from-[#D4622B] to-[#F4A261] text-white text-sm px-4 py-2 flex items-center gap-2 disabled:opacity-50"
          >
            <Sparkles className="w-4 h-4" />
            {loadingAI ? 'Analyzing...' : 'AI Match Scores'}
          </motion.button>
        )}
      </div>

      {/* Current Camp Info */}
      {currentCamp && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="card mb-4 !py-3 flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <Target className="w-4 h-4 text-[#D4622B]" />
            <span className="text-sm font-semibold text-[#1A1A1A]">{currentCamp.title}</span>
          </div>
          <span className="text-xs text-[#6B7280]">{formatDate(currentCamp.scheduledDate)}</span>
          <span className={`badge text-[10px] ${currentCamp.status === 'ACTIVE' ? 'bg-green-50 text-green-700' : currentCamp.status === 'PLANNED' ? 'bg-blue-50 text-blue-700' : 'bg-gray-50 text-gray-600'}`}>
            {currentCamp.status}
          </span>
          <div className="flex gap-2 ml-auto text-xs text-[#6B7280]">
            {Object.entries(currentCamp.requiredRoles || {}).map(([role, count]) => (
              <span key={role} className="badge bg-[#FAF9F6] border-[#E5E2DC]">
                {roleLabel(role as UserRole)}: {count as number}
              </span>
            ))}
          </div>
        </motion.div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B7280]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name or skill..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-[#E5E2DC] text-sm focus:outline-none focus:ring-2 focus:ring-[#D4622B]/30"
          />
        </div>
        <div className="flex items-center gap-1.5">
          {roleFilters.map((filter) => (
            <motion.button
              key={filter.value}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => setRoleFilter(filter.value)}
              className={`px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                roleFilter === filter.value
                  ? 'bg-[#D4622B] text-white shadow-sm'
                  : 'bg-white border border-[#E5E2DC] text-[#6B7280] hover:border-[#D4622B]/30'
              }`}
            >
              {filter.label}
            </motion.button>
          ))}
        </div>
      </div>

      {/* Stats */}
      <div className="flex gap-3 mb-6">
        {[
          { label: 'Available', count: available.length, color: '#65A30D' },
          { label: 'Busy', count: busy.length, color: '#D97706' },
          { label: 'Assigned', count: assigned.length, color: '#2D6A4F' },
        ].map((s) => (
          <div key={s.label} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white border border-[#E5E2DC]">
            <div className="w-2 h-2 rounded-full" style={{ background: s.color }} />
            <span className="text-xs text-[#6B7280]">{s.label}: <span className="font-semibold text-[#1A1A1A]">{s.count}</span></span>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Volunteer Grid */}
        <div className="lg:col-span-2">
          <div className="grid md:grid-cols-2 gap-3">
            {loading ? (
              Array(6).fill(0).map((_, i) => <div key={i} className="card"><div className="skeleton h-36" /></div>)
            ) : sortedFiltered.length === 0 ? (
              <div className="col-span-full card text-center py-12 text-[#6B7280]">
                <Users className="w-8 h-8 mx-auto mb-2 opacity-30" /><p className="text-sm">No volunteers match your filters</p>
              </div>
            ) : (
              <AnimatePresence>
                {sortedFiltered.map((vol, i) => {
                  const match = matchScores[vol.userId];
                  const isAssigned = assignedVolIds.has(vol.userId);
                  return (
                    <motion.div
                      key={vol.id || vol.userId}
                      layout
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ delay: i * 0.03 }}
                      whileHover={{ y: -3, boxShadow: '0 10px 25px -5px rgba(0,0,0,0.08)' }}
                      onClick={() => setSelectedVol(vol)}
                      className={`card cursor-pointer relative ${selectedVol?.userId === vol.userId ? 'ring-2 ring-[#D4622B]' : ''} ${isAssigned ? 'border-[#2D6A4F]/40 bg-[#2D6A4F]/[0.03]' : ''}`}
                    >
                      {isAssigned && (
                        <div className="absolute top-2 right-2">
                          <span className="badge bg-[#2D6A4F]/10 text-[#2D6A4F] border-[#2D6A4F]/20 text-[10px] font-bold">ASSIGNED</span>
                        </div>
                      )}
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#2D6A4F] to-[#40916C] flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                          {getInitials(vol.displayName)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-[#1A1A1A] truncate">{vol.displayName}</p>
                          <p className="text-xs text-[#6B7280]">{roleLabel(vol.role)}</p>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <div className="flex items-center gap-1">
                            <Star className="w-3.5 h-3.5 text-[#F4A261]" />
                            <span className="text-sm font-bold text-[#1A1A1A]">{vol.rating}</span>
                          </div>
                          <span className={`badge text-[10px] ${
                            vol.availability === 'AVAILABLE' ? 'bg-green-50 text-green-700 border-green-200' :
                            vol.availability === 'BUSY' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                            'bg-gray-50 text-gray-600 border-gray-200'
                          }`}>
                            {vol.availability}
                          </span>
                        </div>
                      </div>

                      {/* AI Match Score */}
                      {match && (
                        <div className="mb-2">
                          <MatchScoreBar score={match.score} />
                          <p className="text-[10px] text-[#6B7280] mt-1 line-clamp-1">{match.reasoning}</p>
                        </div>
                      )}

                      <div className="flex flex-wrap gap-1 mb-2">
                        {vol.skills.slice(0, 3).map((s, j) => (
                          <span key={j} className="badge bg-secondary-pale text-secondary border-secondary/20 text-[10px]">{s}</span>
                        ))}
                        {vol.skills.length > 3 && (
                          <span className="badge bg-[#FAF9F6] text-[#6B7280] border-[#E5E2DC] text-[10px]">+{vol.skills.length - 3}</span>
                        )}
                      </div>

                      <div className="flex items-center justify-between text-xs text-[#6B7280]">
                        <span className="flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> {vol.completedCamps} camps
                        </span>
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3" /> {vol.travelRadiusKm}km
                        </span>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            )}
          </div>
        </div>

        {/* Volunteer Detail Panel */}
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="card sticky top-20">
          <h3 className="font-semibold text-[#1A1A1A] mb-4">Volunteer Profile</h3>
          {selectedVol ? (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#2D6A4F] to-[#40916C] flex items-center justify-center text-white text-xl font-bold">
                  {getInitials(selectedVol.displayName)}
                </div>
                <div>
                  <p className="text-lg font-bold text-[#1A1A1A]">{selectedVol.displayName}</p>
                  <p className="text-sm text-[#6B7280]">{roleLabel(selectedVol.role)}</p>
                  <div className="flex items-center gap-1 mt-1">
                    <Star className="w-4 h-4 text-[#F4A261]" />
                    <span className="font-semibold text-[#1A1A1A]">{selectedVol.rating}/5</span>
                  </div>
                </div>
              </div>

              {/* AI Match Score Detail */}
              {matchScores[selectedVol.userId] && (
                <div className="p-3 rounded-xl bg-[#FEF3EC] border border-[#D4622B]/20">
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles className="w-4 h-4 text-[#D4622B]" />
                    <span className="text-xs font-bold text-[#D4622B]">AI MATCH SCORE</span>
                  </div>
                  <MatchScoreBar score={matchScores[selectedVol.userId].score} />
                  <p className="text-xs text-[#6B7280] mt-2">{matchScores[selectedVol.userId].reasoning}</p>
                </div>
              )}

              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-[#6B7280] mb-2">Skills</p>
                <div className="flex flex-wrap gap-1.5">
                  {selectedVol.skills.map((s, i) => (
                    <span key={i} className="badge bg-secondary-pale text-secondary border-secondary/20">{s}</span>
                  ))}
                </div>
              </div>

              {selectedVol.certifications.length > 0 && (
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-[#6B7280] mb-2">Certifications</p>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedVol.certifications.map((c, i) => (
                      <span key={i} className="badge bg-primary-pale text-[#D4622B] border-[#D4622B]/20">{c}</span>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-[#6B7280] mb-2">Languages</p>
                <p className="text-sm text-[#1A1A1A]">{selectedVol.languages.join(', ')}</p>
              </div>

              <div className="text-xs text-[#6B7280] space-y-1 pt-2 border-t border-[#E5E2DC]">
                <p>Preferred areas: <span className="text-[#1A1A1A]">{selectedVol.preferredAreas.join(', ')}</span></p>
                <p>Travel radius: <span className="text-[#1A1A1A]">{selectedVol.travelRadiusKm} km</span></p>
                <p>Completed camps: <span className="text-[#1A1A1A]">{selectedVol.completedCamps}</span></p>
                <p>Status: <span className={`font-semibold ${selectedVol.availability === 'AVAILABLE' ? 'text-green-600' : selectedVol.availability === 'BUSY' ? 'text-amber-600' : 'text-gray-500'}`}>{selectedVol.availability}</span></p>
              </div>
            </div>
          ) : (
            <div className="text-center py-12 text-[#6B7280]">
              <Users className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Select a volunteer to view full profile</p>
            </div>
          )}
        </motion.div>
      </div>
    </PageShell>
  );
}
