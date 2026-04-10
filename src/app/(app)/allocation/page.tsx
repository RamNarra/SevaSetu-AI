'use client';
import PageShell from '@/components/layout/PageShell';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, Star, Filter, Search, CheckCircle2, X, MapPin } from 'lucide-react';
import { useEffect, useState } from 'react';
import { getCollection, getDocument } from '@/lib/firebase/firestore';
import { VolunteerProfile, Assignment, CampPlan, UserRole } from '@/types';
import { roleLabel, getInitials, urgencyBgColor } from '@/lib/utils';

const roleFilters = [
  { value: 'ALL', label: 'All Roles' },
  { value: UserRole.DOCTOR, label: '🩺 Doctors' },
  { value: UserRole.PHARMACIST, label: '💊 Pharmacists' },
  { value: UserRole.FIELD_VOLUNTEER, label: '📋 Field' },
  { value: UserRole.SUPPORT, label: '🤝 Support' },
];

export default function AllocationPage() {
  const [volunteers, setVolunteers] = useState<VolunteerProfile[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedVol, setSelectedVol] = useState<VolunteerProfile | null>(null);

  useEffect(() => {
    Promise.all([
      getCollection<VolunteerProfile>('volunteer_profiles'),
      getCollection<Assignment>('assignments'),
    ]).then(([vols, asgns]) => {
      setVolunteers(vols);
      setAssignments(asgns);
      setLoading(false);
    });
  }, []);

  const filtered = volunteers.filter((vol) => {
    if (roleFilter !== 'ALL' && vol.role !== roleFilter) return false;
    if (searchQuery && !vol.displayName.toLowerCase().includes(searchQuery.toLowerCase()) &&
      !vol.skills.some((s) => s.toLowerCase().includes(searchQuery.toLowerCase()))) return false;
    return true;
  });

  const available = filtered.filter((v) => v.availability === 'AVAILABLE');
  const busy = filtered.filter((v) => v.availability === 'BUSY');
  const onLeave = filtered.filter((v) => v.availability === 'ON_LEAVE');

  return (
    <PageShell title="Volunteer Allocation" subtitle="Manage and assign volunteers to camp roles">
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
          { label: 'On Leave', count: onLeave.length, color: '#6B7280' },
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
            ) : filtered.length === 0 ? (
              <div className="col-span-full card text-center py-12 text-[#6B7280]">
                <Users className="w-8 h-8 mx-auto mb-2 opacity-30" /><p className="text-sm">No volunteers match your filters</p>
              </div>
            ) : (
              filtered.map((vol, i) => (
                <motion.div
                  key={vol.id || vol.userId}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                  whileHover={{ y: -3, boxShadow: '0 10px 25px -5px rgba(0,0,0,0.08)' }}
                  onClick={() => setSelectedVol(vol)}
                  className={`card cursor-pointer ${selectedVol?.userId === vol.userId ? 'ring-2 ring-[#D4622B]' : ''}`}
                >
                  <div className="flex items-center gap-3 mb-3">
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

                  <div className="flex flex-wrap gap-1 mb-3">
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
              ))
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
