'use client';

import { useState, useEffect } from 'react';
import PageShell from '@/components/layout/PageShell';
import { motion, AnimatePresence } from 'framer-motion';
import { CalendarRange, MapPin, Users, Sparkles, Loader2, Check, Plus, Star } from 'lucide-react';
import { getCollection, addDocument, Timestamp } from '@/lib/firebase/firestore';
import { Locality, VolunteerProfile, CampStatus, StaffRecommendation } from '@/types';
import { urgencyBgColor, urgencyColor, roleLabel, getInitials } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import toast from 'react-hot-toast';

export default function PlannerPage() {
  const { user } = useAuth();
  const [localities, setLocalities] = useState<Locality[]>([]);
  const [volunteers, setVolunteers] = useState<VolunteerProfile[]>([]);
  const [loading, setLoading] = useState(true);

  // Form state
  const [selectedLocality, setSelectedLocality] = useState<Locality | null>(null);
  const [campTitle, setCampTitle] = useState('');
  const [campDate, setCampDate] = useState('');
  const [doctors, setDoctors] = useState(2);
  const [pharmacists, setPharmacists] = useState(1);
  const [fieldVols, setFieldVols] = useState(2);
  const [support, setSupport] = useState(3);

  // AI state
  const [isRecommending, setIsRecommending] = useState(false);
  const [recommendations, setRecommendations] = useState<StaffRecommendation[]>([]);
  const [selectedStaff, setSelectedStaff] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    Promise.all([
      getCollection<Locality>('localities'),
      getCollection<VolunteerProfile>('volunteer_profiles'),
    ]).then(([locs, vols]) => {
      setLocalities(locs.sort((a, b) => b.urgencyScore - a.urgencyScore));
      setVolunteers(vols);
      setLoading(false);
    });
  }, []);

  function selectLocality(loc: Locality) {
    setSelectedLocality(loc);
    setCampTitle(`${loc.name} Health Camp`);
    setRecommendations([]);
    setSelectedStaff([]);
  }

  async function handleGetRecommendations() {
    if (!selectedLocality) return;
    setIsRecommending(true);
    setRecommendations([]);

    try {
      const availableVols = volunteers.filter((v) => v.availability === 'AVAILABLE');
      const response = await fetch('/api/ai/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campTitle,
          localityName: selectedLocality.name,
          requiredRoles: { doctors, pharmacists, fieldVolunteers: fieldVols, support },
          volunteers: availableVols.map((v) => ({
            id: v.userId,
            name: v.displayName,
            role: v.role,
            skills: v.skills,
            certifications: v.certifications,
            languages: v.languages,
            preferredAreas: v.preferredAreas,
            travelRadiusKm: v.travelRadiusKm,
            completedCamps: v.completedCamps,
            rating: v.rating,
          })),
        }),
      });
      const data = await response.json();
      if (data.success && Array.isArray(data.result)) {
        setRecommendations(data.result);
        // Auto-select top matches
        const topIds = data.result
          .sort((a: StaffRecommendation, b: StaffRecommendation) => b.matchScore - a.matchScore)
          .slice(0, doctors + pharmacists + fieldVols + support)
          .map((r: StaffRecommendation) => r.volunteerId);
        setSelectedStaff(topIds);
        toast.success(`AI recommended ${data.result.length} volunteers`);
      } else {
        toast.error('Failed to get recommendations');
      }
    } catch (error) {
      console.error(error);
      toast.error('AI recommendation service unavailable');
    } finally {
      setIsRecommending(false);
    }
  }

  async function handleCreateCamp() {
    if (!selectedLocality || !campTitle || !campDate) {
      toast.error('Please fill in all camp details');
      return;
    }

    setIsSaving(true);
    try {
      await addDocument('camp_plans', {
        localityId: selectedLocality.id,
        localityName: selectedLocality.name,
        title: campTitle,
        scheduledDate: Timestamp.fromDate(new Date(campDate)),
        status: CampStatus.PLANNED,
        predictedTurnout: Math.round(selectedLocality.population * 0.04),
        requiredRoles: { doctors, pharmacists, fieldVolunteers: fieldVols, support },
        assignedStaff: selectedStaff,
        coordinatorId: user?.uid || '',
        notes: '',
        createdAt: Timestamp.now(),
      });
      toast.success('Camp plan created!');
      setCampTitle('');
      setCampDate('');
      setSelectedLocality(null);
      setRecommendations([]);
      setSelectedStaff([]);
    } catch (error) {
      console.error(error);
      toast.error('Failed to create camp plan');
    } finally {
      setIsSaving(false);
    }
  }

  function toggleStaff(id: string) {
    setSelectedStaff((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  }

  return (
    <PageShell title="Camp Planner" subtitle="Plan health camps with AI-powered staffing recommendations">
      <div className="grid lg:grid-cols-5 gap-6">
        {/* Left: Camp Config */}
        <div className="lg:col-span-2 space-y-4">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="card">
            <h3 className="font-semibold text-[#1A1A1A] flex items-center gap-2 mb-5">
              <CalendarRange className="w-5 h-5 text-[#D4622B]" /> Camp Configuration
            </h3>

            {/* Locality Selector */}
            <div className="mb-4">
              <label className="text-xs font-medium text-[#6B7280] mb-2 block">Target Locality</label>
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {loading ? (
                  Array(3).fill(0).map((_, i) => <div key={i} className="skeleton h-12" />)
                ) : (
                  localities.map((loc) => (
                    <motion.button
                      key={loc.id}
                      whileHover={{ x: 2 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => selectLocality(loc)}
                      className={`w-full text-left p-3 rounded-xl border-2 transition-all flex items-center gap-3 ${
                        selectedLocality?.id === loc.id
                          ? 'border-[#D4622B] bg-primary-pale'
                          : 'border-[#E5E2DC] hover:border-[#D4622B]/30'
                      }`}
                    >
                      <MapPin className="w-4 h-4 flex-shrink-0" style={{ color: urgencyColor(loc.urgencyLevel) }} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-[#1A1A1A] truncate">{loc.name}</p>
                        <p className="text-xs text-[#6B7280]">{loc.district}</p>
                      </div>
                      <span className={`badge text-[10px] ${urgencyBgColor(loc.urgencyLevel)}`}>{loc.urgencyScore}</span>
                    </motion.button>
                  ))
                )}
              </div>
            </div>

            {/* Camp Details */}
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-[#6B7280] mb-1 block">Camp Title</label>
                <input
                  type="text"
                  value={campTitle}
                  onChange={(e) => setCampTitle(e.target.value)}
                  placeholder="e.g. Rampur Emergency Health Camp"
                  className="w-full p-3 rounded-xl border border-[#E5E2DC] text-sm focus:outline-none focus:ring-2 focus:ring-[#D4622B]/30 focus:border-[#D4622B] transition-all"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-[#6B7280] mb-1 block">Scheduled Date</label>
                <input
                  type="date"
                  value={campDate}
                  onChange={(e) => setCampDate(e.target.value)}
                  className="w-full p-3 rounded-xl border border-[#E5E2DC] text-sm focus:outline-none focus:ring-2 focus:ring-[#D4622B]/30 focus:border-[#D4622B] transition-all"
                />
              </div>
            </div>

            {/* Role Requirements */}
            <div className="mt-4">
              <label className="text-xs font-medium text-[#6B7280] mb-2 block">Required Staff</label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: 'Doctors', value: doctors, setter: setDoctors, emoji: '🩺' },
                  { label: 'Pharmacists', value: pharmacists, setter: setPharmacists, emoji: '💊' },
                  { label: 'Field Volunteers', value: fieldVols, setter: setFieldVols, emoji: '📋' },
                  { label: 'Support Staff', value: support, setter: setSupport, emoji: '🤝' },
                ].map((item) => (
                  <div key={item.label} className="flex items-center gap-2 p-2 rounded-lg bg-[#FAF9F6] border border-[#E5E2DC]">
                    <span className="text-lg">{item.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-[#6B7280] truncate">{item.label}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => item.setter(Math.max(0, item.value - 1))} className="w-6 h-6 rounded bg-white border border-[#E5E2DC] text-xs font-bold text-[#6B7280] hover:border-[#D4622B]">-</button>
                      <span className="text-sm font-bold w-6 text-center">{item.value}</span>
                      <button onClick={() => item.setter(item.value + 1)} className="w-6 h-6 rounded bg-white border border-[#E5E2DC] text-xs font-bold text-[#6B7280] hover:border-[#D4622B]">+</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Predicted Turnout */}
            {selectedLocality && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-4 p-3 rounded-xl bg-secondary-pale border border-secondary/20">
                <p className="text-xs text-secondary font-medium">Predicted Turnout</p>
                <p className="text-2xl font-bold text-secondary">~{Math.round(selectedLocality.population * 0.04)} patients</p>
                <p className="text-xs text-[#6B7280]">Based on {selectedLocality.population.toLocaleString()} population</p>
              </motion.div>
            )}

            {/* Get Recommendations */}
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleGetRecommendations}
              disabled={!selectedLocality || isRecommending}
              className="mt-4 w-full btn-primary py-3 disabled:opacity-50"
            >
              {isRecommending ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Getting AI Recommendations...</>
              ) : (
                <><Sparkles className="w-4 h-4" /> Get AI Staff Recommendations</>
              )}
            </motion.button>
          </motion.div>
        </div>

        {/* Right: Recommendations */}
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }} className="lg:col-span-3 space-y-4">
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-[#1A1A1A] flex items-center gap-2">
                <Users className="w-5 h-5 text-[#2D6A4F]" /> AI Staffing Recommendation
              </h3>
              {selectedStaff.length > 0 && (
                <span className="badge bg-secondary-pale text-secondary border-secondary/20">
                  {selectedStaff.length} selected
                </span>
              )}
            </div>

            {isRecommending ? (
              <div className="flex flex-col items-center justify-center py-16">
                <div className="relative">
                  <Sparkles className="w-12 h-12 text-[#F4A261] animate-pulse" />
                  <div className="absolute inset-0 animate-ping">
                    <Sparkles className="w-12 h-12 text-[#F4A261] opacity-30" />
                  </div>
                </div>
                <p className="mt-4 text-sm font-medium text-[#1A1A1A]">Gemini is analyzing volunteer profiles...</p>
                <p className="text-xs text-[#6B7280] mt-1">Matching skills, distance, language, and availability</p>
              </div>
            ) : recommendations.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-[#6B7280]">
                <Users className="w-12 h-12 mb-3 opacity-30" />
                <p className="text-sm">Select a locality and configure roles to get AI recommendations</p>
              </div>
            ) : (
              <div className="space-y-2">
                <AnimatePresence>
                  {recommendations.map((rec, i) => {
                    const isSelected = selectedStaff.includes(rec.volunteerId);
                    return (
                      <motion.div
                        key={rec.volunteerId}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.05 }}
                        whileHover={{ x: 3 }}
                        onClick={() => toggleStaff(rec.volunteerId)}
                        className={`p-3 rounded-xl border-2 cursor-pointer transition-all flex items-center gap-3 ${
                          isSelected
                            ? 'border-[#2D6A4F] bg-secondary-pale'
                            : 'border-[#E5E2DC] hover:border-[#2D6A4F]/30'
                        }`}
                      >
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0 ${isSelected ? 'bg-[#2D6A4F] text-white' : 'bg-[#FAF9F6] text-[#6B7280]'}`}>
                          {isSelected ? <Check className="w-5 h-5" /> : getInitials(rec.volunteerName)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-sm text-[#1A1A1A] truncate">{rec.volunteerName}</p>
                            <span className="badge text-[10px] bg-[#FAF9F6] text-[#6B7280] border-[#E5E2DC]">{roleLabel(rec.role)}</span>
                          </div>
                          <p className="text-xs text-[#6B7280] mt-0.5 truncate">{rec.reasoning}</p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <div className="flex items-center gap-1">
                            <Star className="w-3 h-3 text-[#F4A261]" />
                            <span className="text-sm font-bold text-[#1A1A1A]">{rec.matchScore}</span>
                          </div>
                          <p className="text-[10px] text-[#6B7280]">match</p>
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            )}
          </div>

          {/* Create Camp Button */}
          {recommendations.length > 0 && (
            <motion.button
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              whileHover={{ scale: 1.02, y: -2 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleCreateCamp}
              disabled={isSaving || !campTitle || !campDate}
              className="w-full btn-secondary py-3.5 text-base disabled:opacity-50"
            >
              {isSaving ? (
                <><Loader2 className="w-5 h-5 animate-spin" /> Creating Camp Plan...</>
              ) : (
                <><Plus className="w-5 h-5" /> Create Camp Plan ({selectedStaff.length} staff assigned)</>
              )}
            </motion.button>
          )}
        </motion.div>
      </div>
    </PageShell>
  );
}
