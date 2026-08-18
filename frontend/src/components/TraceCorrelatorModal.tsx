import React, { useState } from 'react';
import { X, CheckCircle, AlertTriangle, Clock, ArrowRight, Server, Shield, FileText, Download, Sparkles } from 'lucide-react';
import { HopTrace, ParsedLog, AiAnalysisResult } from '../types';
import { AiDiagnosticDrawer } from './AiDiagnosticDrawer';

interface TraceCorrelatorModalProps {
  trace: HopTrace | null;
  isOpen: boolean;
  onClose: () => void;
}

export const TraceCorrelatorModal: React.FC<TraceCorrelatorModalProps> = ({
  trace,
  isOpen,
  onClose
}) => {
  const [aiAnalysis, setAiAnalysis] = useState<AiAnalysisResult | null>(null);
  const [isAiDrawerOpen, setIsAiDrawerOpen] = useState<boolean>(false);
  const [isAiLoading, setIsAiLoading] = useState<boolean>(false);

  if (!isOpen || !trace) return null;

  const handleRunAiAnalysis = async () => {
    setIsAiLoading(true);
    setIsAiDrawerOpen(true);
    try {
      const res = await fetch('http://localhost:4000/api/logs/analyze-trace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ traceId: trace.traceId, trace })
      });
      const data = await res.json();
      setAiAnalysis(data);
    } catch (err) {
      console.error('Failed to run AI analysis:', err);
    } finally {
      setIsAiLoading(false);
    }
  };

  const exportSingleTrace = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(trace, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `trace-${trace.traceId}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const renderHopSection = (title: string, colorClass: string, logs: ParsedLog[] = []) => {
    return (
      <div className="bg-[#111827] border border-gray-800 rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className={`w-3 h-3 rounded-full ${colorClass}`} />
            <h3 className="font-mono font-bold text-sm text-gray-200">{title}</h3>
          </div>
          <span className="text-xs font-mono text-gray-400">{logs.length} events logged</span>
        </div>

        {logs.length === 0 ? (
          <p className="text-xs text-gray-500 italic">No log entries recorded for this hop yet.</p>
        ) : (
          <div className="space-y-2 max-h-48 overflow-y-auto pr-1 font-mono text-xs">
            {logs.map((item, idx) => (
              <div key={idx} className="p-2.5 bg-gray-900/90 border border-gray-800 rounded-lg space-y-1">
                <div className="flex items-center justify-between text-[11px] text-gray-400">
                  <span>{item.timestamp.split('T')[1]?.substring(0, 12) || item.timestamp}</span>
                  <div className="flex items-center space-x-2">
                    {item.statusCode && (
                      <span className={`px-1.5 py-0.2 rounded font-bold ${
                        item.statusCode === '200' || item.statusCode === '00' ? 'text-emerald-400 bg-emerald-950/40' : 'text-rose-400 bg-rose-950/40'
                      }`}>
                        RC: {item.statusCode}
                      </span>
                    )}
                    <span className="text-gray-500 font-mono text-[10px]">{item.podName}</span>
                  </div>
                </div>
                <div className="text-gray-300 break-all leading-relaxed">{item.message}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-[#1f2937] border border-gray-700 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="bg-[#111827] border-b border-gray-800 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-600/20 border border-blue-500/40 rounded-lg text-blue-400">
              <Server className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-base font-bold text-white font-mono">
                  Trace: {trace.traceId}
                </h2>
                {trace.hasError ? (
                  <span className="px-2 py-0.5 rounded text-xs bg-rose-600/30 text-rose-300 border border-rose-500/50 flex items-center space-x-1">
                    <AlertTriangle className="w-3 h-3" />
                    <span>Failed / Timeout</span>
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded text-xs bg-emerald-600/30 text-emerald-300 border border-emerald-500/50 flex items-center space-x-1">
                    <CheckCircle className="w-3 h-3" />
                    <span>Completed (00)</span>
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-400 font-mono">
                RRN: {trace.rrn || 'N/A'} &bull; Type: {trace.transactionType} &bull; Total Duration: {trace.totalLatencyMs || 0}ms
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={handleRunAiAnalysis}
              className="flex items-center space-x-1.5 px-3 py-1.5 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white rounded-lg text-xs font-bold transition-all shadow-md shadow-purple-900/30"
            >
              <Sparkles className="w-3.5 h-3.5 animate-pulse" />
              <span>✨ AI Root Cause Analysis</span>
            </button>
            <button
              onClick={exportSingleTrace}
              className="flex items-center space-x-1 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-200 rounded-lg text-xs font-semibold transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export Trace</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-gray-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Hop Flow Breadcrumb / Timeline Bar */}
        <div className="bg-[#182234] border-b border-gray-800 px-6 py-3 flex items-center justify-between text-xs font-mono">
          <div className="flex items-center space-x-2.5 flex-wrap">
            <div className="flex items-center space-x-1 text-blue-400 font-bold">
              <span>1. API Gateway</span>
            </div>
            {((trace.hops.authOtp?.length || 0) > 0 || trace.transactionType === 'LOGIN' || trace.transactionType === 'OTP_VERIFY') && (
              <>
                <ArrowRight className="w-3.5 h-3.5 text-gray-500" />
                <div className="flex items-center space-x-1 text-emerald-400 font-bold">
                  <span>2. Auth & OTP</span>
                </div>
              </>
            )}
            <ArrowRight className="w-3.5 h-3.5 text-gray-500" />
            <div className="flex items-center space-x-1 text-purple-400 font-bold">
              <span>{((trace.hops.authOtp?.length || 0) > 0) ? '3.' : '2.'} Gate Service</span>
            </div>
            <ArrowRight className="w-3.5 h-3.5 text-gray-500" />
            <div className="flex items-center space-x-1 text-orange-400 font-bold">
              <span>{((trace.hops.authOtp?.length || 0) > 0) ? '4.' : '3.'} Transport Core SWC</span>
            </div>
          </div>

          <div className="flex items-center space-x-2 text-gray-400">
            <Clock className="w-3.5 h-3.5 text-gray-400" />
            <span>Started: {trace.startTime.split('T')[1]?.substring(0, 12)}</span>
          </div>
        </div>

        {/* Modal Body - Hop details */}
        <div className="p-6 space-y-4 overflow-y-auto flex-1 bg-[#0b0f19]">
          {renderHopSection('Hop 1: API Gateway (Entry & Authentication)', 'bg-blue-500', trace.hops.gateway)}
          {((trace.hops.authOtp?.length || 0) > 0 || trace.transactionType === 'LOGIN' || trace.transactionType === 'OTP_VERIFY') && (
            renderHopSection('Hop: Auth & OTP Service (Credential Verification & SMS OTP)', 'bg-emerald-500', trace.hops.authOtp)
          )}
          {renderHopSection('Hop: Gate Service (Validation & Routing)', 'bg-purple-500', trace.hops.gate)}
          {renderHopSection('Hop: Transport Core SWC (ISO8583 & Core Host)', 'bg-orange-500', trace.hops.transport)}
        </div>

        {/* Modal Footer */}
        <div className="bg-[#111827] border-t border-gray-800 px-6 py-3 flex items-center justify-between text-xs text-gray-400 font-mono">
          <div className="flex items-center space-x-2">
            <Shield className="w-3.5 h-3.5 text-emerald-400" />
            <span>All PAN, PIN blocks, and Account numbers sanitized</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-200 rounded-lg text-xs font-semibold transition-colors"
          >
            Close
          </button>
        </div>
      </div>

      {/* AI Diagnostic Assistant Drawer */}
      <AiDiagnosticDrawer
        analysis={aiAnalysis}
        isOpen={isAiDrawerOpen}
        onClose={() => setIsAiDrawerOpen(false)}
        isLoading={isAiLoading}
      />
    </div>
  );
};
