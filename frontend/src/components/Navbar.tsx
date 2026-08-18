import React from 'react';
import { Activity, Play, Pause, Trash2, Download, Radio, ShieldCheck, Server } from 'lucide-react';
import { StreamStats } from '../types';

interface NavbarProps {
  stats: StreamStats;
  isConnected: boolean;
  isPaused: boolean;
  pausedCount: number;
  onTogglePause: () => void;
  onClearLogs: () => void;
  onExportLogs: () => void;
  onToggleMock: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  stats,
  isConnected,
  isPaused,
  pausedCount,
  onTogglePause,
  onClearLogs,
  onExportLogs,
  onToggleMock
}) => {
  return (
    <header className="bg-[#111827] border-b border-gray-800 px-4 py-2.5 flex items-center justify-between shadow-md">
      {/* Brand & System Status */}
      <div className="flex items-center space-x-3">
        <div className="p-2 bg-blue-600/20 border border-blue-500/40 rounded-lg text-blue-400">
          <Activity className="w-5 h-5 animate-pulse" />
        </div>
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-base font-bold text-white tracking-wide">
              QC Banking Log Tracer
            </h1>
            <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-blue-900/60 text-blue-300 border border-blue-700/50">
              v1.0-QC
            </span>
          </div>
          <p className="text-xs text-gray-400 font-mono">
            K8s Microservices Flow (Gateway &rarr; Gate &rarr; Transport Core SWC)
          </p>
        </div>
      </div>

      {/* Cluster & Stream Diagnostics */}
      <div className="hidden lg:flex items-center space-x-4">
        {/* Connection status badge */}
        <div className="flex items-center space-x-2 px-3 py-1 bg-gray-900/80 rounded-md border border-gray-800 text-xs">
          <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-400 shadow-[0_0_8px_#34d399]' : 'bg-rose-500 shadow-[0_0_8px_#f43f5e]'}`} />
          <span className="text-gray-300 font-medium">{isConnected ? 'WS Connected' : 'WS Reconnecting...'}</span>
        </div>

        {/* K8s / Mock Mode */}
        <button
          onClick={onToggleMock}
          title="Click to toggle Mock / Live mode"
          className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-md text-xs font-mono border transition-all ${
            stats.mockMode
              ? 'bg-amber-500/10 border-amber-500/40 text-amber-300 hover:bg-amber-500/20'
              : 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/20'
          }`}
        >
          <Server className="w-3.5 h-3.5" />
          <span>{stats.mockMode ? 'Mode: Mock Sim' : 'Mode: K8s Cluster'}</span>
        </button>

        {/* Throughput Metric */}
        <div className="flex items-center space-x-1.5 px-2.5 py-1 bg-gray-900/80 border border-gray-800 rounded-md text-xs text-gray-300 font-mono">
          <Radio className="w-3.5 h-3.5 text-cyan-400" />
          <span>{stats.logsPerSecond} logs/sec</span>
        </div>

        {/* Masking Status Badge */}
        <div className="flex items-center space-x-1.5 px-2.5 py-1 bg-gray-900/80 border border-gray-800 rounded-md text-xs text-emerald-400 font-mono">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span>PAN/PIN Masked</span>
        </div>
      </div>

      {/* Control Actions */}
      <div className="flex items-center space-x-2">
        {/* Pause/Resume Toggle */}
        <button
          onClick={onTogglePause}
          className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors border ${
            isPaused
              ? 'bg-amber-500/20 border-amber-500/50 text-amber-300 hover:bg-amber-500/30'
              : 'bg-gray-800 border-gray-700 text-gray-200 hover:bg-gray-700'
          }`}
        >
          {isPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
          <span>{isPaused ? `Resume Stream (${pausedCount} buffered)` : 'Pause Stream'}</span>
        </button>

        {/* Clear Console */}
        <button
          onClick={onClearLogs}
          title="Clear displayed logs"
          className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-gray-800 border border-gray-700 text-gray-300 hover:bg-gray-700 transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Clear</span>
        </button>

        {/* Export Evidence */}
        <button
          onClick={onExportLogs}
          title="Export filtered logs for QC evidence"
          className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white shadow-sm transition-colors"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Export Evidence</span>
        </button>
      </div>
    </header>
  );
};
