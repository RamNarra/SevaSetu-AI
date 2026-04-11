'use client';
import PageShell from '@/components/layout/PageShell';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Activity, ClipboardList, Stethoscope, Pill, PhoneForwarded,
  ArrowRight, ChevronRight, UserPlus, Clock, AlertTriangle,
  CheckCircle2, Loader2
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { subscribeToCollection, updateDocument, getCollection, addDocument, where } from '@/lib/firebase/firestore';
import { PatientVisit, VisitStage, CampPlan, MedicineStock, UrgencyLevel } from '@/types';
import { urgencyBgColor } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { Timestamp } from 'firebase/firestore/lite';
import toast from 'react-hot-toast';

const stages = [
  { key: VisitStage.REGISTERED, label: 'Registration', icon: ClipboardList, color: '#D4622B' },
  { key: VisitStage.TRIAGED, label: 'Triage', icon: Activity, color: '#D97706' },
  { key: VisitStage.IN_CONSULTATION, label: 'Consultation', icon: Stethoscope, color: '#2D6A4F' },
  { key: VisitStage.AT_PHARMACY, label: 'Pharmacy', icon: Pill, color: '#7C3AED' },
  { key: VisitStage.COMPLETED, label: 'Completed', icon: CheckCircle2, color: '#65A30D' },
];

const nextStageMap: Record<string, VisitStage | null> = {
  [VisitStage.REGISTERED]: VisitStage.TRIAGED,
  [VisitStage.TRIAGED]: VisitStage.IN_CONSULTATION,
  [VisitStage.IN_CONSULTATION]: VisitStage.AT_PHARMACY,
  [VisitStage.AT_PHARMACY]: VisitStage.COMPLETED,
  [VisitStage.COMPLETED]: null,
};

