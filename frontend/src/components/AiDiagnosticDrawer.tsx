import React, { useState } from 'react';
import { X, Sparkles, AlertOctagon, CheckCircle2, ShieldAlert, Wrench, Copy, Check, Server, FileCode, Cpu, Network } from 'lucide-react';
import { AiAnalysisResult } from '../types';

interface AiDiagnosticDrawerProps {
  analysis: AiAnalysisResult | null;
  isOpen: boolean;
  onClose: () => void;
  isLoading: boolean;
}

export const AiDiagnosticDrawer: React.FC<AiDiagnosticDrawerProps> = ({
  analysis,
  isOpen,
  onClose,
  isLoading
}) => {
  const [copied, setCopied] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleCopyJira = () => {
    if (!analysis) return;
    const jiraText = `*Summary:* ${analysis.jiraTicket.summary}
*Issue Type:* ${analysis.jiraTicket.issueType}
*Priority:* ${analysis.jiraTicket.priority}

${analysis.jiraTicket.description}`;

    navigator.clipboard.writeText(jiraText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const renderServiceIcon = (svc: string | null) => {
    if (svc === 'api-gateway') return <Network className="w-4 h-4 text-blue-400" />;
    if (svc === 'auth-otp-service') return <ShieldAlert className="w-4 h-4 text-emerald-400" />;
    if (svc === 'gate-service') return <Cpu className="w-4 h-4 text-purple-400" />;
    if (svc === 'transport-core-swc') return <Server className="w-4 h-4 text-orange-400" />;
    return <Server className="w-4 h-4 text-gray-400" />;
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'CRITICAL':
        return 'bg-rose-600/30 border-rose-500 text-rose-300 animate-pulse';
      case 'HIGH':
        return 'bg-rose-500/20 border-rose-500/50 text-rose-300';
      case 'MEDIUM':
        return 'bg-amber-500/20 border-amber-500/50 text-amber-300';
      case 'LOW':
        return 'bg-blue-500/20 border-blue-500/50 text-blue-300';
      default:
        return 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-end bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[#111827] border-l border-gray-800 w-full max-w-2xl h-full flex flex-col shadow-2xl overflow-hidden">
        {/* Drawer Header */}
        <div className="bg-[#182234] border-b border-gray-800 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-gradient-to-tr from-purple-600 to-blue-600 rounded-lg text-white shadow-md">
              <Sparkles className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center space-x-2">
                <span>AI Root Cause & Defect Assistant</span>
              </h2>
              <p className="text-xs text-gray-400 font-mono">
                {analysis?.engineUsed || 'LLM Diagnostic Engine'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-gray-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Drawer Body */}
        <div className="p-6 space-y-5 overflow-y-auto flex-1 bg-[#0b0f19] text-xs font-sans">
          {isLoading ? (
            <div className="h-full flex flex-col items-center justify-center space-y-3 py-20 text-gray-400">
              <Sparkles className="w-8 h-8 text-blue-400 animate-spin" />
              <p className="font-mono text-sm">Synthesizing 3-hop logs & diagnosing root cause...</p>
              <p className="text-xs text-gray-500">Querying Ollama / Cloud LLM / Banking Heuristic Analyzer</p>
            </div>
          ) : !analysis ? (
            <p className="text-gray-400 italic">No diagnostic data available.</p>
          ) : (
            <>
              {/* Card 1: Failed Service & Defect Indicator */}
              <div className="bg-[#182234] border border-gray-800 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-gray-400 font-mono uppercase text-[10px] tracking-wider">DEFECT STATUS</span>
                  <span className={`px-2.5 py-0.5 rounded text-[11px] font-mono font-bold border ${getSeverityBadge(analysis.severity)}`}>
                    {analysis.severity} SEVERITY
                  </span>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <div className="flex items-center space-x-2">
                    {analysis.status === 'FAILURE' ? (
                      <AlertOctagon className="w-5 h-5 text-rose-400" />
                    ) : (
                      <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                    )}
                    <div>
                      <div className="font-bold text-sm text-gray-100 font-mono">
                        {analysis.status === 'FAILURE' ? 'Transaction Failure Detected' : 'Transaction Completed Normal'}
                      </div>
                      <div className="text-gray-400 text-xs font-mono">
                        Trace ID: {analysis.traceId} &bull; RRN: {analysis.rrn || 'N/A'}
                      </div>
                    </div>
                  </div>

                  {analysis.failedService && (
                    <div className="flex items-center space-x-1.5 px-3 py-1.5 bg-rose-950/40 border border-rose-800/60 rounded-lg text-rose-300 font-mono font-bold text-xs">
                      {renderServiceIcon(analysis.failedService)}
                      <span>Fault in: [{analysis.failedService}]</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Card 2: Executive Root Cause Summary */}
              <div className="bg-[#111827] border border-gray-800 rounded-xl p-4 space-y-2">
                <div className="flex items-center space-x-2 text-amber-400">
                  <ShieldAlert className="w-4 h-4" />
                  <h3 className="font-mono font-bold text-xs uppercase tracking-wider text-amber-300">
                    Root Cause Summary
                  </h3>
                </div>
                <p className="text-gray-200 leading-relaxed font-mono text-xs bg-gray-900/80 p-3 rounded-lg border border-gray-800">
                  {analysis.rootCause}
                </p>
              </div>

              {/* Card 3: Technical Protocol Breakdown */}
              <div className="bg-[#111827] border border-gray-800 rounded-xl p-4 space-y-2">
                <div className="flex items-center space-x-2 text-cyan-400">
                  <FileCode className="w-4 h-4" />
                  <h3 className="font-mono font-bold text-xs uppercase tracking-wider text-cyan-300">
                    Technical Diagnostics
                  </h3>
                </div>
                <p className="text-gray-300 leading-relaxed font-mono text-xs bg-gray-900/80 p-3 rounded-lg border border-gray-800">
                  {analysis.technicalDetails}
                </p>
              </div>

              {/* Card 4: Recommended Remediation */}
              <div className="bg-[#111827] border border-gray-800 rounded-xl p-4 space-y-2">
                <div className="flex items-center space-x-2 text-emerald-400">
                  <Wrench className="w-4 h-4" />
                  <h3 className="font-mono font-bold text-xs uppercase tracking-wider text-emerald-300">
                    Recommended Engineering Fix
                  </h3>
                </div>
                <p className="text-gray-300 leading-relaxed font-mono text-xs bg-gray-900/80 p-3 rounded-lg border border-gray-800">
                  {analysis.recommendedAction}
                </p>
              </div>

              {/* Card 5: Jira Bug Draft Preview */}
              <div className="bg-[#111827] border border-gray-800 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-xs uppercase tracking-wider text-blue-300">
                    Jira Defect Ticket Draft
                  </span>
                  <span className="text-[10px] font-mono text-gray-500">
                    Priority: {analysis.jiraTicket.priority} &bull; Type: {analysis.jiraTicket.issueType}
                  </span>
                </div>

                <div className="font-mono text-xs text-gray-300 bg-gray-950 p-3 rounded-lg border border-gray-800 space-y-1.5">
                  <div className="font-bold text-white border-b border-gray-800 pb-1">
                    {analysis.jiraTicket.summary}
                  </div>
                  <pre className="text-[11px] text-gray-400 overflow-x-auto whitespace-pre-wrap font-mono pt-1">
                    {analysis.jiraTicket.description}
                  </pre>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Drawer Footer */}
        <div className="bg-[#182234] border-t border-gray-800 px-6 py-3.5 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-xs font-semibold transition-colors"
          >
            Close
          </button>

          {analysis && !isLoading && (
            <button
              onClick={handleCopyJira}
              className={`flex items-center space-x-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all shadow-md ${
                copied
                  ? 'bg-emerald-600 text-white'
                  : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white'
              }`}
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              <span>{copied ? 'Copied to Clipboard!' : 'Copy as Jira Bug Report'}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
