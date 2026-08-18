import React, { useState, useMemo } from 'react';
import { useLogStream } from './hooks/useLogStream';
import { Navbar } from './components/Navbar';
import { FilterBar } from './components/FilterBar';
import { LogTerminal } from './components/LogTerminal';
import { TraceCorrelatorModal } from './components/TraceCorrelatorModal';
import { FilterState, ParsedLog } from './types';

export const App: React.FC = () => {
  const {
    logs,
    isPaused,
    isConnected,
    stats,
    pausedCount,
    selectedTrace,
    isTraceModalOpen,
    setIsTraceModalOpen,
    togglePause,
    clearLogs,
    fetchTraceDetails,
    toggleMock
  } = useLogStream();

  const [filter, setFilter] = useState<FilterState>({
    searchQuery: '',
    serviceFilter: 'ALL',
    txTypeFilter: 'ALL',
    statusFilter: 'ALL',
    isRegex: false
  });

  const handleFilterChange = (updates: Partial<FilterState>) => {
    setFilter((prev) => ({ ...prev, ...updates }));
  };

  // Filter logs logic
  const filteredLogs = useMemo(() => {
    return logs.filter((log: ParsedLog) => {
      // 1. Service filter
      if (filter.serviceFilter !== 'ALL' && log.service !== filter.serviceFilter) {
        return false;
      }

      // 2. Tx Type filter
      if (filter.txTypeFilter !== 'ALL' && log.transactionType !== filter.txTypeFilter) {
        return false;
      }

      // 3. Status filter
      if (filter.statusFilter === 'SUCCESS') {
        if (log.statusCode && log.statusCode !== '200' && log.statusCode !== '00') return false;
        if (log.level === 'ERROR') return false;
      } else if (filter.statusFilter === 'ERROR') {
        const isErr = log.level === 'ERROR' || (log.statusCode && log.statusCode !== '200' && log.statusCode !== '00');
        if (!isErr) return false;
      }

      // 4. Search query
      if (filter.searchQuery.trim()) {
        const query = filter.searchQuery.trim();
        if (filter.isRegex) {
          try {
            const regex = new RegExp(query, 'i');
            return (
              regex.test(log.message) ||
              regex.test(log.rawLog) ||
              regex.test(log.traceId || '') ||
              regex.test(log.rrn || '') ||
              regex.test(log.statusCode || '')
            );
          } catch {
            return false;
          }
        } else {
          const lower = query.toLowerCase();
          return (
            log.message.toLowerCase().includes(lower) ||
            log.rawLog.toLowerCase().includes(lower) ||
            (log.traceId && log.traceId.toLowerCase().includes(lower)) ||
            (log.rrn && log.rrn.includes(lower)) ||
            (log.statusCode && log.statusCode.includes(lower))
          );
        }
      }

      return true;
    });
  }, [logs, filter]);

  // Export Filtered Evidence
  const handleExportEvidence = () => {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `banking-trace-evidence-${timestamp}.txt`;

    let textContent = `========================================================================\n`;
    textContent += `BANKING MICROSERVICES LOG TRACE EVIDENCE\n`;
    textContent += `Generated at: ${new Date().toISOString()}\n`;
    textContent += `Filter Applied: Query="${filter.searchQuery}", Pod="${filter.serviceFilter}", Tx="${filter.txTypeFilter}", Status="${filter.statusFilter}"\n`;
    textContent += `Total Records: ${filteredLogs.length}\n`;
    textContent += `========================================================================\n\n`;

    filteredLogs.forEach((log, index) => {
      textContent += `[${index + 1}] ${log.timestamp} | [${log.service.toUpperCase()}] [${log.level}] | TraceID: ${log.traceId || 'N/A'} | RRN: ${log.rrn || 'N/A'} | RC: ${log.statusCode || 'N/A'}\n`;
      textContent += `    Message: ${log.message}\n`;
      textContent += `    Raw:     ${log.rawLog}\n\n`;
    });

    const blob = new Blob([textContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="h-screen w-screen flex flex-col bg-[#0b0f19] text-gray-100 overflow-hidden font-sans">
      {/* Header Bar */}
      <Navbar
        stats={stats}
        isConnected={isConnected}
        isPaused={isPaused}
        pausedCount={pausedCount}
        onTogglePause={togglePause}
        onClearLogs={clearLogs}
        onExportLogs={handleExportEvidence}
        onToggleMock={toggleMock}
      />

      {/* Filter and Search Bar */}
      <FilterBar
        filter={filter}
        onFilterChange={handleFilterChange}
        totalLogs={logs.length}
        filteredCount={filteredLogs.length}
      />

      {/* Terminal View with Virtual Scrolling */}
      <LogTerminal
        logs={filteredLogs}
        onSelectTrace={fetchTraceDetails}
        isPaused={isPaused}
      />

      {/* 3-Hop Trace Correlator Modal */}
      <TraceCorrelatorModal
        trace={selectedTrace}
        isOpen={isTraceModalOpen}
        onClose={() => setIsTraceModalOpen(false)}
      />
    </div>
  );
};
export default App;