export default function OperationsPage() {
  const [visits, setVisits] = useState<PatientVisit[]>([]);
  const [camps, setCamps] = useState<CampPlan[]>([]);
  const [activeCampId, setActiveCampId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [movingId, setMovingId] = useState<string | null>(null);

  useEffect(() => {
    getCollection<CampPlan>('camp_plans').then((data) => {
      setCamps(data);
      // Prefer ACTIVE camp, then PLANNED camp with assigned patient visits
      const active = data.find((c) => c.status === 'ACTIVE')
        || data.sort((a, b) => (b.predictedTurnout || 0) - (a.predictedTurnout || 0)).find((c) => c.status === 'PLANNED');
      if (active?.id) setActiveCampId(active.id);
    });
  }, []);

  // Real-time listener for patient visits
  useEffect(() => {
    if (!activeCampId) {
      // Load all visits if no specific camp
      const unsub = subscribeToCollection<PatientVisit>(
        'patient_visits',
        (data) => {
          setVisits(data);
          setLoading(false);
        }
      );
      return unsub;
    }

    const unsub = subscribeToCollection<PatientVisit>(
      'patient_visits',
      (data) => {
        setVisits(data);
        setLoading(false);
      },
      where('campId', '==', activeCampId)
    );

    return unsub;
  }, [activeCampId]);

  const { user } = useAuth();

  async function dispenseMedicines(visit: PatientVisit) {
    if (!visit.prescriptions || visit.prescriptions.length === 0 || !visit.campId) return;
    try {
      const stock = await getCollection<MedicineStock>('medicine_stock', where('campId', '==', visit.campId));
      for (const rx of visit.prescriptions) {
        const match = stock.find((m) => m.medicineName.toLowerCase().includes(rx.toLowerCase()) || rx.toLowerCase().includes(m.medicineName.toLowerCase()));
        if (match?.id) {
          await updateDocument('medicine_stock', match.id, {
            quantityDispensed: (match.quantityDispensed || 0) + 1,
          });
          await addDocument('dispense_logs', {
            visitId: visit.id,
            campId: visit.campId,
            medicineId: match.id,
            medicineName: match.medicineName,
            quantity: 1,
            dispensedBy: user?.uid || '',
            dispensedAt: Timestamp.now(),
          });
        }
      }
      if (visit.prescriptions.length > 0) {
        toast.success(`Dispensed ${visit.prescriptions.length} prescription(s) for ${visit.patientName}`);
      }
    } catch (err) {
      console.error('Dispense error:', err);
    }
  }

  async function moveToNextStage(visit: PatientVisit) {
    if (!visit.id) return;
    const nextStage = nextStageMap[visit.stage];
    if (!nextStage) return;

    setMovingId(visit.id);
    try {
      // Auto-dispense medicines when completing pharmacy stage
      if (visit.stage === VisitStage.AT_PHARMACY && nextStage === VisitStage.COMPLETED) {
        await dispenseMedicines(visit);
      }
      await updateDocument('patient_visits', visit.id, { stage: nextStage });
      toast.success(`${visit.patientName} → ${nextStage.replace('_', ' ')}`);
    } catch (error) {
      console.error(error);
      toast.error('Failed to update stage');
    } finally {
      setMovingId(null);
    }
  }

  const totalPatients = visits.length;
  const completed = visits.filter((v) => v.stage === VisitStage.COMPLETED).length;
  const critical = visits.filter((v) => v.triagePriority === 'CRITICAL').length;
  const activeCamp = camps.find((c) => c.id === activeCampId);

  return (
    <PageShell
      title="Camp Operations"
      subtitle="Real-time patient flow management"
      actions={
        <div className="flex items-center gap-3">
          {camps.length > 0 && (
            <select
              value={activeCampId}
              onChange={(e) => setActiveCampId(e.target.value)}
              className="px-3 py-2 rounded-xl border border-[#E5E2DC] text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#D4622B]/30"
            >
              <option value="">All Camps</option>
              {camps.map((c) => (
                <option key={c.id} value={c.id}>{c.title} ({c.status})</option>
              ))}
            </select>
          )}
        </div>
      }
    >
      {/* Live Stats Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {[
          { icon: UserPlus, label: 'Total Patients', value: totalPatients, color: '#D4622B' },
          { icon: CheckCircle2, label: 'Completed', value: completed, color: '#65A30D' },
          { icon: Clock, label: 'In Queue', value: totalPatients - completed, color: '#D97706' },
          { icon: AlertTriangle, label: 'Critical', value: critical, color: '#DC2626' },
        ].map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="card !p-3 flex items-center gap-3"
          >
            <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: `${stat.color}15` }}>
              <stat.icon className="w-4 h-4" style={{ color: stat.color }} />
            </div>
            <div>
              <p className="text-xl font-bold text-[#1A1A1A]">{stat.value}</p>
              <p className="text-xs text-[#6B7280]">{stat.label}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Kanban Columns */}
      <div className="flex gap-4 overflow-x-auto pb-4">
        {stages.map((stage, i) => {
          const stageVisits = visits
            .filter((v) => v.stage === stage.key)
            .sort((a, b) => {
              const prio = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
              return (prio[a.triagePriority as keyof typeof prio] || 3) - (prio[b.triagePriority as keyof typeof prio] || 3);
            });

          return (
            <motion.div
              key={stage.key}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
              className="flex-shrink-0 w-72"
            >
              {/* Column Header */}
              <div className="flex items-center gap-2 mb-3 px-1">
                <stage.icon className="w-4 h-4" style={{ color: stage.color }} />
                <h3 className="font-semibold text-sm text-[#1A1A1A]">{stage.label}</h3>
                <span className="ml-auto text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: `${stage.color}15`, color: stage.color }}>{stageVisits.length}</span>
              </div>

              {/* Column Body */}
              <div className="space-y-2 min-h-[400px] p-2 rounded-2xl bg-[#FAF9F6] border border-[#E5E2DC]">
                {loading ? (
                  Array(2).fill(0).map((_, j) => <div key={j} className="skeleton h-24 w-full" />)
                ) : stageVisits.length === 0 ? (
                  <p className="text-xs text-[#6B7280] text-center py-8 opacity-60">No patients</p>
                ) : (
                  <AnimatePresence mode="popLayout">
                    {stageVisits.map((visit) => (
                      <motion.div
                        key={visit.id}
                        layout
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9, x: 50 }}
                        whileHover={{ y: -2 }}
                        className="card !p-3 shadow-sm"
                      >
                        <div className="flex items-start justify-between mb-1">
                          <p className="font-medium text-sm text-[#1A1A1A]">{visit.patientName}</p>
                          <span className={`badge text-[10px] ${urgencyBgColor(visit.triagePriority)}`}>
                            {visit.triagePriority}
                          </span>
                        </div>
                        <p className="text-xs text-[#6B7280]">{visit.age}y, {visit.gender === 'M' ? 'Male' : visit.gender === 'F' ? 'Female' : 'Other'}</p>
                        <p className="text-xs text-[#6B7280] mt-1 line-clamp-2">{visit.chiefComplaint}</p>

                        {/* Tags */}
                        <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                          {visit.referralNeeded && (
                            <span className="badge text-[10px] bg-purple-50 text-purple-700 border-purple-200">
                              <PhoneForwarded className="w-2.5 h-2.5" /> Referral
                            </span>
                          )}
                          {visit.followupNeeded && (
                            <span className="badge text-[10px] bg-blue-50 text-blue-700 border-blue-200">Follow-up</span>
                          )}
                          {visit.prescriptions && visit.prescriptions.length > 0 && (
                            <span className="badge text-[10px] bg-green-50 text-green-700 border-green-200">
                              {visit.prescriptions.length} Rx
                            </span>
                          )}
                        </div>

                        {/* Move button */}
                        {stage.key !== VisitStage.COMPLETED && (
                          <motion.button
                            whileHover={{ scale: 1.03 }}
                            whileTap={{ scale: 0.97 }}
                            onClick={() => moveToNextStage(visit)}
                            disabled={movingId === visit.id}
                            className="mt-2 w-full flex items-center justify-center gap-1 py-1.5 rounded-lg text-xs font-medium transition-all disabled:opacity-50"
                            style={{
                              background: `${stage.color}10`,
                              color: stage.color,
                              border: `1px solid ${stage.color}30`,
                            }}
                          >
                            {movingId === visit.id ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <>Move <ChevronRight className="w-3 h-3" /></>
                            )}
                          </motion.button>
                        )}
                      </motion.div>
                    ))}
                  </AnimatePresence>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>
    </PageShell>
  );
}
