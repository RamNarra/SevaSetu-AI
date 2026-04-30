'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Shield, Database, Loader2, CheckCircle2, AlertTriangle, Trash2, Sparkles } from 'lucide-react';
import PageShell from '@/components/layout/PageShell';
import { useAuth } from '@/contexts/AuthContext';
import toast from 'react-hot-toast';
import { demoDb } from '@/lib/firebase/demo';
import { authFetch } from '@/lib/firebase/authFetch';

export default function AdminPage() {
  const { userDoc } = useAuth();
  const [isSeeding, setIsSeeding] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [seedResults, setSeedResults] = useState<string[]>([]);

  if (userDoc?.role !== 'COORDINATOR') {
    return (
      <PageShell title="Admin" subtitle="Coordinator access required">
        <div className="card py-16 text-center">
          <Shield className="mx-auto mb-4 h-12 w-12 text-[#6B7280] opacity-30" />
          <p className="text-[#6B7280]">Only coordinators can access admin tools.</p>
        </div>
      </PageShell>
    );
  }

  async function handleSeedData() {
    setIsSeeding(true);
    setSeedResults([]);

    try {
      const response = await authFetch('/api/admin/seed', { method: 'POST' });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Seed request failed');
      }

      const results = Array.isArray(data.results)
        ? data.results.map((result: string) => `[OK] ${result}`)
        : [];

      setSeedResults(results);
      toast.success('All demo data seeded successfully!');
    } catch (error) {
      console.error('Seed error:', error);
      const message = error instanceof Error ? error.message : String(error);
      setSeedResults([`[ERR] ${message}`]);
      toast.error('Seeding failed. Check console for details.');
    } finally {
      setIsSeeding(false);
    }
  }

  async function handleClearData() {
    if (!confirm('Are you sure you want to clear ALL seeded data? This cannot be undone.')) return;

    setIsClearing(true);

    try {
      const response = await authFetch('/api/admin/seed', { method: 'DELETE' });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Clear request failed');
      }

      setSeedResults([]);
      toast.success('All data cleared');
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
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="card border-[#D4622B] bg-primary-pale"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Sparkles className="h-5 w-5 text-[#D4622B]" />
              <div>
                <h3 className="font-semibold text-[#1A1A1A]">Demo Mode</h3>
                <p className="text-xs text-[#6B7280]">Bypass Firebase and use static data for presentations</p>
              </div>
            </div>
            <button
              onClick={() => (demoDb.isDemoMode() ? demoDb.disable() : demoDb.enable())}
              className={`rounded-xl px-4 py-2 text-sm font-bold transition-all ${
                demoDb.isDemoMode()
                  ? 'bg-[#D4622B] text-white shadow-lg'
                  : 'border border-[#E5E2DC] bg-white text-[#6B7280]'
              }`}
            >
              {demoDb.isDemoMode() ? 'Demo Mode: ON' : 'Turn On Demo Mode'}
            </button>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="card"
        >
          <div className="mb-4 flex items-center gap-3">
            <Database className="h-5 w-5 text-[#D4622B]" />
            <h3 className="font-semibold text-[#1A1A1A]">Seed Demo Data</h3>
          </div>
          <p className="mb-4 text-sm text-[#6B7280]">
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
              {isSeeding ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Seeding...
                </>
              ) : (
                <>
                  <Database className="h-4 w-4" /> Seed All Data
                </>
              )}
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleClearData}
              disabled={isClearing}
              className="btn-outline px-4 py-3 text-red-600 hover:border-red-300 hover:bg-red-50"
            >
              {isClearing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            </motion.button>
          </div>
        </motion.div>

        {seedResults.length > 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="card">
            <h3 className="mb-3 font-semibold text-[#1A1A1A]">Seed Progress</h3>
            <div className="space-y-2">
              {seedResults.map((result, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="flex items-center gap-2 text-sm"
                >
                  {result.startsWith('[OK]') ? (
                    <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-green-600" />
                  ) : (
                    <AlertTriangle className="h-4 w-4 flex-shrink-0 text-red-600" />
                  )}
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
