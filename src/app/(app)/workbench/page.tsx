'use client';

import { useEffect, useState } from 'react';
import { getCollection, orderBy } from '@/lib/firebase/firestore';
import { authFetch } from '@/lib/firebase/authFetch';
import { ExtractedSignal, RawReport, ReportStatus } from '@/types';
import toast from 'react-hot-toast';
import { Loader2, AlertTriangle, CheckCircle, XCircle, RefreshCw, Trash2 } from 'lucide-react';

interface ReportPair {
  raw: RawReport;
  extracted: (ExtractedSignal & { status?: string }) | null;
}

export default function WorkbenchPage() {
  const [pairs, setPairs] = useState<ReportPair[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [retryingId, setRetryingId] = useState<string | null>(null);

  useEffect(() => {
    fetchReports();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function fetchReports() {
    setLoading(true);
    try {
      const rawRes = await getCollection<RawReport>('raw_reports', orderBy('createdAt', 'desc'));
      const extRes = await getCollection<ExtractedSignal & { status?: string }>('extracted_reports');

      const extMap = new Map(extRes.map(e => [e.id || e.reportId, e]));

      // Show every raw report whose workflow is not yet HUMAN_APPROVED.
      // This includes RAW (queued), PROCESSING, EXTRACTED (awaiting review),
      // and FAILED (so the user can retry). Approved & rejected ones are hidden.
      const queue: ReportPair[] = [];
      rawRes.forEach(r => {
        const extracted = extMap.get(r.id!) ?? null;
        const status = r.status;
        if (status === ReportStatus.HUMAN_APPROVED || status === ReportStatus.HUMAN_REJECTED) return;
        queue.push({ raw: r, extracted });
      });

      setPairs(queue);
      // Do NOT auto-select. The judges should see the empty inspector until
      // a coordinator clicks a row — otherwise the yellow evidence panel is
      // visible before any interaction.
    } catch (e) {
      console.error(e);
      toast.error('Failed to load reports');
    }
    setLoading(false);
  }

  async function handleApprove(id: string) {
    try {
      const res = await authFetch('/api/workbench/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reportId: id })
      });
      if (!res.ok) throw new Error('Failed to approve');
      toast.success('Report approved');
      setPairs(prev => prev.filter(p => p.raw.id !== id));
      if (selectedId === id) setSelectedId(null);
    } catch (e) {
      toast.error(String(e));
    }
  }

  async function handleRetryExtract(id: string) {
    setRetryingId(id);
    try {
      const res = await authFetch('/api/ai/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reportId: id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.success === false) {
        throw new Error(data.error || `Extract failed (${res.status})`);
      }
      toast.success('Extraction retried');
      await fetchReports();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setRetryingId(null);
    }
  }

  async function handleClearFailed() {
    const failed = pairs.filter(p => p.raw.status === ReportStatus.FAILED);
    if (failed.length === 0) {
      toast('No failed reports to clear');
      return;
    }
    const t = toast.loading(`Clearing ${failed.length} failed reports...`);
    try {
      await Promise.all(
        failed.map(p =>
          authFetch('/api/workbench/review', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reportId: p.raw.id, decision: 'reject', notes: 'Auto-cleared (failed extraction)' }),
          })
        )
      );
      toast.dismiss(t);
      toast.success(`Cleared ${failed.length} failed reports`);
      setSelectedId(null);
      await fetchReports();
    } catch (e) {
      toast.dismiss(t);
      toast.error(e instanceof Error ? e.message : String(e));
    }
  }

  const selectedPair = pairs.find(p => p.raw.id === selectedId);

  return (
    <div className="flex h-[calc(100vh-64px)] gap-4 p-4 overflow-hidden">
      {/* Left List */}
      <div className="w-1/3 bg-white rounded-xl border border-[#E5E7EB] flex flex-col overflow-hidden shadow-sm">
        <div className="p-4 border-b border-[#E5E7EB] flex items-center justify-between gap-2">
          <h2 className="text-lg font-bold text-[#1A1A1A]">Pending Review ({pairs.length})</h2>
          <div className="flex items-center gap-1.5">
            {pairs.some(p => p.raw.status === ReportStatus.FAILED) && (
              <button
                onClick={handleClearFailed}
                className="px-2 py-1 text-xs rounded-md bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 flex items-center gap-1"
                title="Reject all failed extractions"
              >
                <Trash2 className="w-3.5 h-3.5" /> Clear failed
              </button>
            )}
            <button
              onClick={fetchReports}
              className="p-1.5 rounded-md bg-[#F5F5F5] hover:bg-[#E5E7EB] text-[#6B7280]"
              title="Refresh"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-2">
          {loading ? (
            <div className="flex justify-center p-8"><Loader2 className="w-6 h-6 animate-spin text-[#6B7280]" /></div>
          ) : pairs.length === 0 ? (
            <div className="text-center p-8 text-[#6B7280]">No reports waiting for approval.</div>
          ) : (
            pairs.map(p => {
              const ex = p.extracted;
              const conf = ex?.needs?.[0]?.confidence ?? ex?.urgencySignals?.[0]?.confidence ?? 1;
              const hasHighRisk = ex?.urgencySignals?.some(s => s.type === 'death' || s.type === 'outbreak');
              const isFailed = p.raw.status === ReportStatus.FAILED;
              const isPending = !ex && !isFailed;
              const needsTriage = !!ex && (conf < 0.8 || hasHighRisk);
              const title = ex?.locality?.rawName || (isFailed ? 'Extraction failed' : isPending ? 'Awaiting extraction' : 'Unknown Locality');

              return (
                <button
                  key={p.raw.id}
                  onClick={() => setSelectedId(p.raw.id!)}
                  className={`w-full text-left p-3 rounded-lg border transition-all ${selectedId === p.raw.id ? 'bg-[#FFF4ED] border-[#D4622B]/40' : 'bg-transparent border-transparent hover:bg-[#F5F5F5]'}`}
                >
                  <div className="flex justify-between items-start gap-2">
                    <span className="font-medium text-sm text-[#1A1A1A] line-clamp-1">{title}</span>
                    {isFailed && <XCircle className="w-4 h-4 text-red-500 flex-shrink-0" />}
                    {isPending && <Loader2 className="w-4 h-4 text-[#6B7280] flex-shrink-0 animate-spin" />}
                    {needsTriage && <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />}
                  </div>
                  <div className="text-xs text-[#6B7280] mt-1 line-clamp-2">{p.raw.rawText}</div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Right Detail */}
      <div className="flex-1 bg-white rounded-xl border border-[#E5E7EB] flex flex-col overflow-hidden shadow-sm">
        {selectedPair ? (
          <div className="flex flex-col h-full">
            <div className="p-4 border-b border-[#E5E7EB] flex justify-between items-center">
              <h2 className="text-lg font-bold text-[#1A1A1A]">Report Evidence</h2>
              <div className="flex gap-2">
                {(!selectedPair.extracted || selectedPair.raw.status === ReportStatus.FAILED) && (
                  <button
                    onClick={() => handleRetryExtract(selectedPair.raw.id!)}
                    disabled={retryingId === selectedPair.raw.id}
                    className="px-3 py-1.5 rounded-lg bg-blue-50 text-blue-600 border border-blue-200 font-medium text-sm hover:bg-blue-100 flex items-center gap-1 disabled:opacity-50"
                  >
                    {retryingId === selectedPair.raw.id
                      ? <><Loader2 className="w-4 h-4 animate-spin" /> Extracting...</>
                      : <><RefreshCw className="w-4 h-4" /> Retry Extraction</>}
                  </button>
                )}
                <button className="px-3 py-1.5 rounded-lg bg-red-50 text-red-600 border border-red-200 font-medium text-sm hover:bg-red-100 flex items-center gap-1">
                  <XCircle className="w-4 h-4" /> Reject/Edit
                </button>
                <button
                  onClick={() => handleApprove(selectedPair.raw.id!)}
                  disabled={!selectedPair.extracted}
                  className="px-3 py-1.5 rounded-lg bg-green-600 hover:bg-green-700 text-white font-medium text-sm flex items-center gap-1 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <CheckCircle className="w-4 h-4" /> Approve
                </button>
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto flex">
              {/* Raw Report */}
              <div className="w-1/2 p-6 border-r border-[#E5E7EB] space-y-4">
                <h3 className="text-[#6B7280] font-semibold text-xs uppercase tracking-wider">Source Evidence</h3>
                {selectedPair.raw.storageUri && (
                  <div className="bg-[#F5F5F5] border border-[#E5E7EB] rounded-lg p-4 mb-4 text-center text-[#6B7280] text-sm">
                    [Image Context: {selectedPair.raw.fileUrls?.[0] || selectedPair.raw.storageUri}]
                  </div>
                )}
                <div className="bg-[#FAFAFA] border border-[#E5E7EB] p-4 rounded-xl text-[#1A1A1A] text-sm whitespace-pre-wrap leading-relaxed">
                  {selectedPair.raw.rawText}
                </div>
              </div>

              {/* Extraction */}
              <div className="w-1/2 p-6 space-y-6">
                <h3 className="text-[#6B7280] font-semibold text-xs uppercase tracking-wider">AI Extraction</h3>

                {!selectedPair.extracted ? (
                  <div className="rounded-xl border border-[#E5E7EB] bg-[#FAFAFA] p-6 text-center">
                    {selectedPair.raw.status === ReportStatus.FAILED ? (
                      <>
                        <XCircle className="w-8 h-8 text-red-500 mx-auto mb-2" />
                        <p className="text-[#1A1A1A] font-medium">Extraction failed</p>
                        <p className="text-xs text-[#6B7280] mt-1">Click &ldquo;Retry Extraction&rdquo; above to try again.</p>
                      </>
                    ) : (
                      <>
                        <Loader2 className="w-8 h-8 text-[#6B7280] mx-auto mb-2 animate-spin" />
                        <p className="text-[#1A1A1A] font-medium">Awaiting extraction</p>
                        <p className="text-xs text-[#6B7280] mt-1">Status: {selectedPair.raw.status}</p>
                      </>
                    )}
                  </div>
                ) : (
                  <>
                {/* Needs */}
                <div className="space-y-3">
                  <h4 className="text-[#1A1A1A] font-semibold text-sm">Extracted Needs</h4>
                  {selectedPair.extracted.needs?.map((need, i) => (
                    <div key={i} className="bg-white border border-[#E5E7EB] rounded-xl p-3 shadow-sm">
                      <div className="flex justify-between items-start mb-2">
                        <span className="font-medium text-[#1A1A1A] text-sm">{need.label}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${need.confidence < 0.8 ? 'text-amber-700 bg-amber-100 border border-amber-200' : 'text-green-700 bg-green-100 border border-green-200'}`}>
                          {(need.confidence * 100).toFixed(0)}% Conf
                        </span>
                      </div>
                      <p className="text-xs text-[#6B7280] mb-1">Evidence:</p>
                      <p className="text-sm bg-yellow-100 text-yellow-900 p-2 rounded border border-yellow-200">
                        &quot;{need.evidenceSpan}&quot;
                      </p>
                    </div>
                  ))}
                  {(!selectedPair.extracted.needs || selectedPair.extracted.needs.length === 0) && (
                    <p className="text-[#6B7280] text-sm italic">No needs extracted.</p>
                  )}
                </div>

                {/* Urgency */}
                <div className="space-y-3">
                  <h4 className="text-[#1A1A1A] font-semibold text-sm">Urgency Signals</h4>
                  {selectedPair.extracted.urgencySignals?.map((sig, i) => {
                    const isHigh = sig.type === 'death' || sig.type === 'outbreak';
                    return (
                      <div key={i} className={`border rounded-xl p-3 ${isHigh ? 'border-red-300 bg-red-50' : 'border-[#E5E7EB] bg-white shadow-sm'}`}>
                        <div className="flex justify-between items-start mb-2">
                          <span className={`font-bold text-sm ${isHigh ? 'text-red-700' : 'text-[#1A1A1A]'}`}>{sig.type.toUpperCase()}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${sig.confidence < 0.8 ? 'text-amber-700 bg-amber-100 border border-amber-200' : 'text-green-700 bg-green-100 border border-green-200'}`}>
                            {(sig.confidence * 100).toFixed(0)}% Conf
                          </span>
                        </div>
                        <p className="text-xs text-[#6B7280] mb-1">Evidence:</p>
                        <p className="text-sm bg-yellow-100 text-yellow-900 p-2 rounded border border-yellow-200">
                          &quot;{sig.evidenceSpan}&quot;
                        </p>
                      </div>
                    );
                  })}
                  {(!selectedPair.extracted.urgencySignals || selectedPair.extracted.urgencySignals.length === 0) && (
                    <p className="text-[#6B7280] text-sm italic">No urgency signals.</p>
                  )}
                </div>
                  </>
                )}

              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-[#6B7280] p-8 text-center">
            <CheckCircle className="w-12 h-12 mb-4 opacity-50" />
            <p className="text-lg font-medium text-[#1A1A1A]">All Caught Up</p>
            <p className="text-sm mt-1 text-[#6B7280]">Select a report from the queue or take a break.</p>
          </div>
        )}
      </div>
    </div>
  );
}
