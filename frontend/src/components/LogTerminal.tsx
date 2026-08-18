import React, { useRef, useEffect, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { ArrowDownCircle, ExternalLink, Shield, Cpu, Network, CheckCircle, AlertOctagon, HelpCircle, Sparkles } from 'lucide-react';
import { ParsedLog, ServiceName } from '../types';

interface LogTerminalProps {
  logs: ParsedLog[];
  onSelectTrace: (traceId: string) => void;
  isPaused: boolean;
}

export const LogTerminal: React.FC<LogTerminalProps> = ({
  logs,
  onSelectTrace,
  isPaused
}) => {
  const parentRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState<boolean>(true);

  const rowVirtualizer = useVirtualizer({
    count: logs.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 48,
    overscan: 20
  });

  // Auto-scroll to bottom on new logs if enabled and not paused
  useEffect(() => {
    if (autoScroll && !isPaused && logs.length > 0 && parentRef.current) {
      rowVirtualizer.scrollToIndex(logs.length - 1, { align: 'end' });
    }
  }, [logs.length, autoScroll, isPaused, rowVirtualizer]);

  const handleScroll = () => {
    if (!parentRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = parentRef.current;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 60;
    if (isAtBottom !== autoScroll) {
      setAutoScroll(isAtBottom);
    }
  };

  const renderServiceBadge = (service: ServiceName) => {
    switch (service) {
      case 'api-gateway':
        return (
          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[11px] font-mono font-semibold bg-blue-500/15 text-blue-300 border border-blue-500/30">
            <Network className="w-3 h-3 text-blue-400" />
            <span>API-GATEWAY</span>
          </span>
        );
      case 'auth-otp-service':
        return (
          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[11px] font-mono font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
            <Shield className="w-3 h-3 text-emerald-400" />
            <span>AUTH-OTP</span>
          </span>
        );
      case 'gate-service':
        return (
          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[11px] font-mono font-semibold bg-purple-500/15 text-purple-300 border border-purple-500/30">
            <Cpu className="w-3 h-3 text-purple-400" />
            <span>GATE-SERVICE</span>
          </span>
        );
      case 'transport-core-swc':
        return (
          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[11px] font-mono font-semibold bg-orange-500/15 text-orange-300 border border-orange-500/30">
            <Network className="w-3 h-3 text-orange-400" />
            <span>TRANSPORT-SWC</span>
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-gray-700 text-gray-300">
            {service}
          </span>
        );
    }
  };

  const renderStatusBadge = (log: ParsedLog) => {
    const code = log.statusCode;
    if (!code) return null;

    const isSuccess = code === '200' || code === '00';
    const isTimeout = code === '68' || code === '504';
    const isError = !isSuccess && (code.startsWith('5') || code === '68' || code === '91');

    return (
      <span
        className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold border ${
          isSuccess
            ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
            : isTimeout
            ? 'bg-rose-600/30 border-rose-500 text-rose-300 animate-pulse'
            : isError
            ? 'bg-rose-500/20 border-rose-500/40 text-rose-300'
            : 'bg-amber-500/20 border-amber-500/40 text-amber-300'
        }`}
      >
        RC: {code}
      </span>
    );
  };

  return (
    <div className="relative flex-1 bg-[#0b0f19] flex flex-col overflow-hidden">
      {/* Terminal View Header / Columns */}
      <div className="bg-[#111827] border-b border-gray-800 text-[11px] font-mono text-gray-400 py-1.5 px-4 flex items-center justify-between z-10 select-none">
        <div className="flex items-center space-x-6">
          <span className="w-24">TIMESTAMP</span>
          <span className="w-32">SERVICE</span>
          <span className="w-14">LEVEL</span>
          <span className="w-32">TRACE ID / RRN</span>
          <span>LOG PAYLOAD & CORRELATION</span>
        </div>

        <div className="flex items-center space-x-2">
          {!autoScroll && (
            <button
              onClick={() => {
                setAutoScroll(true);
                if (parentRef.current && logs.length > 0) {
                  rowVirtualizer.scrollToIndex(logs.length - 1, { align: 'end' });
                }
              }}
              className="flex items-center space-x-1 px-2 py-0.5 bg-blue-600/30 hover:bg-blue-600/50 text-blue-300 border border-blue-500/40 rounded text-[11px] transition-colors"
            >
              <ArrowDownCircle className="w-3 h-3" />
              <span>Scroll to Bottom</span>
            </button>
          )}
          <span className="text-[10px] text-gray-500">{logs.length} rendered rows</span>
        </div>
      </div>

      {/* Virtual Scroll Area */}
      <div
        ref={parentRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto font-mono text-xs text-gray-200 select-text"
      >
        {logs.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-gray-500 space-y-2 p-8">
            <HelpCircle className="w-8 h-8 text-gray-600 animate-pulse" />
            <p className="text-sm font-medium">Waiting for incoming Kubernetes pod logs...</p>
            <p className="text-xs text-gray-600">Simulating live transactions or streaming from active cluster</p>
          </div>
        ) : (
          <div
            style={{
              height: `${rowVirtualizer.getTotalSize()}px`,
              width: '100%',
              position: 'relative'
            }}
          >
            {rowVirtualizer.getVirtualItems().map((virtualRow) => {
              const log = logs[virtualRow.index];
              const isError = log.level === 'ERROR' || (log.statusCode && log.statusCode !== '200' && log.statusCode !== '00');

              return (
                <div
                  key={virtualRow.key}
                  data-index={virtualRow.index}
                  ref={rowVirtualizer.measureElement}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    transform: `translateY(${virtualRow.start}px)`
                  }}
                  className={`px-4 py-2 border-b border-gray-900/60 hover:bg-gray-800/40 transition-colors flex items-start space-x-4 ${
                    isError ? 'bg-rose-950/20' : ''
                  }`}
                >
                  {/* Timestamp */}
                  <span className="text-gray-400 text-[11px] whitespace-nowrap pt-0.5 w-24 shrink-0">
                    {log.timestamp.split('T')[1]?.substring(0, 12) || log.timestamp}
                  </span>

                  {/* Service Badge */}
                  <div className="w-32 shrink-0 pt-0.5">
                    {renderServiceBadge(log.service)}
                  </div>

                  {/* Log Level */}
                  <span
                    className={`w-14 shrink-0 font-bold text-[11px] pt-0.5 ${
                      log.level === 'ERROR'
                        ? 'text-rose-400'
                        : log.level === 'WARN'
                        ? 'text-amber-400'
                        : log.level === 'DEBUG'
                        ? 'text-cyan-400'
                        : 'text-emerald-400'
                    }`}
                  >
                    [{log.level}]
                  </span>

                  {/* Trace ID / RRN & Hop Opener */}
                  <div className="w-36 shrink-0 flex flex-col space-y-0.5">
                    {log.traceId ? (
                      <div className="flex items-center space-x-1.5">
                        <button
                          onClick={() => onSelectTrace(log.traceId!)}
                          title="Click to view 3-hop trace correlation & AI diagnosis"
                          className="inline-flex items-center space-x-1 text-blue-400 hover:text-blue-300 hover:underline font-bold text-[11px] text-left truncate group"
                        >
                          <span className="truncate">{log.traceId}</span>
                          <ExternalLink className="w-2.5 h-2.5 opacity-60 group-hover:opacity-100 shrink-0" />
                        </button>
                        <button
                          onClick={() => onSelectTrace(log.traceId!)}
                          title="Run AI Root Cause Analysis for this trace"
                          className="p-0.5 text-purple-400 hover:text-purple-300 hover:bg-purple-900/40 rounded transition-colors"
                        >
                          <Sparkles className="w-3 h-3 animate-pulse" />
                        </button>
                      </div>
                    ) : (
                      <span className="text-gray-600 text-[11px]">-</span>
                    )}
                    {log.rrn && (
                      <span className="text-[10px] text-gray-500 truncate">
                        RRN: {log.rrn}
                      </span>
                    )}
                  </div>

                  {/* Message & Status Chips */}
                  <div className="flex-1 min-w-0 flex flex-wrap items-center gap-1.5">
                    {renderStatusBadge(log)}
                    {log.transactionType !== 'UNKNOWN' && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] bg-gray-800 text-gray-300 border border-gray-700">
                        {log.transactionType}
                      </span>
                    )}
                    {log.latencyMs !== null && log.latencyMs !== undefined && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] bg-gray-800 text-cyan-300 border border-gray-700">
                        {log.latencyMs}ms
                      </span>
                    )}
                    <span className="text-gray-300 break-all select-text leading-relaxed">
                      {log.message}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
