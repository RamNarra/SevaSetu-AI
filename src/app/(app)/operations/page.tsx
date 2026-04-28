'use client';

import PageShell from '@/components/layout/PageShell';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Clock, Package, MapPin, Loader2, AlertTriangle, User,
  CheckCircle2, Syringe, Plus, ClipboardList
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { subscribeToCollection, getCollection } from '@/lib/firebase/firestore';
import { VolunteerProfile } from '@/types';
import toast from 'react-hot-toast';

interface AssignmentEvent {
  timestamp: string;
  type: string;
  message: string;
  actor: string;
}

interface ActiveAssignment {
  id: string;
  volunteerId: string;
  campId: string;
  role: string;
  assignedAt: { seconds: number; nanoseconds: number } | string | Date;
  eventLog?: AssignmentEvent[];
  // Joined fields
  volunteer?: VolunteerProfile;
  hoursElapsed?: number;
}

interface MedicineStock {
  id: string;
  name: string;
  currentStock: number;
}

export default function ActiveDeploymentsPage() {
  const [assignments, setAssignments] = useState<ActiveAssignment[]>([]);
  const [volunteers, setVolunteers] = useState<Map<string, VolunteerProfile>>(new Map());
  const [loading, setLoading] = useState(true);
  const [medicines, setMedicines] = useState<MedicineStock[]>([]);
  const [selectedAssignment, setSelectedAssignment] = useState<ActiveAssignment | null>(null);

  const [dispenseMedicineId, setDispenseMedicineId] = useState('');
  const [dispenseAmount, setDispenseAmount] = useState(1);
  const [dispensing, setDispensing] = useState(false);

  useEffect(() => {
    // Preload volunteers and stock
    Promise.all([
      getCollection<VolunteerProfile>('volunteer_profiles'),
      getCollection<MedicineStock>('medicine_stock')
    ]).then(([volData, medData]) => {
      const vMap = new Map();
      volData.forEach(v => vMap.set(v.userId || v.id, v));
      setVolunteers(vMap);
      setMedicines(medData);
    });

    // Real-time listener for assignments
    const unsub = subscribeToCollection<ActiveAssignment>(
      'assignments',
      (data) => {
        setAssignments(data);
        setLoading(false);
        // Refresh medicines as well just in case stock changes
        getCollection<MedicineStock>('medicine_stock').then(setMedicines);
      }
    );

    return unsub;
  }, []);

  const handleDispense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAssignment || !dispenseMedicineId || dispenseAmount <= 0) return;
    setDispensing(true);

    try {
      const res = await fetch('/api/operations/dispense', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assignmentId: selectedAssignment.id,
          medicineId: dispenseMedicineId,
          amountDispensed: dispenseAmount,
          dispensedBy: selectedAssignment.volunteer?.displayName || 'Unknown'
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      toast.success('Dispense logged via transaction successfully');
      setDispenseAmount(1);
      setDispenseMedicineId('');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Error logging dispense');
    } finally {
      setDispensing(false);
    }
  };

  const enrichAssignment = (a: ActiveAssignment) => {
    const vol = volunteers.get(a.volunteerId) || Object.values(Object.fromEntries(volunteers)).find(v => v.id === a.volunteerId);
    let msElapsed = 0;
    if (a.assignedAt) {
      const timeMs = 
        typeof a.assignedAt === 'object' && 'seconds' in a.assignedAt 
          ? a.assignedAt.seconds * 1000 
          : new Date(a.assignedAt).getTime();
      msElapsed = Date.now() - timeMs;
    }
    return {
      ...a,
      volunteer: vol,
      hoursElapsed: msElapsed / (1000 * 60 * 60)
    };
  };

  const activeAssignments = assignments.map(enrichAssignment).filter(a => a.hoursElapsed !== undefined && a.hoursElapsed >= 0);

  if (loading) {
    return (
      <PageShell title="Operations Center" subtitle="Live Deployment Tracking">
        <div className="flex justify-center items-center h-64"><Loader2 className="w-8 h-8 text-[#D4622B] animate-spin" /></div>
      </PageShell>
    );
  }

  return (
    <PageShell title="Operations Center" subtitle="Live Deployment Tracking">
      
  {/* PHASE 3.4: Operations Center elements */}
  <div className="bg-white p-4 rounded-xl border border-gray-200 mb-6">
    <div className="flex justify-between items-center mb-4">
      <h2 className="font-bold text-xl">Real-time Patient Flow</h2>
      <div className="flex items-center gap-2">
        <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded">Offline Mode Queue: 0</span>
        <span className="px-2 py-1 bg-red-100 text-red-600 text-xs rounded">SLA Alert: Triage &gt; 30m</span>
      </div>
    </div>
    <div className="flex gap-4">
      <button className="text-sm bg-purple-100 text-purple-700 px-3 py-1 rounded">View Audit Trail</button>
      <button className="text-sm bg-orange-100 text-orange-700 px-3 py-1 rounded">Medicine Depletion Forecast</button>
      <button className="text-sm bg-gray-100 text-gray-700 px-3 py-1 rounded">Conflict Resolution Drawer</button>
    </div>
  </div>

<div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Kanban / Deployment Tracking */}
        <div className="col-span-2">
          <div className="bg-white rounded-xl shadow-sm border border-[#E5E2DC] p-5">
            <h2 className="text-lg font-bold text-[#1A1A1A] mb-4 flex items-center justify-between">
              Active Deployments
              <span className="text-sm font-normal px-3 py-1 bg-[#D4622B]/10 text-[#D4622B] rounded-full">
                {activeAssignments.length} On Ground
              </span>
            </h2>

            {activeAssignments.length === 0 ? (
              <div className="text-center py-10 text-[#6B7280] border-2 border-dashed border-[#E5E2DC] rounded-xl bg-[#FAFAFA]">
                No active deployments right now
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <AnimatePresence mode="popLayout">
                  {activeAssignments.map((a) => {
                    const isStuck = a.hoursElapsed! >= 4.0;
                    
                    return (
                      <motion.div
                        key={a.id}
                        layout
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className={`relative p-4 rounded-xl border ${
                          isStuck 
                            ? 'border-red-500 bg-red-50/50 shadow-[0_0_15px_rgba(239,68,68,0.15)]' 
                            : 'border-[#E5E2DC] bg-[#FAFAFA]'
                        } cursor-pointer hover:border-[#D4622B] transition-all`}
                        onClick={() => setSelectedAssignment(a)}
                      >
                        {isStuck && (
                          <div className="absolute -top-2 -right-2 bg-red-600 text-white p-1.5 rounded-full animate-pulse shadow-md z-10">
                            <AlertTriangle className="w-3 h-3" />
                          </div>
                        )}

                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-[#1B2E25] text-white flex items-center justify-center font-bold text-xs shrink-0">
                              <User className="w-4 h-4" />
                            </div>
                            <div>
                              <h3 className="text-sm font-bold text-[#1A1A1A]">{a.volunteer?.displayName || 'Unknown Volunteer'}</h3>
                              <p className="text-xs text-[#6B7280]">{a.role}</p>
                            </div>
                          </div>
                        </div>

                        <div className="space-y-2 mt-4">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-[#6B7280] flex items-center gap-1"><MapPin className="w-3 h-3" /> Camp</span>
                            <span className="font-semibold text-[#1A1A1A] truncate max-w-[120px]">{a.campId}</span>
                          </div>
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-[#6B7280] flex items-center gap-1"><Clock className="w-3 h-3" /> Duration</span>
                            <span className={`font-bold ${isStuck ? 'text-red-600' : 'text-[#65A30D]'}`}>
                              {a.hoursElapsed!.toFixed(1)} hrs
                            </span>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            )}
          </div>
        </div>

        {/* Audit Trail & Tracking Console */}
        <div className="col-span-1">
          <div className="bg-white rounded-xl shadow-sm border border-[#E5E2DC] p-5 h-full flex flex-col">
            <h2 className="text-lg font-bold text-[#1A1A1A] mb-4 flex items-center gap-2">
              <ClipboardList className="w-5 h-5 text-[#2D6A4F]" /> Tracking Console
            </h2>

            {!selectedAssignment ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center opacity-60 py-10">
                <Package className="w-12 h-12 mb-3 text-[#D4622B]" />
                <p className="text-sm">Select an active deployment to log events and view history</p>
              </div>
            ) : (
              <div className="flex-1 flex flex-col space-y-6">
                
                {/* Active Assignment Header */}
                <div className="p-3 bg-[#FAFAFA] rounded-lg border border-[#E5E2DC]">
                  <h3 className="font-bold text-sm text-[#1A1A1A]">{selectedAssignment.volunteer?.displayName || 'Unknown'}</h3>
                  <p className="text-xs text-[#6B7280]">{selectedAssignment.role}</p>
                </div>

                {/* Dispense Action */}
                <div className="bg-[#FAF9F6] p-4 rounded-xl border border-[#D4622B]/20">
                  <h4 className="text-sm font-bold text-[#1A1A1A] mb-3 flex items-center gap-2">
                    <Syringe className="w-4 h-4 text-[#D4622B]" /> Log Dispense Event
                  </h4>
                  <form onSubmit={handleDispense} className="space-y-3">
                    <select 
                      value={dispenseMedicineId} 
                      onChange={e => setDispenseMedicineId(e.target.value)}
                      className="w-full text-sm p-2 rounded-lg border border-[#E5E2DC] outline-none focus:ring-2 focus:ring-[#D4622B]/50"
                      required
                    >
                      <option value="">Select Item...</option>
                      {medicines.map(m => (
                        <option value={m.id} key={m.id}>{m.name} (Stock: {m.currentStock})</option>
                      ))}
                    </select>

                    <div className="flex gap-2">
                      <input 
                        type="number" 
                        min="1" 
                        value={dispenseAmount}
                        onChange={e => setDispenseAmount(Number(e.target.value))}
                        className="w-20 text-sm p-2 rounded-lg border border-[#E5E2DC]"
                        required
                      />
                      <button 
                        type="submit" 
                        disabled={dispensing || !dispenseMedicineId}
                        className="flex-1 bg-[#D4622B] text-white text-sm font-medium py-2 rounded-lg hover:bg-[#B34D20] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        {dispensing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                        Log Event
                      </button>
                    </div>
                  </form>
                </div>

                {/* Live Event Log */}
                <div className="flex-1">
                  <h4 className="text-xs font-bold text-[#1B2E25]/60 uppercase tracking-wider mb-4 border-b border-[#E5E2DC] pb-2">Live Event Log</h4>
                  
                  {(!selectedAssignment.eventLog || selectedAssignment.eventLog.length === 0) ? (
                    <p className="text-xs text-center text-[#6B7280] py-4">No events logged yet.</p>
                  ) : (
                    <div className="space-y-4">
                      {selectedAssignment.eventLog.map((ev, i) => (
                        <div key={i} className="flex items-start gap-3">
                          <div className="w-6 h-6 rounded-full bg-[#1B2E25]/10 flex flex-col items-center justify-center shrink-0 mt-0.5">
                            <CheckCircle2 className="w-3.5 h-3.5 text-[#1B2E25]" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className="text-xs font-bold text-[#1A1A1A]">{ev.type}</span>
                              <span className="text-[10px] bg-[#FAFAFA] border border-[#E5E2DC] px-1.5 py-0.5 rounded text-[#6B7280]">
                                {new Date(ev.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                            <p className="text-xs text-[#1A1A1A]/80 leading-snug">{ev.message}</p>
                            {ev.actor && <p className="text-[10px] text-[#6B7280] mt-1 line-clamp-1">— {ev.actor}</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

              </div>
            )}
          </div>
        </div>

      </div>
    </PageShell>
  );
}
