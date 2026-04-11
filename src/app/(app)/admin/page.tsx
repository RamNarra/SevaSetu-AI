'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Shield, Database, Loader2, CheckCircle2, AlertTriangle, Trash2 } from 'lucide-react';
import PageShell from '@/components/layout/PageShell';
import { batchWrite, Timestamp } from '@/lib/firebase/firestore';
import { seedLocalities, seedVolunteers, seedReports, seedCampPlans, seedPatientVisits, seedMedicineStock } from '@/data/seed';
import { useAuth } from '@/contexts/AuthContext';
import toast from 'react-hot-toast';
import { collection, getDocs, writeBatch, doc } from 'firebase/firestore/lite';
import { db } from '@/lib/firebase/config';

export default function AdminPage() {
  const { userDoc } = useAuth();
  const [isSeeding, setIsSeeding] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [seedResults, setSeedResults] = useState<string[]>([]);

  if (userDoc?.role !== 'COORDINATOR') {
    return (
      <PageShell title="Admin" subtitle="Coordinator access required">
        <div className="card text-center py-16">
          <Shield className="w-12 h-12 mx-auto mb-4 text-[#6B7280] opacity-30" />
          <p className="text-[#6B7280]">Only coordinators can access admin tools.</p>
        </div>
      </PageShell>
    );
  }

  async function handleSeedData() {
    setIsSeeding(true);
    setSeedResults([]);
    const results: string[] = [];

    try {
      // Seed Localities
      const locOps = seedLocalities.map((loc, i) => ({
        collection: 'localities',
        docId: `loc_${loc.name.toLowerCase().replace(/\s+/g, '_')}`,
        data: loc,
      }));
      await batchWrite(locOps);
      results.push(`✅ ${locOps.length} localities seeded`);
      setSeedResults([...results]);

      // Seed Volunteers
      const volOps = seedVolunteers.map((vol) => ({
        collection: 'volunteer_profiles',
        docId: vol.userId,
        data: vol,
      }));
      await batchWrite(volOps);
      results.push(`✅ ${volOps.length} volunteers seeded`);
      setSeedResults([...results]);

      // Seed Reports
      const repOps = seedReports.map((rep, i) => ({
        collection: 'community_reports',
        docId: `report_${String(i + 1).padStart(3, '0')}`,
        data: { ...rep, submittedBy: userDoc?.uid || '', submitterName: userDoc?.displayName || '', createdAt: Timestamp.now() },
      }));
      await batchWrite(repOps);
      results.push(`✅ ${repOps.length} reports seeded`);
      setSeedResults([...results]);

      // Seed Camp Plans
      const campOps = seedCampPlans.map((camp, i) => ({
        collection: 'camp_plans',
        docId: i === 0 ? 'camp_planned' : 'camp_completed',
        data: { ...camp, coordinatorId: userDoc?.uid || '' },
      }));
      await batchWrite(campOps);
      results.push(`✅ ${campOps.length} camp plans seeded`);
      setSeedResults([...results]);

      // Seed Patient Visits
      const visitOps = seedPatientVisits.map((visit, i) => ({
        collection: 'patient_visits',
        docId: `visit_${String(i + 1).padStart(3, '0')}`,
        data: { ...visit, timestamps: { registered: Timestamp.now() } },
      }));
      await batchWrite(visitOps);
      results.push(`✅ ${visitOps.length} patient visits seeded`);
      setSeedResults([...results]);

      // Seed Medicine Stock
      const medOps = seedMedicineStock.map((med, i) => ({
        collection: 'medicine_stock',
        docId: `med_${String(i + 1).padStart(3, '0')}`,
        data: med,
      }));
      await batchWrite(medOps);
      results.push(`✅ ${medOps.length} medicine stock items seeded`);
      setSeedResults([...results]);

      toast.success('All demo data seeded successfully!');
    } catch (error) {
      console.error('Seed error:', error);
      results.push(`❌ Error: ${error}`);
      setSeedResults([...results]);
      toast.error('Seeding failed — check console for details');
    } finally {
      setIsSeeding(false);
    }
  }

  async function handleClearData() {
    if (!confirm('Are you sure you want to clear ALL seeded data? This cannot be undone.')) return;
    setIsClearing(true);
    const collections = ['localities', 'volunteer_profiles', 'community_reports', 'camp_plans', 'patient_visits', 'medicine_stock', 'dispense_logs', 'followups'];

    try {
      for (const col of collections) {
        const snap = await getDocs(collection(db, col));
        const batch = writeBatch(db);
        snap.docs.forEach((d) => batch.delete(doc(db, col, d.id)));
        await batch.commit();
      }
      toast.success('All data cleared');
      setSeedResults([]);
    } catch (error) {
      console.error('Clear error:', error);
      toast.error('Failed to clear data');
    } finally {
      setIsClearing(false);
    }
  }

  return (
    <PageShell title="Admin Panel" subtitle="Seed demo data and manage the database">
      <div className="max-w-2xl space-y-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="card">
          <div className="flex items-center gap-3 mb-4">
            <Database className="w-5 h-5 text-[#D4622B]" />
            <h3 className="font-semibold text-[#1A1A1A]">Seed Demo Data</h3>
          </div>
          <p className="text-sm text-[#6B7280] mb-4">
            Populate Firestore with realistic health camp data for the demo. Includes 6 localities,
            15 volunteers, 10 reports, 2 camp plans, 12 patient visits, and 12 medicine stock items.
          </p>

          <div className="flex gap-3">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleSeedData}
              disabled={isSeeding}
              className="btn-primary flex-1 py-3 disabled:opacity-50"
            >
              {isSeeding ? <><Loader2 className="w-4 h-4 animate-spin" /> Seeding...</> : <><Database className="w-4 h-4" /> Seed All Data</>}
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleClearData}
              disabled={isClearing}
              className="btn-outline py-3 px-4 text-red-600 hover:border-red-300 hover:bg-red-50"
            >
              {isClearing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
            </motion.button>
          </div>
        </motion.div>

        {seedResults.length > 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="card">
            <h3 className="font-semibold text-[#1A1A1A] mb-3">Seed Progress</h3>
            <div className="space-y-2">
              {seedResults.map((result, i) => (
                <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.1 }} className="flex items-center gap-2 text-sm">
                  {result.startsWith('✅') ? <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" /> : <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0" />}
                  <span className="text-[#1A1A1A]">{result}</span>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </div>
    </PageShell>
  );
}
