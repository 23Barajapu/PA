import React from 'react';
import { Search, Filter, Layers, Code, CheckCircle2, AlertTriangle } from 'lucide-react';
import { FilterState, ServiceName } from '../types';

interface FilterBarProps {
  filter: FilterState;
  onFilterChange: (newFilter: Partial<FilterState>) => void;
  totalLogs: number;
  filteredCount: number;
}

export const FilterBar: React.FC<FilterBarProps> = ({
  filter,
  onFilterChange,
  totalLogs,
  filteredCount
}) => {
  return (
    <div className="bg-[#111827]/90 border-b border-gray-800 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs">
      {/* Search Input with Regex Toggle */}
      <div className="flex items-center space-x-2 flex-1 min-w-[280px]">
        <div className="relative flex-1">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={filter.searchQuery}
            onChange={(e) => onFilterChange({ searchQuery: e.target.value })}
            placeholder="Search Trace ID, RRN, endpoint, status code or regex..."
            className="w-full bg-[#1f2937] border border-gray-700 rounded-lg pl-9 pr-8 py-1.5 text-xs text-gray-200 placeholder-gray-500 focus:outline-none focus:border-blue-500 font-mono transition-colors"
          />
          {filter.searchQuery && (
            <button
              onClick={() => onFilterChange({ searchQuery: '' })}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-200"
            >
              &times;
            </button>
          )}
        </div>

        {/* Regex toggle button */}
        <button
          onClick={() => onFilterChange({ isRegex: !filter.isRegex })}
          title="Enable Regular Expression search"
          className={`px-2.5 py-1.5 rounded-lg border font-mono font-bold text-xs flex items-center space-x-1 transition-all ${
            filter.isRegex
              ? 'bg-blue-600/30 border-blue-500 text-blue-300'
              : 'bg-gray-800 border-gray-700 text-gray-400 hover:text-gray-200'
          }`}
        >
          <Code className="w-3 h-3" />
          <span>.*</span>
        </button>
      </div>

      {/* Filter Dropdowns & Pills */}
      <div className="flex items-center space-x-2 flex-wrap">
        {/* Service Selector */}
        <div className="flex items-center space-x-1 bg-gray-800/80 border border-gray-700 rounded-lg p-0.5">
          <button
            onClick={() => onFilterChange({ serviceFilter: 'ALL' })}
            className={`px-2.5 py-1 rounded-md transition-colors ${
              filter.serviceFilter === 'ALL'
                ? 'bg-gray-700 text-white font-medium shadow-sm'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            All Pods
          </button>
          <button
            onClick={() => onFilterChange({ serviceFilter: 'api-gateway' as ServiceName })}
            className={`px-2.5 py-1 rounded-md transition-colors ${
              filter.serviceFilter === 'api-gateway'
                ? 'bg-blue-600/40 border border-blue-500/50 text-blue-200 font-medium'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            Gateway
          </button>
          <button
            onClick={() => onFilterChange({ serviceFilter: 'auth-otp-service' as ServiceName })}
            className={`px-2.5 py-1 rounded-md transition-colors ${
              filter.serviceFilter === 'auth-otp-service'
                ? 'bg-emerald-600/40 border border-emerald-500/50 text-emerald-200 font-medium'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            Auth OTP
          </button>
          <button
            onClick={() => onFilterChange({ serviceFilter: 'gate-service' as ServiceName })}
            className={`px-2.5 py-1 rounded-md transition-colors ${
              filter.serviceFilter === 'gate-service'
                ? 'bg-purple-600/40 border border-purple-500/50 text-purple-200 font-medium'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            Gate
          </button>
          <button
            onClick={() => onFilterChange({ serviceFilter: 'transport-core-swc' as ServiceName })}
            className={`px-2.5 py-1 rounded-md transition-colors ${
              filter.serviceFilter === 'transport-core-swc'
                ? 'bg-orange-600/40 border border-orange-500/50 text-orange-200 font-medium'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            Transport Core
          </button>
        </div>

        {/* Transaction Type Filter */}
        <div className="flex items-center space-x-1 bg-gray-800/80 border border-gray-700 rounded-lg p-0.5">
          <button
            onClick={() => onFilterChange({ txTypeFilter: 'ALL' })}
            className={`px-2.5 py-1 rounded-md ${
              filter.txTypeFilter === 'ALL'
                ? 'bg-gray-700 text-white font-medium'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            All Tx
          </button>
          <button
            onClick={() => onFilterChange({ txTypeFilter: 'LOGIN' })}
            className={`px-2.5 py-1 rounded-md ${
              filter.txTypeFilter === 'LOGIN'
                ? 'bg-emerald-600/40 border border-emerald-500/50 text-emerald-200 font-medium'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            Login & OTP
          </button>
          <button
            onClick={() => onFilterChange({ txTypeFilter: 'INQUIRY' })}
            className={`px-2.5 py-1 rounded-md ${
              filter.txTypeFilter === 'INQUIRY'
                ? 'bg-cyan-600/40 border border-cyan-500/50 text-cyan-200 font-medium'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            Inquiry (310000)
          </button>
          <button
            onClick={() => onFilterChange({ txTypeFilter: 'POSTING' })}
            className={`px-2.5 py-1 rounded-md ${
              filter.txTypeFilter === 'POSTING'
                ? 'bg-indigo-600/40 border border-indigo-500/50 text-indigo-200 font-medium'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            Posting (000000)
          </button>
        </div>

        {/* Status Outcome Filter */}
        <div className="flex items-center space-x-1 bg-gray-800/80 border border-gray-700 rounded-lg p-0.5">
          <button
            onClick={() => onFilterChange({ statusFilter: 'ALL' })}
            className={`px-2.5 py-1 rounded-md ${
              filter.statusFilter === 'ALL'
                ? 'bg-gray-700 text-white font-medium'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            All RC
          </button>
          <button
            onClick={() => onFilterChange({ statusFilter: 'SUCCESS' })}
            className={`px-2.5 py-1 rounded-md flex items-center space-x-1 ${
              filter.statusFilter === 'SUCCESS'
                ? 'bg-emerald-600/40 border border-emerald-500/50 text-emerald-200 font-medium'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
            <span>Success (00)</span>
          </button>
          <button
            onClick={() => onFilterChange({ statusFilter: 'ERROR' })}
            className={`px-2.5 py-1 rounded-md flex items-center space-x-1 ${
              filter.statusFilter === 'ERROR'
                ? 'bg-rose-600/40 border border-rose-500/50 text-rose-200 font-medium'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            <AlertTriangle className="w-3 h-3 text-rose-400" />
            <span>Errors/Timeout</span>
          </button>
        </div>

        {/* Count Indicator */}
        <div className="text-gray-400 font-mono text-[11px] px-2 py-1 bg-gray-900 border border-gray-800 rounded-md">
          {filteredCount} / {totalLogs} logs
        </div>
      </div>
    </div>
  );
};
