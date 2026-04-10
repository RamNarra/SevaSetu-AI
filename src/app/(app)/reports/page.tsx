'use client';

import PageShell from '@/components/layout/PageShell';
import { FileText, Upload, Clipboard, Sparkles, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { addDocument, Timestamp } from '@/lib/firebase/firestore';
import { uploadReportFile } from '@/lib/firebase/storage';
import { useAuth } from '@/contexts/AuthContext';
import { ReportStatus } from '@/types';

const sampleReports = [
  "Visited Rampur village on 3rd April. Saw many children with skin rashes and diarrhea. Clean water not available. At least 50 families affected. Need dermatologist and pediatrician. Very urgent — last camp was 8 months ago.",
  "Anganwadi worker from Koraput block reports severe anemia in pregnant women. 30+ cases in last 2 months. No iron supplements available at local PHC. Need blood tests and supplements. Community very worried.",
  "Follow up note from Dharavi health post: TB screening camp needed urgently. 12 suspected cases reported by local clinic. Previous camp screened 200 people, found 8 positive. Area has high population density.",
];

export default function ReportsPage() {
  const { user, userDoc } = useAuth();
  const [rawText, setRawText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractionResult, setExtractionResult] = useState<Record<string, unknown> | null>(null);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);

  async function handleSubmit() {
    if (!rawText.trim() && !uploadedFile) {
      toast.error('Please paste text or upload a file');
      return;
    }

    setIsSubmitting(true);
    try {
      let fileUrls: string[] = [];
      if (uploadedFile) {
        const url = await uploadReportFile(uploadedFile);
        fileUrls = [url];
      }

      const reportId = await addDocument('community_reports', {
        submittedBy: user?.uid || '',
        submitterName: user?.displayName || '',
        rawText: rawText.trim(),
        fileUrls,
        source: uploadedFile ? 'upload' : 'paste',
        status: ReportStatus.RAW,
        createdAt: Timestamp.now(),
      });

      toast.success('Report submitted! Starting AI extraction...');

      // Trigger AI extraction
      setIsExtracting(true);
      try {
        const response = await fetch('/api/ai/extract', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reportId, text: rawText.trim() }),
        });
        const data = await response.json();
        if (data.success) {
          setExtractionResult(data.result);
          toast.success('AI extraction complete!');
        } else {
          toast.error('Extraction failed: ' + (data.error || 'Unknown error'));
        }
      } catch {
        toast.error('AI extraction service unavailable');
      } finally {
        setIsExtracting(false);
      }

      setRawText('');
      setUploadedFile(null);
    } catch (error) {
      console.error(error);
      toast.error('Failed to submit report');
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
            disabled={isSubmitting || isExtracting || (!rawText.trim() && !uploadedFile)}
            className="w-full btn-primary py-3.5 text-base disabled:opacity-50"
          >
            {isSubmitting ? (
              <><Loader2 className="w-5 h-5 animate-spin" /> Submitting...</>
            ) : isExtracting ? (
              <><Sparkles className="w-5 h-5 animate-pulse" /> Extracting with AI...</>
            ) : (
              <><Sparkles className="w-5 h-5" /> Submit & Extract</>
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
                      <div className="flex flex-wrap gap-1.5">
                        {(value as string[]).map((v, i) => (
                          <span key={i} className="badge bg-primary-pale text-[#D4622B] border-[#D4622B]/20">
                            {String(v)}
                          </span>
                        ))}
                      </div>
                    ) : typeof value === 'number' ? (
                      <p className="text-xl font-bold text-[#1A1A1A]">{value}</p>
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
              <p className="text-sm">Submit a report to see AI extraction results</p>
              <p className="text-xs mt-1 opacity-60">
                Gemini will identify localities, issues, urgency signals, and more
              </p>
            </div>
          )}
        </motion.div>
      </div>
    </PageShell>
  );
}
