'use client';
import PageShell from '@/components/layout/PageShell';
import { motion } from 'framer-motion';
import {
  BarChart3, Users, Pill, AlertTriangle, CheckCircle2, Clock,
  Sparkles, Loader2, Calendar, MapPin, HeartPulse
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { getCollection } from '@/lib/firebase/firestore';
import { CampPlan, PatientVisit, MedicineStock, DispenseLog, Followup, VisitStage } from '@/types';
import toast from 'react-hot-toast';

/**
 * Simple markdown-to-HTML converter for AI summaries.
 * Handles headers, bold, lists, tables, and horizontal rules.
 */
function markdownToHtml(md: string): string {
  let html = md
    // Escape HTML
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    // Headers
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    // Horizontal rules
    .replace(/^---$/gm, '<hr />')
    // Bold
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    // Italic
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // Unordered lists
    .replace(/^\* (.+)$/gm, '<li>$1</li>')
    // Inline code
    .replace(/`([^`]+)`/g, '<code>$1</code>');

  // Wrap consecutive <li> in <ul>
  html = html.replace(/((?:<li>.*<\/li>\n?)+)/g, '<ul>$1</ul>');

  // Tables: detect lines with | and convert
  const lines = html.split('\n');
  const result: string[] = [];
  let inTable = false;
  for (const line of lines) {
    if (line.includes('|') && line.trim().startsWith('|')) {
      // Skip separator lines like | :--- | :--- |
      if (/^\|[\s:?-]+\|/.test(line.trim()) && !line.includes('<')) {
        continue;
      }
      const cells = line.split('|').filter((c) => c.trim() !== '');
      if (!inTable) {
        result.push('<table>');
        result.push('<tr>' + cells.map((c) => `<th>${c.trim()}</th>`).join('') + '</tr>');
        inTable = true;
      } else {
        result.push('<tr>' + cells.map((c) => `<td>${c.trim()}</td>`).join('') + '</tr>');
      }
    } else {
      if (inTable) {
        result.push('</table>');
        inTable = false;
      }
      result.push(line);
    }
  }
  if (inTable) result.push('</table>');

  // Wrap remaining plain text lines in <p>
  return result.join('\n')
    .replace(/\n{2,}/g, '</p><p>')
    .replace(/^(?!<[huptlo])/gm, (m) => m ? `<p>${m}` : m);
}

export default function ImpactPage() {
  const [camps, setCamps] = useState<CampPlan[]>([]);
  const [visits, setVisits] = useState<PatientVisit[]>([]);
  const [medicines, setMedicines] = useState<MedicineStock[]>([]);
  const [followups, setFollowups] = useState<Followup[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCampId, setSelectedCampId] = useState<string>('all');
  const [summaryText, setSummaryText] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    Promise.all([
      getCollection<CampPlan>('camp_plans'),
      getCollection<PatientVisit>('patient_visits'),
      getCollection<MedicineStock>('medicine_stock'),
      getCollection<Followup>('followups'),
    ]).then(([c, v, m, f]) => {
      setCamps(c);
      setVisits(v);
      setMedicines(m);
      setFollowups(f);
      setLoading(false);
    });
  }, []);

  const filtered = selectedCampId === 'all'
    ? visits
    : visits.filter((v) => v.campId === selectedCampId);

  const completed = filtered.filter((v) => v.stage === VisitStage.COMPLETED).length;
  const referrals = filtered.filter((v) => v.referralNeeded).length;
  const followupNeeded = filtered.filter((v) => v.followupNeeded).length;
  const totalMedsDispensed = medicines.reduce((sum, m) => sum + m.quantityDispensed, 0);
  const completedCamps = camps.filter((c) => c.status === 'COMPLETED').length;

  const stats = [
    { icon: Users, label: 'Total Patients', value: filtered.length, color: '#D4622B' },
    { icon: CheckCircle2, label: 'Consultations', value: completed, color: '#65A30D' },
    { icon: Pill, label: 'Medicines Dispensed', value: totalMedsDispensed, color: '#2D6A4F' },
    { icon: AlertTriangle, label: 'Referrals', value: referrals, color: '#EA580C' },
    { icon: Clock, label: 'Follow-ups Needed', value: followupNeeded, color: '#D97706' },
    { icon: Calendar, label: 'Camps Completed', value: completedCamps, color: '#7C3AED' },
  ];

  async function generateSummary() {
    const selectedCamp = camps.find((c) => c.id === selectedCampId);
    if (!selectedCamp && selectedCampId !== 'all') return;

    setIsGenerating(true);
    try {
      const response = await fetch('/api/ai/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campTitle: selectedCamp?.title || 'All Camps Overview',
          patientVisits: filtered.map((v) => ({
            name: v.patientName,
            age: v.age,
            gender: v.gender,
            complaint: v.chiefComplaint,
            stage: v.stage,
            priority: v.triagePriority,
            prescriptions: v.prescriptions,
            referral: v.referralNeeded,
            followup: v.followupNeeded,
          })),
          dispenseLogs: [],
          followups: followups.map((f) => ({
            patient: f.patientName,
            reason: f.reason,
            status: f.status,
          })),
        }),
      });
      const data = await response.json();
      if (data.success) {
        setSummaryText(data.summary);
        toast.success('AI summary generated!');
      } else {
        toast.error('Failed to generate summary');
      }
    } catch {
      toast.error('Summary generation service unavailable');
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <PageShell
      title="Impact Reports"
      subtitle="Post-camp outcomes, analytics, and AI-generated summaries"
      actions={
        <select
          value={selectedCampId}
          onChange={(e) => { setSelectedCampId(e.target.value); setSummaryText(''); }}
          className="px-3 py-2 rounded-xl border border-[#E5E2DC] text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#D4622B]/30"
        >
          <option value="all">All Camps</option>
          {camps.map((c) => (
            <option key={c.id} value={c.id}>{c.title}</option>
          ))}
        </select>
      }
    >
      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-8">
        {stats.map((item, i) => (
          <motion.div
            key={item.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06 }}
            whileHover={{ y: -3 }}
            className="card text-center"
          >
            <div className="w-10 h-10 rounded-xl flex items-center justify-center mx-auto mb-2" style={{ background: `${item.color}15` }}>
              <item.icon className="w-5 h-5" style={{ color: item.color }} />
            </div>
            <p className="text-2xl font-bold text-[#1A1A1A]">
              {loading ? <span className="skeleton inline-block w-8 h-6" /> : item.value}
            </p>
            <p className="text-xs text-[#6B7280] mt-0.5">{item.label}</p>
          </motion.div>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Camp Details */}
        <div className="lg:col-span-2 space-y-4">
          {/* Medicine Stock Overview */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="card">
            <h3 className="font-semibold text-[#1A1A1A] flex items-center gap-2 mb-4">
              <Pill className="w-5 h-5 text-[#2D6A4F]" /> Medicine Utilization
            </h3>
            {loading ? (
              <div className="space-y-2">{Array(4).fill(0).map((_, i) => <div key={i} className="skeleton h-8" />)}</div>
            ) : medicines.length === 0 ? (
              <p className="text-sm text-[#6B7280]">No medicine data available.</p>
            ) : (
              <div className="space-y-3">
                {medicines.slice(0, 8).map((med, i) => {
                  const utilization = med.quantityAvailable > 0
                    ? (med.quantityDispensed / med.quantityAvailable) * 100
                    : 0;
                  return (
                    <div key={med.id || i}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-[#1A1A1A] font-medium">{med.medicineName}</span>
                        <span className="text-[#6B7280]">{med.quantityDispensed}/{med.quantityAvailable} {med.unit}</span>
                      </div>
                      <div className="h-2 rounded-full bg-[#E5E2DC] overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${utilization}%` }}
                          transition={{ delay: 0.3 + i * 0.05, duration: 0.8 }}
                          className="h-full rounded-full bg-[#2D6A4F]"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </motion.div>

          {/* Patient Outcome Breakdown */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="card">
            <h3 className="font-semibold text-[#1A1A1A] flex items-center gap-2 mb-4">
              <HeartPulse className="w-5 h-5 text-[#D4622B]" /> Patient Outcomes
            </h3>
            {loading ? (
              <div className="skeleton h-32" />
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Registered', count: filtered.filter((v) => v.stage === VisitStage.REGISTERED).length, color: '#D4622B' },
                  { label: 'Triaged', count: filtered.filter((v) => v.stage === VisitStage.TRIAGED).length, color: '#D97706' },
                  { label: 'In Consultation', count: filtered.filter((v) => v.stage === VisitStage.IN_CONSULTATION).length, color: '#2D6A4F' },
                  { label: 'At Pharmacy', count: filtered.filter((v) => v.stage === VisitStage.AT_PHARMACY).length, color: '#7C3AED' },
                  { label: 'Completed', count: completed, color: '#65A30D' },
                  { label: 'Referred', count: referrals, color: '#EA580C' },
                ].map((item) => (
                  <div key={item.label} className="flex items-center gap-3 p-3 rounded-xl bg-[#FAF9F6] border border-[#E5E2DC]">
                    <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: item.color }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-[#6B7280]">{item.label}</p>
                      <p className="text-lg font-bold text-[#1A1A1A]">{item.count}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        </div>

        {/* AI Summary Panel */}
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.4 }} className="card sticky top-20">
          <h3 className="font-semibold text-[#1A1A1A] flex items-center gap-2 mb-4">
            <Sparkles className="w-5 h-5 text-[#F4A261]" /> AI Impact Summary
          </h3>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={generateSummary}
            disabled={isGenerating || loading}
            className="w-full btn-primary py-3 mb-4 disabled:opacity-50"
          >
            {isGenerating ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Generating...</>
            ) : (
              <><Sparkles className="w-4 h-4" /> Generate Summary</>
            )}
          </motion.button>

          {summaryText ? (
            <div className="prose prose-sm max-w-none">
              <div
                className="p-4 rounded-xl bg-[#FAF9F6] border border-[#E5E2DC] text-sm text-[#1A1A1A] leading-relaxed [&_h1]:text-lg [&_h1]:font-bold [&_h1]:mt-4 [&_h1]:mb-2 [&_h2]:text-base [&_h2]:font-bold [&_h2]:mt-4 [&_h2]:mb-2 [&_h3]:text-sm [&_h3]:font-bold [&_h3]:mt-3 [&_h3]:mb-1 [&_hr]:my-3 [&_hr]:border-[#E5E2DC] [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:my-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:my-1 [&_table]:w-full [&_table]:border-collapse [&_table]:my-2 [&_th]:border [&_th]:border-[#E5E2DC] [&_th]:px-2 [&_th]:py-1 [&_th]:bg-[#F0EDE8] [&_th]:text-left [&_th]:text-xs [&_th]:font-bold [&_td]:border [&_td]:border-[#E5E2DC] [&_td]:px-2 [&_td]:py-1 [&_td]:text-xs [&_strong]:font-bold"
                dangerouslySetInnerHTML={{ __html: markdownToHtml(summaryText) }}
              />
            </div>
          ) : (
            <div className="text-center py-8 text-[#6B7280]">
              <BarChart3 className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Generate an AI-powered impact summary</p>
              <p className="text-xs mt-1 opacity-60">Includes patient outcomes, medicine usage, and recommendations</p>
            </div>
          )}

          {/* Follow-ups */}
          {followups.length > 0 && (
            <div className="mt-4 pt-4 border-t border-[#E5E2DC]">
              <p className="text-xs font-bold uppercase tracking-wider text-[#6B7280] mb-2">Pending Follow-ups</p>
              <div className="space-y-2">
                {followups.filter((f) => f.status === 'PENDING').slice(0, 5).map((f) => (
                  <div key={f.id} className="p-2 rounded-lg bg-amber-50 border border-amber-200 text-xs">
                    <p className="font-medium text-amber-800">{f.patientName}</p>
                    <p className="text-amber-600 truncate">{f.reason}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </PageShell>
  );
}
