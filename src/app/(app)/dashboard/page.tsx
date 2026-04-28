'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import PageShell from '@/components/layout/PageShell';
import { useAuth } from '@/contexts/AuthContext';
import {
  Activity,
  Users,
  MapPin,
  FileText,
  CalendarRange,
  ArrowRight,
  AlertTriangle,
} from 'lucide-react';
import { getCollection } from '@/lib/firebase/firestore';
import { Locality, CampPlan, ExtractedSignal, VolunteerProfile } from '@/types';
import { urgencyBgColor, formatDate } from '@/lib/utils';
import Link from 'next/link';
import DemoTour from '@/components/demo/DemoTour';

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } },
};

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5 } },
};

function MetricCard({ icon: Icon, label, value, color, delay }: {
  icon: React.ElementType; label: string; value: string | number; color: string; delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.5 }}
      whileHover={{ y: -3, boxShadow: '0 10px 25px -5px rgba(0,0,0,0.08)' }}
      className="card flex items-center gap-4"
    >
      <div
        className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ background: `${color}15` }}
      >
        <Icon className="w-6 h-6" style={{ color }} />
      </div>
      <div>
        <p className="text-2xl font-bold text-[#1A1A1A]">{value}</p>
        <p className="text-sm text-[#6B7280]">{label}</p>
      </div>
    </motion.div>
  );
}

