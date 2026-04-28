'use client';

import { useEffect, useState } from 'react';
import { getCollection, orderBy } from '@/lib/firebase/firestore';
import { ExtractedSignal, RawReport } from '@/types';
import toast from 'react-hot-toast';
import { Loader2, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';

interface ReportPair {
  raw: RawReport;
  extracted: ExtractedSignal & { status?: string };
}

export default function WorkbenchPage() {
  const [pairs, setPairs] = useState<ReportPair[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);

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
      
      const unapproved: ReportPair[] = [];
      rawRes.forEach(r => {
        const extracted = extMap.get(r.id!);
        if (extracted && extracted.status !== 'APPROVED') {
          unapproved.push({ raw: r, extracted });
        }
      });

      setPairs(unapproved);
      if (unapproved.length > 0 && !selectedId) {
        setSelectedId(unapproved[0].raw.id || null);
      }
    } catch (e) {
      console.error(e);
      toast.error('Failed to load reports');
    }
    setLoading(false);
  }

  async function handleApprove(id: string) {
    try {
      const res = await fetch('/api/workbench/approve', {
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

  const selectedPair = pairs.find(p => p.raw.id === selectedId);

  return (
    <div className="flex h-[calc(100vh-64px)] gap-4 p-4 overflow-hidden">
      {/* Left List */}
      <div className="w-1/3 bg-white/5 rounded-xl border border-white/10 flex flex-col overflow-hidden">
        <div className="p-4 border-b border-white/10">
          <h2 className="text-lg font-bold text-white">Pending Review ({pairs.length})</h2>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-2">
          {loading ? (
            <div className="flex justify-center p-8"><Loader2 className="w-6 h-6 animate-spin text-white/50" /></div>
          ) : pairs.length === 0 ? (
            <div className="text-center p-8 text-white/50">No reports waiting for approval.</div>
          ) : (
            pairs.map(p => {
              const conf = p.extracted.needs?.[0]?.confidence || p.extracted.urgencySignals?.[0]?.confidence || 1;
              const hasHighRisk = p.extracted.urgencySignals?.some(s => s.type === 'death' || s.type === 'outbreak');
              const needsTriage = conf < 0.8 || hasHighRisk;

              return (
                <button
                  key={p.raw.id}
                  onClick={() => setSelectedId(p.raw.id!)}
                  className={`w-full text-left p-3 rounded-lg border transition-all ${selectedId === p.raw.id ? 'bg-white/10 border-white/30' : 'bg-transparent border-transparent hover:bg-white/5'}`}
                >
                  <div className="flex justify-between items-start">
                    <span className="font-medium text-sm text-white line-clamp-1">{p.extracted.locality.rawName || 'Unknown Locality'}</span>
                    {needsTriage && <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />}
                  </div>
                  <div className="text-xs text-white/50 mt-1 line-clamp-2">{p.raw.rawText}</div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Right Detail */}
      <div className="flex-1 bg-white/5 rounded-xl border border-white/10 flex flex-col overflow-hidden">
        {selectedPair ? (
          <div className="flex flex-col h-full">
            <div className="p-4 border-b border-white/10 flex justify-between items-center">
              <h2 className="text-lg font-bold text-white">Report Evidence</h2>
              <div className="flex gap-2">
                <button className="px-3 py-1.5 rounded-lg bg-red-500/20 text-red-400 font-medium text-sm hover:bg-red-500/30 flex items-center gap-1">
                  <XCircle className="w-4 h-4" /> Reject/Edit
                </button>
                <button onClick={() => handleApprove(selectedPair.raw.id!)} className="px-3 py-1.5 rounded-lg bg-green-500 hover:bg-green-600 text-white font-medium text-sm flex items-center gap-1 shadow-lg">
                  <CheckCircle className="w-4 h-4" /> Approve
                </button>
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto flex">
              {/* Raw Report */}
              <div className="w-1/2 p-6 border-r border-white/10 space-y-4">
                <h3 className="text-white/60 font-medium text-sm uppercase tracking-wider">Source Evidence</h3>
                {selectedPair.raw.storageUri && (
                  <div className="bg-white/5 border border-white/10 rounded-lg p-4 mb-4 text-center text-white/70">
                    [Image Context: {selectedPair.raw.fileUrls?.[0] || selectedPair.raw.storageUri}]
                  </div>
                )}
                <div className="bg-white/5 border border-white/10 p-4 rounded-xl text-white/90 text-sm whitespace-pre-wrap leading-relaxed">
                  {selectedPair.raw.rawText}
                </div>
              </div>

              {/* Extraction */}
              <div className="w-1/2 p-6 space-y-6">
                <h3 className="text-white/60 font-medium text-sm uppercase tracking-wider">AI Extraction</h3>
                
                {/* Needs */}
                <div className="space-y-3">
                  <h4 className="text-white font-medium text-sm">Extracted Needs</h4>
                  {selectedPair.extracted.needs?.map((need, i) => (
                    <div key={i} className="bg-white/5 border border-white/10 rounded-xl p-3">
                      <div className="flex justify-between items-start mb-2">
                        <span className="font-medium text-white text-sm">{need.label}</span>
                        <span className={`text-xs px-2 py-0.5 outline outline-1 outline-white/20 rounded-full ${need.confidence < 0.8 ? 'text-amber-400 bg-amber-500/10' : 'text-green-400 bg-green-500/10'}`}>
                          {(need.confidence * 100).toFixed(0)}% Conf
                        </span>
                      </div>
                      <p className="text-xs text-white/50 mb-1">Evidence:</p>
                      <p className="text-sm bg-yellow-500/20 text-yellow-100 p-2 rounded border border-yellow-500/30">
                        &quot;{need.evidenceSpan}&quot;
                      </p>
                    </div>
                  ))}
                  {(!selectedPair.extracted.needs || selectedPair.extracted.needs.length === 0) && (
                    <p className="text-white/40 text-sm italic">No needs extracted.</p>
                  )}
                </div>

                {/* Urgency */}
                <div className="space-y-3">
                  <h4 className="text-white font-medium text-sm">Urgency Signals</h4>
                  {selectedPair.extracted.urgencySignals?.map((sig, i) => {
                    const isHigh = sig.type === 'death' || sig.type === 'outbreak';
                    return (
                      <div key={i} className={`border rounded-xl p-3 ${isHigh ? 'border-red-500/50 bg-red-500/10' : 'border-white/10 bg-white/5'}`}>
                        <div className="flex justify-between items-start mb-2">
                          <span className={`font-bold text-sm ${isHigh ? 'text-red-400' : 'text-white'}`}>{sig.type.toUpperCase()}</span>
                          <span className={`text-xs px-2 py-0.5 outline outline-1 outline-white/20 rounded-full ${sig.confidence < 0.8 ? 'text-amber-400 bg-amber-500/10' : 'text-green-400 bg-green-500/10'}`}>
                            {(sig.confidence * 100).toFixed(0)}% Conf
                          </span>
                        </div>
                        <p className="text-xs text-white/50 mb-1">Evidence:</p>
                        <p className="text-sm bg-yellow-500/20 text-yellow-100 p-2 rounded border border-yellow-500/30">
                          &quot;{sig.evidenceSpan}&quot;
                        </p>
                      </div>
                    );
                  })}
                  {(!selectedPair.extracted.urgencySignals || selectedPair.extracted.urgencySignals.length === 0) && (
                    <p className="text-white/40 text-sm italic">No urgency signals.</p>
                  )}
                </div>

              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-white/30 p-8 text-center">
            <CheckCircle className="w-12 h-12 mb-4 opacity-50" />
            <p className="text-lg font-medium text-white/50">All Caught Up</p>
            <p className="text-sm mt-1">Select a report from the queue or take a break.</p>
          </div>
        )}
      </div>
    </div>
  );
}
