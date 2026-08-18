import 'dotenv/config';
import express from 'express';
import http from 'http';
import { WebSocket, WebSocketServer } from 'ws';
import cors from 'cors';
import { parseRawLog } from './parser.js';
import { LogCorrelator } from './correlator.js';
import { K8sLogStreamer } from './k8s-streamer.js';
import { MockLogGenerator } from './mock-generator.js';
import { ParsedLog, ServiceName, StreamStats, WSClientMessage, WSServerMessage } from './types.js';

import { analyzeTraceWithAi } from './ai-analyzer.js';

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 4000;
const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws/logs' });

const correlator = new LogCorrelator(10000);
const k8sStreamer = new K8sLogStreamer({
  namespace: process.env.K8S_NAMESPACE || 'default'
});
const mockGenerator = new MockLogGenerator(1800);

let totalLogsProcessed = 0;
let logsThisSecond = 0;
let logsPerSecond = 0;
let mockMode = !k8sStreamer.getIsConnected();

// Calculate throughput (logs/sec)
setInterval(() => {
  logsPerSecond = logsThisSecond;
  logsThisSecond = 0;
}, 1000);

function broadcast(msg: WSServerMessage): void {
  const data = JSON.stringify(msg);
  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  }
}

function processIncomingLog(rawLine: string, podName: string, service?: ServiceName): void {
  const parsed = parseRawLog(rawLine, podName, service);
  correlator.addLog(parsed);
  totalLogsProcessed++;
  logsThisSecond++;

  broadcast({
    type: 'log',
    payload: parsed
  });
}

// Attach K8s Streamer listener
k8sStreamer.on('rawLog', (data: { rawLine: string; podName: string; service?: ServiceName }) => {
  processIncomingLog(data.rawLine, data.podName, data.service);
});

// Attach Mock Generator listener
mockGenerator.on('rawLog', (data: { rawLine: string; podName: string; service?: ServiceName }) => {
  processIncomingLog(data.rawLine, data.podName, data.service);
});

// Attach K8s Streamer fallback
k8sStreamer.on('fallback', () => {
  mockMode = true;
  mockGenerator.start();
  broadcast({
    type: 'stats',
    payload: getStats()
  });
});

// Start services
if (k8sStreamer.getIsConnected()) {
  console.log('[Server] Attempting connection to Kubernetes Cluster API...');
  k8sStreamer.start().catch(() => {
    mockMode = true;
    mockGenerator.start();
  });
} else {
  console.log('[Server] K8s not detected. Automatically starting Mock Banking Log Generator.');
  mockGenerator.start();
}

// WebSocket connection handling
wss.on('connection', (ws: WebSocket) => {
  console.log(`[WS] Client connected. Total clients: ${wss.clients.size}`);

  // Send initial recent logs (last 50 logs)
  const recentLogs = correlator.getRecentLogs(50);
  ws.send(JSON.stringify({
    type: 'batch_logs',
    payload: recentLogs
  }));

  // Send initial stats
  ws.send(JSON.stringify({
    type: 'stats',
    payload: getStats()
  }));

  ws.on('message', (message: string) => {
    try {
      const data: WSClientMessage = JSON.parse(message.toString());
      if (data.type === 'ping') {
        ws.send(JSON.stringify({ type: 'pong', payload: { time: Date.now() } }));
      } else if (data.type === 'get_trace' && data.payload?.traceId) {
        const trace = correlator.getTrace(data.payload.traceId);
        ws.send(JSON.stringify({
          type: 'trace_details',
          payload: trace
        }));
      }
    } catch (err) {
      console.error('[WS] Message parse error:', err);
    }
  });

  ws.on('close', () => {
    console.log(`[WS] Client disconnected. Total clients: ${wss.clients.size}`);
  });
});

// Periodic stats broadcast every 3s
setInterval(() => {
  broadcast({
    type: 'stats',
    payload: getStats()
  });
}, 3000);

function getStats(): StreamStats {
  return {
    connectedClients: wss.clients.size,
    totalLogsProcessed,
    logsPerSecond,
    k8sConnected: k8sStreamer.getIsConnected(),
    activePods: ['api-gateway', 'gate-service', 'transport-core-swc'],
    mockMode
  };
}

import { analyzeTraceLogs } from './ai-analyzer.js';

// REST Endpoints
app.get('/health', (_req, res) => {
  res.json({ status: 'UP', timestamp: new Date().toISOString() });
});

app.get('/api/stats', (_req, res) => {
  res.json(getStats());
});

app.get('/api/logs', (req, res) => {
  const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 100;
  const service = req.query.service as ServiceName | undefined;
  const logs = correlator.getRecentLogs(limit, service);
  res.json(logs);
});

app.get('/api/trace/:traceId', (req, res) => {
  const trace = correlator.getTrace(req.params.traceId);
  if (!trace) {
    return res.status(404).json({ error: 'Trace not found' });
  }
  res.json(trace);
});

app.post('/api/logs/analyze-trace', async (req, res) => {
  try {
    const traceId = req.body?.traceId;
    let trace: HopTrace | null = req.body?.trace || null;
    
    if (!trace && traceId) {
      trace = correlator.getTrace(traceId);
    }

    if (!trace) {
      return res.status(404).json({ error: 'Trace not found or invalid trace data provided.' });
    }

    const analysis = await analyzeTraceWithAi(trace);
    res.json(analysis);
  } catch (err: any) {
    console.error('[Server] AI Analysis error:', err?.message || err);
    res.status(500).json({ error: 'Failed to analyze trace log.' });
  }
});

app.post('/api/mock/toggle', (req, res) => {
  const enable = req.body?.enable !== undefined ? Boolean(req.body.enable) : !mockMode;
  mockMode = enable;
  if (mockMode) {
    mockGenerator.start();
  } else {
    mockGenerator.stop();
  }
  broadcast({
    type: 'stats',
    payload: getStats()
  });
  res.json({ mockMode });
});

server.listen(PORT, () => {
  console.log(`========================================================`);
  console.log(`🚀 Banking Log Tracing Platform Backend`);
  console.log(`   HTTP Server: http://localhost:${PORT}`);
  console.log(`   WebSocket:   ws://localhost:${PORT}/ws/logs`);
  console.log(`   Mock Mode:   ${mockMode ? 'ENABLED (Simulating)' : 'DISABLED (Using K8s)'}`);
  console.log(`========================================================`);
});
