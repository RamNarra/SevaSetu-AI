'use client';

import { useEffect, useState } from 'react';
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
    void fetchReports();
  }, []);

  async function fetchReports() {
    setLoading(true);
    try {
      const response = await authFetch('/api/workbench/queue');
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to load workbench queue');
      }

      const rawRes = (data.rawReports ?? []) as RawReport[];
      const extRes = (data.extractedReports ?? []) as Array<ExtractedSignal & { status?: string }>;
      const extMap = new Map(extRes.map((entry) => [entry.id || entry.reportId, entry]));

      setPairs(rawRes.map((raw) => ({
        raw,
        extracted: extMap.get(raw.id!) ?? null,
      })));
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : 'Failed to load reports');
    } finally {
      setLoading(false);
    }
  }

  async function handleApprove(id: string) {
    try {
      const res = await authFetch('/api/workbench/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reportId: id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.success === false) {
        throw new Error(data.error || 'Failed to approve');
      }

      toast.success('Report approved');
      setPairs((prev) => prev.filter((pair) => pair.raw.id !== id));
      if (selectedId === id) setSelectedId(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    }
  }

  async function handleReject(id: string) {
    try {
      const res = await authFetch('/api/workbench/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reportId: id, decision: 'reject', notes: 'Rejected by coordinator' }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.success === false) {
        throw new Error(data.error || 'Failed to reject');
      }

      toast.success('Report rejected');
      setPairs((prev) => prev.filter((pair) => pair.raw.id !== id));
      if (selectedId === id) setSelectedId(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
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

      toast.success(data.fallbackUsed ? 'Extraction retried with fallback parser' : 'Extraction retried');
      await fetchReports();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    } finally {
      setRetryingId(null);
    }
  }

  async function handleClearFailed() {
    const failed = pairs.filter((pair) => pair.raw.status === ReportStatus.FAILED);
    if (failed.length === 0) {
      toast('No failed reports to clear');
      return;
    }

    const loadingToast = toast.loading(`Clearing ${failed.length} failed reports...`);
    try {
      await Promise.all(
        failed.map((pair) =>
          authFetch('/api/workbench/review', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              reportId: pair.raw.id,
              decision: 'reject',
              notes: 'Auto-cleared (failed extraction)',
            }),
          }),
        ),
      );
      toast.dismiss(loadingToast);
      toast.success(`Cleared ${failed.length} failed reports`);
      setSelectedId(null);
      await fetchReports();
    } catch (error) {
      toast.dismiss(loadingToast);
      toast.error(error instanceof Error ? error.message : String(error));
    }
  }

  const selectedPair = pairs.find((pair) => pair.raw.id === selectedId);

  return (
    <div className="flex h-[calc(100vh-64px)] gap-4 overflow-hidden p-4">
      <div className="flex w-1/3 flex-col overflow-hidden rounded-xl border border-[#E5E7EB] bg-white shadow-sm">
        <div className="flex items-center justify-between gap-2 border-b border-[#E5E7EB] p-4">
          <h2 className="text-lg font-bold text-[#1A1A1A]">Pending Review ({pairs.length})</h2>
          <div className="flex items-center gap-1.5">
            {pairs.some((pair) => pair.raw.status === ReportStatus.FAILED) && (
              <button
                onClick={handleClearFailed}
                className="flex items-center gap-1 rounded-md border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-600 hover:bg-red-100"
                title="Reject all failed extractions"
              >
                <Trash2 className="h-3.5 w-3.5" /> Clear failed
              </button>
            )}
            <button
              onClick={() => void fetchReports()}
              className="rounded-md bg-[#F5F5F5] p-1.5 text-[#6B7280] hover:bg-[#E5E7EB]"
              title="Refresh"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        <div className="flex-1 space-y-2 overflow-y-auto p-2">
          {loading ? (
            <div className="flex justify-center p-8">
              <Loader2 className="h-6 w-6 animate-spin text-[#6B7280]" />
            </div>
          ) : pairs.length === 0 ? (
            <div className="p-8 text-center text-[#6B7280]">No reports waiting for approval.</div>
          ) : (
            pairs.map((pair) => {
              const extracted = pair.extracted;
              const confidence = extracted?.needs?.[0]?.confidence ?? extracted?.urgencySignals?.[0]?.confidence ?? 1;
              const hasHighRisk = extracted?.urgencySignals?.some((signal) => signal.type === 'death' || signal.type === 'outbreak');
              const isFailed = pair.raw.status === ReportStatus.FAILED;
              const isPending = !extracted && !isFailed;
              const needsTriage = !!extracted && (confidence < 0.8 || hasHighRisk);
              const title = extracted?.locality?.rawName || (isFailed ? 'Extraction failed' : isPending ? 'Awaiting extraction' : 'Unknown Locality');

              return (
                <button
                  key={pair.raw.id}
                  onClick={() => setSelectedId(pair.raw.id!)}
                  className={`w-full rounded-lg border p-3 text-left transition-all ${
                    selectedId === pair.raw.id
                      ? 'border-[#D4622B]/40 bg-[#FFF4ED]'
                      : 'border-transparent bg-transparent hover:bg-[#F5F5F5]'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="line-clamp-1 text-sm font-medium text-[#1A1A1A]">{title}</span>
                    {isFailed && <XCircle className="h-4 w-4 flex-shrink-0 text-red-500" />}
                    {isPending && <Loader2 className="h-4 w-4 animate-spin flex-shrink-0 text-[#6B7280]" />}
                    {needsTriage && <AlertTriangle className="h-4 w-4 flex-shrink-0 text-amber-500" />}
                  </div>
                  <div className="mt-1 line-clamp-2 text-xs text-[#6B7280]">{pair.raw.rawText}</div>
                </button>
              );
            })
          )}
        </div>
      </div>

      <div className="flex flex-1 flex-col overflow-hidden rounded-xl border border-[#E5E7EB] bg-white shadow-sm">
        {selectedPair ? (
          <div className="flex h-full flex-col">
            <div className="flex items-center justify-between border-b border-[#E5E7EB] p-4">
              <h2 className="text-lg font-bold text-[#1A1A1A]">Report Evidence</h2>
              <div className="flex gap-2">
                {(!selectedPair.extracted || selectedPair.raw.status === ReportStatus.FAILED) && (
                  <button
                    onClick={() => void handleRetryExtract(selectedPair.raw.id!)}
                    disabled={retryingId === selectedPair.raw.id}
                    className="flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-sm font-medium text-blue-600 hover:bg-blue-100 disabled:opacity-50"
                  >
                    {retryingId === selectedPair.raw.id ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" /> Extracting...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="h-4 w-4" /> Retry Extraction
                      </>
                    )}
                  </button>
                )}
                <button
                  onClick={() => void handleReject(selectedPair.raw.id!)}
                  className="flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-100"
                >
                  <XCircle className="h-4 w-4" /> Reject/Edit
                </button>
                <button
                  onClick={() => void handleApprove(selectedPair.raw.id!)}
                  disabled={!selectedPair.extracted}
                  className="flex items-center gap-1 rounded-lg bg-green-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <CheckCircle className="h-4 w-4" /> Approve
                </button>
              </div>
            </div>

            <div className="flex flex-1 overflow-y-auto">
              <div className="w-1/2 space-y-4 border-r border-[#E5E7EB] p-6">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-[#6B7280]">Source Evidence</h3>
                {selectedPair.raw.storageUri && (
                  <div className="mb-4 rounded-lg border border-[#E5E7EB] bg-[#F5F5F5] p-4 text-center text-sm text-[#6B7280]">
                    [Image Context: {selectedPair.raw.fileUrls?.[0] || selectedPair.raw.storageUri}]
                  </div>
                )}
                <div className="whitespace-pre-wrap rounded-xl border border-[#E5E7EB] bg-[#FAFAFA] p-4 text-sm leading-relaxed text-[#1A1A1A]">
                  {selectedPair.raw.rawText}
                </div>
              </div>

              <div className="w-1/2 space-y-6 p-6">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-[#6B7280]">AI Extraction</h3>

                {!selectedPair.extracted ? (
                  <div className="rounded-xl border border-[#E5E7EB] bg-[#FAFAFA] p-6 text-center">
                    {selectedPair.raw.status === ReportStatus.FAILED ? (
                      <>
                        <XCircle className="mx-auto mb-2 h-8 w-8 text-red-500" />
                        <p className="font-medium text-[#1A1A1A]">Extraction failed</p>
                        <p className="mt-1 text-xs text-[#6B7280]">Click “Retry Extraction” above to try again.</p>
                      </>
                    ) : (
                      <>
                        <Loader2 className="mx-auto mb-2 h-8 w-8 animate-spin text-[#6B7280]" />
                        <p className="font-medium text-[#1A1A1A]">Awaiting extraction</p>
                        <p className="mt-1 text-xs text-[#6B7280]">Status: {selectedPair.raw.status}</p>
                      </>
                    )}
                  </div>
                ) : (
                  <>
                    <div className="space-y-3">
                      <h4 className="text-sm font-semibold text-[#1A1A1A]">Extracted Needs</h4>
                      {selectedPair.extracted.needs?.map((need, index) => (
                        <div key={index} className="rounded-xl border border-[#E5E7EB] bg-white p-3 shadow-sm">
                          <div className="mb-2 flex items-start justify-between">
                            <span className="text-sm font-medium text-[#1A1A1A]">{need.label}</span>
                            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${need.confidence < 0.8 ? 'border border-amber-200 bg-amber-100 text-amber-700' : 'border border-green-200 bg-green-100 text-green-700'}`}>
                              {(need.confidence * 100).toFixed(0)}% Conf
                            </span>
                          </div>
                          <p className="mb-1 text-xs text-[#6B7280]">Evidence:</p>
                          <p className="rounded border border-yellow-200 bg-yellow-100 p-2 text-sm text-yellow-900">
                            &quot;{need.evidenceSpan}&quot;
                          </p>
                        </div>
                      ))}
                      {(!selectedPair.extracted.needs || selectedPair.extracted.needs.length === 0) && (
                        <p className="text-sm italic text-[#6B7280]">No needs extracted.</p>
                      )}
                    </div>

                    <div className="space-y-3">
                      <h4 className="text-sm font-semibold text-[#1A1A1A]">Urgency Signals</h4>
                      {selectedPair.extracted.urgencySignals?.map((signal, index) => {
                        const isHigh = signal.type === 'death' || signal.type === 'outbreak';
                        return (
                          <div key={index} className={`rounded-xl border p-3 ${isHigh ? 'border-red-300 bg-red-50' : 'border-[#E5E7EB] bg-white shadow-sm'}`}>
                            <div className="mb-2 flex items-start justify-between">
                              <span className={`text-sm font-bold ${isHigh ? 'text-red-700' : 'text-[#1A1A1A]'}`}>{signal.type.toUpperCase()}</span>
                              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${signal.confidence < 0.8 ? 'border border-amber-200 bg-amber-100 text-amber-700' : 'border border-green-200 bg-green-100 text-green-700'}`}>
                                {(signal.confidence * 100).toFixed(0)}% Conf
                              </span>
                            </div>
                            <p className="mb-1 text-xs text-[#6B7280]">Evidence:</p>
                            <p className="rounded border border-yellow-200 bg-yellow-100 p-2 text-sm text-yellow-900">
                              &quot;{signal.evidenceSpan}&quot;
                            </p>
                          </div>
                        );
                      })}
                      {(!selectedPair.extracted.urgencySignals || selectedPair.extracted.urgencySignals.length === 0) && (
                        <p className="text-sm italic text-[#6B7280]">No urgency signals.</p>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center p-8 text-center text-[#6B7280]">
            <CheckCircle className="mb-4 h-12 w-12 opacity-50" />
            <p className="text-lg font-medium text-[#1A1A1A]">All Caught Up</p>
            <p className="mt-1 text-sm text-[#6B7280]">Select a report from the queue or take a break.</p>
          </div>
        )}
      </div>
    </div>
  );
}
