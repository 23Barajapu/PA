# Real-Time Microservices Banking Log Tracing & Monitoring Platform

A high-performance, ultra-stable real-time log aggregator and transaction correlator specifically engineered for Kubernetes banking switching microservices.

## Architecture Overview

```
[ K8s API / Mock Generator ]
        │ (Auto-reconnecting stream)
        ▼
[ Backend Core Engine ] (Node.js + TypeScript)
  ├── 1. Security Masking (Regex PAN, PIN Block, Auth Tokens)
  ├── 2. ISO8583 & HTTP Log Parser (MTI, RRN, ProcCode, Status)
  ├── 3. In-Memory Ring Buffer (5,000 logs per pod)
  └── 4. WebSocket Hub (ws + 5s Ping/Pong Heartbeat)
        │
        ▼ (Bi-directional WS /ws/logs)
[ Modern QC Web UI ] (React + Vite + Tailwind + TanStack Virtual)
  ├── Multi-Pod Badge System (Gateway: Blue | Gate: Purple | Transport: Orange)
  ├── 3-Hop Trace Correlator (Gateway -> Gate -> Transport Core SWC)
  ├── Virtual Terminal (Smooth 10,000+ rows rendering)
  ├── Freeze Viewport Buffer & Real-Time Regex Filtering
  └── Export Evidence (.txt / .json) for QA bug reporting
```

---

## Quick Start (Local Demo / Mock Mode)

The platform includes a built-in realistic mock transaction generator that simulates live Inquiry (`310000`) and Posting (`000000`) ISO8583 flows with delays and occasional errors (`RC: 68` Timeout / `RC: 51` Insufficient Funds).

### 1. Install Dependencies
```bash
# Install root dependencies
npm install

# Install backend dependencies
cd backend && npm install

# Install frontend dependencies
cd ../frontend && npm install
```

### 2. Run Both Services
From the root directory:
```bash
npm run dev
```

- **Frontend Web UI**: `http://localhost:5173`
- **Backend API & WS**: `http://localhost:4000` (WebSocket: `ws://localhost:4000/ws/logs`)

---

## Kubernetes Production Configuration

### 1. Using Standard `kubeconfig`
Place your kubeconfig in standard path `~/.kube/config` or set environment variable:
```bash
export KUBECONFIG=/path/to/your/rancher-cluster.kubeconfig
export K8S_NAMESPACE=switching-dev
```

### 2. Microservice Pod Matching Pattern
The daemon automatically scans and streams logs matching:
- **API Gateway**: pods containing `gateway` or `gw`
- **Gate Service**: pods containing `gate` or `routing`
- **Transport Core SWC**: pods containing `transport`, `swc`, or `iso`

### 3. Running in Docker / K8s Cluster
```dockerfile
# Backend Dockerfile
FROM node:20-alpine AS backend-build
WORKDIR /app
COPY backend/package*.json ./
RUN npm install
COPY backend/ ./
RUN npm run build

EXPOSE 4000
CMD ["npm", "start"]
```

---

## Security & Data Privacy Policy

All logs streamed to clients are processed through the backend security sanitization engine:
- **Card PAN**: `4111 2222 3333 4444` $\rightarrow$ `4111-****-****-4444`
- **Account Numbers**: `50212345678` $\rightarrow$ `5021****78`
- **Bearer Tokens**: `Bearer eyJ...` $\rightarrow$ `Bearer [MASKED_SIGNATURE]`
- **ISO8583 PIN Blocks**: `bit52` $\rightarrow$ `[MASKED_PIN_BLOCK]`