export default function DashboardPage() {
  const { userDoc } = useAuth();
  const [localities, setLocalities] = useState<Locality[]>([]);
  const [camps, setCamps] = useState<CampPlan[]>([]);
  const [reports, setReports] = useState<ExtractedSignal[]>([]);
  const [volunteers, setVolunteers] = useState<VolunteerProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const [locs, cps, reps, vols] = await Promise.all([
          getCollection<Locality>('localities'),
          getCollection<CampPlan>('camp_plans'),
          getCollection<ExtractedSignal>('extracted_reports'),
          getCollection<VolunteerProfile>('volunteer_profiles'),
        ]);
        setLocalities(locs);
        setCamps(cps);
        setReports(reps);
        setVolunteers(vols);
      } catch (error) {
        console.error('Dashboard load error:', error);
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, []);

  const topLocalities = [...localities].sort((a, b) => b.urgencyScore - a.urgencyScore).slice(0, 5);
  const upcomingCamp = camps.find((c) => c.status === 'PLANNED' || c.status === 'DRAFT');
  const activeCamp = camps.find((c) => c.status === 'ACTIVE');

  return (
    <PageShell
      title={`Welcome back, ${userDoc?.displayName?.split(' ')[0] || 'Coordinator'}`}
      subtitle="Here's your operations overview"
    >
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="card">
              <div className="skeleton h-16 w-full" />
            </div>
          ))}
        </div>
      ) : (
        <>
          {/* Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <MetricCard icon={MapPin} label="Tracked Localities" value={localities.length} color="#D4622B" delay={0} />
            <MetricCard icon={FileText} label="Field Reports" value={reports.length} color="#F4A261" delay={0.1} />
            <MetricCard icon={Users} label="Volunteers" value={volunteers.length} color="#2D6A4F" delay={0.2} />
            <MetricCard icon={CalendarRange} label="Camps Planned" value={camps.length} color="#D97706" delay={0.3} />
          </div>

          <div className="grid lg:grid-cols-3 gap-6">
            {/* Top Localities by Urgency */}
            <motion.div
              initial="hidden"
              animate="show"
              variants={stagger}
              className="lg:col-span-2 card !p-0"
              id="priority-localities"
            >
              <div className="flex items-center justify-between p-5 pb-0">
                <div>
                  <h3 className="font-semibold text-[#1A1A1A]">Priority Localities</h3>
                  <p className="text-xs text-[#6B7280] mt-0.5">Ranked by urgency score</p>
                </div>
                <Link href="/localities" className="text-sm text-[#D4622B] font-medium hover:underline flex items-center gap-1">
                  View all <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>

              <div className="p-5 space-y-3">
                {topLocalities.length === 0 ? (
                  <div className="text-center py-12 px-6">
                    <div className="w-16 h-16 rounded-3xl bg-[#F0EDE8] flex items-center justify-center mx-auto mb-4">
                      <MapPin className="w-8 h-8 text-[#6B7280] opacity-40" />
                    </div>
                    <h4 className="text-lg font-bold text-[#1A1A1A]">No localities tracked yet</h4>
                    <p className="text-sm text-[#6B7280] mt-2 max-w-xs mx-auto">
                      Start by adding a locality or use our demo dataset to see the platform in action.
                    </p>
                    <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
                      <Link href="/admin">
                        <button className="btn-primary w-full sm:w-auto px-8">
                          Seed Demo Data
                        </button>
                      </Link>
                      <button className="btn-outline w-full sm:w-auto">
                        Add Manually
                      </button>
                    </div>
                  </div>
                ) : (
                  topLocalities.map((loc, i) => (
                    <motion.div
                      key={loc.id}
                      variants={fadeUp}
                      className="flex items-center gap-4 p-3 rounded-xl hover:bg-[#FAF9F6] transition-colors"
                    >
                      <span className="text-sm font-bold text-[#6B7280] w-6 text-center">
                        {i + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-[#1A1A1A] truncate">{loc.name}</p>
                        <p className="text-xs text-[#6B7280]">{loc.district}, {loc.state}</p>
                      </div>
                      <span className={`badge ${urgencyBgColor(loc.urgencyLevel)}`}>
                        {loc.urgencyLevel}
                      </span>
                      <div className="w-16 text-right">
                        <span className="text-lg font-bold text-[#1A1A1A]">{loc.urgencyScore}</span>
                        <span className="text-xs text-[#6B7280]">/100</span>
                      </div>
                    </motion.div>
                  ))
                )}
              </div>
            </motion.div>

            {/* Upcoming Camp */}
            <div className="space-y-6">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="card"
                id="next-camp"
              >
                <div className="flex items-center gap-2 mb-4">
                  <CalendarRange className="w-5 h-5 text-[#2D6A4F]" />
                  <h3 className="font-semibold text-[#1A1A1A]">Next Camp</h3>
                </div>
                {upcomingCamp ? (
                  <div>
                    <p className="font-medium text-[#1A1A1A]">{upcomingCamp.title}</p>
                    <p className="text-sm text-[#6B7280] mt-1">{upcomingCamp.localityName}</p>
                    <p className="text-sm text-[#6B7280]">
                      {formatDate(upcomingCamp.scheduledDate)}
                    </p>
                    <div className="mt-3 flex items-center gap-2 text-sm">
                      <Users className="w-4 h-4 text-[#6B7280]" />
                      <span className="text-[#6B7280]">
                        {upcomingCamp.assignedStaff.length} staff assigned
                      </span>
                    </div>
                    <Link href="/planner">
                      <button className="mt-4 w-full btn-outline text-sm py-2">
                        Open Planner <ArrowRight className="w-4 h-4" />
                      </button>
                    </Link>
                  </div>
                ) : (
                  <div className="text-center py-4 text-[#6B7280]">
                    <CalendarRange className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    <p className="text-sm">No upcoming camps</p>
                    <Link href="/planner">
                      <button className="mt-3 btn-primary text-xs py-2 px-4">
                        Plan a Camp
                      </button>
                    </Link>
                  </div>
                )}
              </motion.div>

              {/* Active Camp */}
              {activeCamp && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                  className="card border-[#2D6A4F] bg-secondary-pale"
                  id="active-camp"
                >
                  <div className="flex items-center gap-2 mb-3">
                    <Activity className="w-5 h-5 text-[#2D6A4F]" />
                    <h3 className="font-semibold text-[#2D6A4F]">Camp Active</h3>
                  </div>
                  <p className="font-medium text-[#1A1A1A]">{activeCamp.title}</p>
                  <Link href="/operations">
                    <button className="mt-3 w-full btn-secondary text-sm py-2">
                      Go to Operations <ArrowRight className="w-4 h-4" />
                    </button>
                  </Link>
                </motion.div>
              )}

              {/* Quick Alert */}
              {topLocalities.some((l) => l.urgencyLevel === 'CRITICAL') && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.5 }}
                  className="card border-urgency-critical/20 urgency-critical"
                  id="critical-alert"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="w-5 h-5 text-urgency-critical" />
                    <h3 className="font-semibold text-urgency-critical">Critical Alert</h3>
                  </div>
                  <p className="text-sm text-[#6B7280]">
                    {topLocalities.filter((l) => l.urgencyLevel === 'CRITICAL').length} localities
                    need immediate attention.
                  </p>
                </motion.div>
              )}
            </div>
          </div>
        </>
      )}
      <DemoTour />
    </PageShell>
  );
}
