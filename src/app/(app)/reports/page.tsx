'use client';

import PageShell from '@/components/layout/PageShell';
import { FileText, Upload, Clipboard, Sparkles, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useAuth } from '@/contexts/AuthContext';
import { type ReportSource } from '@/types';
import {
  createClientEventId,
  queueReportForOffline,
} from '@/lib/offline/outbox';
import { submitRawReportToPipeline } from '@/lib/reports/pipeline';
import { authFetch } from '@/lib/firebase/authFetch';

const sampleReports = [
            "Visited Rampur village on 3rd April. Saw many children with skin rashes and diarrhea. Clean water not available. At least 50 families affected. Need dermatologist and pediatrician. Very urgent \u2014 last camp was 8 months ago.",
            "Anganwadi worker from Koraput block reports severe anemia in pregnant women. 30+ cases in last 2 months. No iron supplements available at local PHC. Need blood tests and supplements. Community very worried.",
            "Follow up note from Dharavi health post: TB screening camp needed urgently. 12 suspected cases reported by local clinic. Previous camp screened 200 people, found 8 positive. Area has high population density.",
        ];

export default function ReportsPage() {
    const { user } = useAuth();
    const [rawText, setRawText] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [extractionResult, setExtractionResult] = useState<Record<string, unknown> | null>(null);
    const [uploadedFile, setUploadedFile] = useState<File | null>(null);
    const [isOnline, setIsOnline] = useState(true);

    useEffect(() => {
        if (typeof navigator === 'undefined') {
            return;
        }

        setIsOnline(navigator.onLine);

        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    async function queueCurrentReport(clientEventId: string, source: ReportSource) {
        await queueReportForOffline({
            clientEventId,
            rawText: rawText.trim() || (uploadedFile ? '[Attachment queued for upload]' : ''),
            submittedBy: user?.uid || '',
            submitterName: user?.displayName || 'Anonymous Volunteer',
            source,
            files: uploadedFile ? [uploadedFile] : [],
        });

        toast.success('Offline: report saved to the outbox. It will sync automatically when the network returns.');
        setRawText('');
        setUploadedFile(null);
        setExtractionResult(null);
    }

    async function handleSubmit() {
        if (!rawText.trim() && !uploadedFile) {
            toast.error('Please paste text or upload a file');
            return;
        }

        if (!user?.uid) {
            toast.error('Please wait for sign-in to finish before submitting a report');
            return;
        }

        const clientEventId = createClientEventId();
        const source: ReportSource = uploadedFile ? 'upload' : 'paste';

        setIsSubmitting(true);
        try {
            if (!isOnline) {
                await queueCurrentReport(clientEventId, source);
                return;
            }

            // The client only writes `raw_reports` and uploads files. GCP Eventarc
            // (or a backend onDocumentCreated trigger in local emulation) is
            // responsible for pinging the extraction webhook afterward.
            await submitRawReportToPipeline({
                clientEventId,
                rawText: rawText.trim(),
                submittedBy: user.uid,
                submitterName: user?.displayName || '',
                source,
                createdAt: Date.now(),
                files: uploadedFile
                    ? [
                        {
                            name: uploadedFile.name,
                            type: uploadedFile.type,
                            size: uploadedFile.size,
                            lastModified: uploadedFile.lastModified,
                            blob: uploadedFile,
                        },
                    ]
                    : [],
            });

            // Trigger the server-side extraction
            const extractToast = toast.loading('AI is reading the report...');
            const extractRes = await authFetch('/api/ai/extract', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ reportId: clientEventId, text: rawText.trim() })
            });

            const extractData = await extractRes.json();
            toast.dismiss(extractToast);
            if (extractData.success) {
                setExtractionResult(extractData.result);
                toast.success('Report stored and AI extraction completed.');
            } else {
                setExtractionResult(null);
                const raw = String(extractData.error || 'Unknown error');
                // Trim verbose Gemini error payloads to a friendly headline.
                const friendly = /quota|RESOURCE_EXHAUSTED|429/i.test(raw)
                    ? 'AI quota reached \u2014 the report is saved. You can retry from the Workbench.'
                    : raw.length > 140 ? raw.slice(0, 140) + '\u2026' : raw;
                toast.error('Report stored. Extraction issue: ' + friendly, { duration: 6000 });
            }

            setRawText('');
            setUploadedFile(null);
        } catch (error) {
            console.error(error);
            const msg = String(error).toLowerCase();
            if (
                msg.includes('network') ||
                msg.includes('offline') ||
                msg.includes('failed to fetch')
            ) {
                await queueCurrentReport(clientEventId, source);
            } else {
                toast.error('Failed to submit report');
            }
        } finally {
            setIsSubmitting(false);
        }
    }

  function loadSample(index: number) {
    setRawText(sampleReports[index]);
    setExtractionResult(null);
    toast.success('Sample report loaded');
  }

  return (
    <PageShell
      title="Field Reports"
      subtitle="Submit community reports and survey data for AI extraction"
    >
      <div className="flex items-center gap-2 mb-6 px-4 py-2 bg-blue-50 border border-blue-100 rounded-xl w-fit">
        <div className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green-500 animate-pulse' : 'bg-amber-500'}`} />
        <span className="text-xs font-medium text-blue-700">
          {isOnline ? 'System Online — Live Sync Active' : 'Offline Mode — Saving To Disaster Outbox'}
        </span>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Intake Form */}
        <div className="space-y-4">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="card">
            <h3 className="font-semibold text-[#1A1A1A] flex items-center gap-2 mb-4">
              <Clipboard className="w-5 h-5 text-[#D4622B]" />
              Paste Field Report
            </h3>
            <textarea
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              rows={8}
              placeholder="Paste raw field notes, survey summaries, or camp observations here..."
              className="w-full p-4 rounded-xl border border-[#E5E2DC] bg-white text-sm text-[#1A1A1A] placeholder-[#6B7280]/50 resize-none focus:outline-none focus:ring-2 focus:ring-[#D4622B]/30 focus:border-[#D4622B] transition-all"
            />
          </motion.div>

          {/* File Upload */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="card">
            <h3 className="font-semibold text-[#1A1A1A] flex items-center gap-2 mb-4">
              <Upload className="w-5 h-5 text-[#F4A261]" />
              Upload Report File
            </h3>
            <label className="flex flex-col items-center justify-center py-8 border-2 border-dashed border-[#E5E2DC] rounded-xl cursor-pointer hover:border-[#D4622B]/30 hover:bg-primary-pale/30 transition-all">
              <Upload className="w-8 h-8 text-[#6B7280] mb-2" />
              <p className="text-sm text-[#6B7280]">
                {uploadedFile ? uploadedFile.name : 'Click or drag to upload'}
              </p>
              <input
                type="file"
                className="hidden"
                accept=".txt,.pdf,.doc,.docx,.csv"
                onChange={(e) => setUploadedFile(e.target.files?.[0] || null)}
              />
            </label>
          </motion.div>

          {/* Sample Data */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="card">
            <h3 className="font-semibold text-[#1A1A1A] mb-3">Load Sample Report</h3>
            <div className="space-y-2">
              {sampleReports.map((_, i) => (
                <button
                  key={i}
                  onClick={() => loadSample(i)}
                  className="w-full text-left px-3 py-2 rounded-lg text-sm text-[#6B7280] hover:bg-primary-pale hover:text-[#D4622B] transition-colors truncate"
                >
                  Sample Report {i + 1}
                </button>
              ))}
            </div>
          </motion.div>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleSubmit}
            disabled={isSubmitting || (!rawText.trim() && !uploadedFile)}
            className="w-full btn-primary py-3.5 text-base disabled:opacity-50"
          >
            {isSubmitting ? (
              <><Loader2 className="w-5 h-5 animate-spin" /> Saving Report...</>
            ) : (
              <><Sparkles className="w-5 h-5" /> Submit To Backend Queue</>
            )}
          </motion.button>
        </div>

        {/* Extraction Preview */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3 }}
          className="card"
        >
          <h3 className="font-semibold text-[#1A1A1A] flex items-center gap-2 mb-4">
            <Sparkles className="w-5 h-5 text-[#F4A261]" />
            AI Extraction Result
          </h3>
          {extractionResult ? (
            <div className="space-y-4 text-sm">
              {Object.entries(extractionResult).map(([key, value]) => (
                <div key={key}>
                  <p className="font-medium text-[#6B7280] uppercase text-xs tracking-wider mb-1">
                    {key.replace(/([A-Z])/g, ' $1').trim()}
                  </p>
                  <div className="p-3 rounded-lg bg-[#FAF9F6] border border-[#E5E2DC]">
                    {Array.isArray(value) ? (
                      <div className="space-y-2">
                        {(value as unknown[]).map((item, i) => (
                          typeof item === 'object' && item !== null ? (
                            <div key={i} className="rounded-lg bg-white border border-[#E5E2DC] p-2.5 space-y-1">
                              {Object.entries(item as Record<string, unknown>)
                                .filter(([k]) => !['taxonomyCode', 'geohash'].includes(k))
                                .map(([k, v]) => (
                                  <div key={k} className="flex gap-2 items-start text-xs">
                                    <span className="text-[#6B7280] min-w-[80px] shrink-0 capitalize">{k.replace(/([A-Z])/g, ' $1').toLowerCase()}:</span>
                                    <span className={`break-words font-medium ${k === 'label' ? 'text-[#D4622B]' : k === 'evidenceSpan' ? 'italic text-[#6B7280] font-normal' : 'text-[#1A1A1A]'}`}>
                                      {Array.isArray(v) ? v.join(', ') : String(v ?? '—')}
                                    </span>
                                  </div>
                                ))}
                            </div>
                          ) : (
                            <span key={i} className="badge bg-primary-pale text-[#D4622B] border-[#D4622B]/20">
                              {String(item)}
                            </span>
                          )
                        ))}
                      </div>
                    ) : typeof value === 'number' ? (
                      <p className="text-xl font-bold text-[#1A1A1A]">{value}</p>
                    ) : typeof value === 'object' && value !== null ? (
                      <div className="flex flex-wrap gap-1.5">
                        {Object.entries(value as Record<string, unknown>).map(([k, v]) => (
                          <span key={k} className="badge bg-primary-pale text-[#D4622B] border-[#D4622B]/20">
                            {k}: {Array.isArray(v) ? v.join(', ') : String(v)}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[#1A1A1A]">{String(value)}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-[#6B7280]">
              <FileText className="w-12 h-12 mb-3 opacity-30" />
              <p className="text-sm">Submit a report to hand it off to the backend extraction pipeline</p>
              <p className="text-xs mt-1 opacity-60">
                Eventarc will trigger Gemini extraction after the raw report lands in Firebase
              </p>
            </div>
          )}
        </motion.div>
      </div>
    </PageShell>
  );
}
