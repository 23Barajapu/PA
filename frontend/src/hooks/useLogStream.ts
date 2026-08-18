import { useState, useEffect, useRef, useCallback } from 'react';
import { ParsedLog, StreamStats, HopTrace } from '../types';

const WS_URL = 'ws://localhost:4000/ws/logs';
const MAX_CLIENT_LOGS = 5000;

export function useLogStream() {
  const [logs, setLogs] = useState<ParsedLog[]>([]);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [stats, setStats] = useState<StreamStats>({
    connectedClients: 0,
    totalLogsProcessed: 0,
    logsPerSecond: 0,
    k8sConnected: false,
    activePods: [],
    mockMode: false
  });
  const [selectedTrace, setSelectedTrace] = useState<HopTrace | null>(null);
  const [isTraceModalOpen, setIsTraceModalOpen] = useState<boolean>(false);

  const wsRef = useRef<WebSocket | null>(null);
  const pausedBufferRef = useRef<ParsedLog[]>([]);
  const reconnectTimeoutRef = useRef<any>(null);
  const heartbeatIntervalRef = useRef<any>(null);
  const reconnectAttemptsRef = useRef<number>(0);

  const connect = useCallback(() => {
    if (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) {
      return;
    }

    try {
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
        reconnectAttemptsRef.current = 0;

        // Start heartbeat ping every 5s
        if (heartbeatIntervalRef.current) clearInterval(heartbeatIntervalRef.current);
        heartbeatIntervalRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'ping' }));
          }
        }, 5000);
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'log') {
            const newLog: ParsedLog = msg.payload;
            if (isPaused) {
              pausedBufferRef.current.push(newLog);
              if (pausedBufferRef.current.length > 2000) {
                pausedBufferRef.current.shift();
              }
            } else {
              setLogs((prev) => {
                const next = [...prev, newLog];
                return next.length > MAX_CLIENT_LOGS ? next.slice(-MAX_CLIENT_LOGS) : next;
              });
            }
          } else if (msg.type === 'batch_logs') {
            const batch: ParsedLog[] = msg.payload;
            setLogs(batch);
          } else if (msg.type === 'stats') {
            setStats(msg.payload);
          } else if (msg.type === 'trace_details') {
            setSelectedTrace(msg.payload);
            setIsTraceModalOpen(true);
          }
        } catch (err) {
          console.error('[WS-Hook] Error parsing message:', err);
        }
      };

      ws.onclose = () => {
        setIsConnected(false);
        if (heartbeatIntervalRef.current) clearInterval(heartbeatIntervalRef.current);
        scheduleReconnect();
      };

      ws.onerror = (err) => {
        console.warn('[WS-Hook] Connection error:', err);
        ws.close();
      };
    } catch (err) {
      scheduleReconnect();
    }
  }, [isPaused]);

  const scheduleReconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
    const delay = Math.min(2000 * Math.pow(1.5, reconnectAttemptsRef.current), 15000);
    reconnectAttemptsRef.current += 1;
    reconnectTimeoutRef.current = setTimeout(() => {
      connect();
    }, delay);
  }, [connect]);

  useEffect(() => {
    connect();
    return () => {
      if (wsRef.current) wsRef.current.close();
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (heartbeatIntervalRef.current) clearInterval(heartbeatIntervalRef.current);
    };
  }, [connect]);

  const togglePause = useCallback(() => {
    setIsPaused((prev) => {
      const next = !prev;
      if (!next && pausedBufferRef.current.length > 0) {
        // Flushing paused buffer into view
        const buffered = [...pausedBufferRef.current];
        pausedBufferRef.current = [];
        setLogs((current) => {
          const combined = [...current, ...buffered];
          return combined.length > MAX_CLIENT_LOGS ? combined.slice(-MAX_CLIENT_LOGS) : combined;
        });
      }
      return next;
    });
  }, []);

  const clearLogs = useCallback(() => {
    setLogs([]);
    pausedBufferRef.current = [];
  }, []);

  const fetchTraceDetails = useCallback((traceId: string) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'get_trace',
        payload: { traceId }
      }));
    } else {
      // HTTP fallback
      fetch(`http://localhost:4000/api/trace/${traceId}`)
        .then(res => res.json())
        .then(data => {
          setSelectedTrace(data);
          setIsTraceModalOpen(true);
        })
        .catch(err => console.error('Failed to fetch trace details:', err));
    }
  }, []);

  const toggleMock = useCallback(async () => {
    try {
      await fetch('http://localhost:4000/api/mock/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enable: !stats.mockMode })
      });
    } catch (err) {
      console.error('Failed to toggle mock:', err);
    }
  }, [stats.mockMode]);

  return {
    logs,
    isPaused,
    isConnected,
    stats,
    pausedCount: pausedBufferRef.current.length,
    selectedTrace,
    isTraceModalOpen,
    setIsTraceModalOpen,
    togglePause,
    clearLogs,
    fetchTraceDetails,
    toggleMock
  };
}
