# Kubernetes Real-Time Banking Microservices Log Tracing & Diagnostic Platform

A low-latency, resilient log aggregation and transaction correlation platform designed for banking switching environments running on Kubernetes clusters. 

The system captures, masks, and correlates multi-hop transaction flows across API Gateway, Gate Routing, Auth/OTP, and Core Banking ISO8583 Transport pods, streaming synchronized events to a virtualized web terminal via WebSocket.

---

## 1. Problem Statement & Architecture

In banking switching architectures, high-volume transactions traverse multiple decoupled microservices pods:
1. **API Gateway Pod**: Ingress traffic, TLS termination, client authentication, and raw payload reception.
2. **Auth & OTP Service Pod**: Credential verification, session token generation, and multi-factor SMS OTP handling.
3. **Gate Service Pod**: Business routing, transaction validation, KYC verification, and payload transformation.
4. **Transport Core SWC Pod**: ISO8583 message creation (MTI 0200/0210), bitmap encoding, and TCP socket communication with Core Banking hosts.

Traditional container management consoles frequently suffer from WebSocket connection dropouts and lack multi-pod transaction indexing. This platform resolves dropped streams using automated reconnection backoff and correlates disparate pod logs by `Trace ID` and `RRN` (Retrieval Reference Number).

### Microservices Hop Topology

```
[ Client Request ]
       │ (HTTP POST)
       ▼
[ API Gateway Pod ] ──(Auth/Login)──► [ Auth & OTP Service Pod ]
       │ (Valid Token)
       ▼
[ Gate Routing Pod ]
       │ (Transformed Payload)
       ▼
[ Transport Core SWC Pod ] ──(ISO8583 TCP)──► [ Core Banking Host ]
       │
       ▼
[ In-Memory Ring Buffer & WebSocket Hub ]
       │
       ▼
[ QC Web UI / Virtual Terminal ] ──(On Demand)──► [ AI Diagnostic Engine ]
```

---

## 2. Core Modules

### In-Memory Ring Buffer & Correlator
- Circular buffer maintaining up to 10,000 global log entries and 3,000 entries per microservice with zero disk I/O overhead.
- Indexes transactions in real-time by `traceId` and ISO8583 `rrn`.
- Reconstructs complete execution timeline, calculates latency per hop, and detects protocol return codes.

### Security Sanitization Engine

Enforces automated regex-based data masking prior to memory storage and network broadcasting:
- **Card PAN**: 16-digit Primary Account Numbers masked to standard format (`4111-****-****-4444`).
- **Account Numbers**: 10 to 14 digit bank account numbers masked (`5021****78`).
- **Bearer Tokens**: JWT signatures replaced with `[MASKED_SIGNATURE]`.
- **PIN Blocks & Passwords**: ISO8583 Field 52 (bit52) and authentication secrets sanitized to `[MASKED_PIN_BLOCK]`.

### AI Diagnostic & Defect Assistant

- Supports integration with local Ollama (`llama3`), Google Gemini 1.5 Flash, OpenAI API, and a built-in banking heuristic fallback engine.
- Evaluates protocol failures (ISO8583 RC `68` Host Timeout, RC `51` Insufficient Funds, HTTP `504` Gateway Timeout, HTTP `401` Unauthorized).
- Generates root cause summaries and structured Jira defect reports with one-click clipboard export.

### Virtualized Web Terminal

- Built on React and `@tanstack/react-virtual` for smooth rendering of 10,000+ rows.
- Multi-column filtering by Pod Name, Transaction Type (Inquiry, Posting, Login, OTP), Status Code, and Regex query.
- Viewport freeze buffer allowing inspection of historical logs while streaming continues in the background.

---

## 3. Technology Stack

- **Backend**: Node.js, TypeScript, Express, `ws` (native WebSocket), `@kubernetes/client-node`.
- **Frontend**: React 18, Vite, TypeScript, Tailwind CSS, `@tanstack/react-virtual`, Lucide Icons.
- **Testing**: Node.js native test runner (`node:test`, `node:assert`).

---

## 4. Prerequisites

- Node.js >= 20.x
- npm >= 10.x
- Kubernetes Cluster access via `kubeconfig` (Optional: Built-in Mock Simulator runs automatically if no cluster is connected).

---

## 5. Installation & Local Setup

### Step 1: Clone and Install Dependencies

```bash
# Clone repository
git clone https://github.com/23Barajapu/PA.git
cd PA

# Install root dependencies
npm install

# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install
cd ..
```

### Step 2: Configure Environment Variables

Create `.env` inside `/backend` directory:

```env
# Server Configuration
PORT=4000
K8S_NAMESPACE=default

# Kubernetes Configuration (Optional for live cluster)
# KUBECONFIG=C:/Users/Administrator/.kube/config

# AI Engine Configuration (Select one)
# Opsi 1: Google Gemini API
GEMINI_API_KEY=your_gemini_api_key_here

# Opsi 2: Local Ollama
# OLLAMA_URL=http://localhost:11434
# OLLAMA_MODEL=llama3

# Opsi 3: OpenAI API
# OPENAI_API_KEY=your_openai_api_key_here
```

### Step 3: Run Development Server

```bash
# Run backend and frontend concurrently from root directory
npm run dev
```

- Web Interface: `http://localhost:5173`
- Backend REST API: `http://localhost:4000`
- WebSocket Server: `ws://localhost:4000/ws/logs`

---

## 6. API Reference

### REST Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/health` | Healthcheck and server timestamp |
| `GET` | `/api/stats` | Cluster connection status, client count, and throughput |
| `GET` | `/api/logs` | Fetch recent logs (Query params: `limit`, `service`) |
| `GET` | `/api/trace/:traceId` | Retrieve full multi-hop trace timeline |
| `POST` | `/api/logs/analyze-trace` | Trigger AI root cause diagnostic and Jira draft |
| `POST` | `/api/mock/toggle` | Toggle between Mock Simulator and K8s Cluster |

### WebSocket Protocol (`/ws/logs`)

**Client to Server:**
- Ping: `{"type": "ping"}`
- Get Trace: `{"type": "get_trace", "payload": {"traceId": "trx-xxx"}}`

**Server to Client:**
- Single Log Event: `{"type": "log", "payload": { ...ParsedLog }}`
- Initial Batch: `{"type": "batch_logs", "payload": [ ...ParsedLog ]}`
- Diagnostics: `{"type": "stats", "payload": { ...StreamStats }}`

---

## 7. Verification & Automated Testing

Execute the test suite to validate data sanitization, log parsing, ring buffer bounds, and AI defect heuristics:

```bash
cd backend
npm test
```

Build production bundles:

```bash
# Verify backend compilation
cd backend && npm run build

# Verify frontend bundle
cd ../frontend && npm run build
```

---

## 8. Deployment via Docker

```dockerfile
# Backend Containerfile
FROM node:20-alpine AS build
WORKDIR /app
COPY backend/package*.json ./
RUN npm install
COPY backend/ ./
RUN npm run build

EXPOSE 4000
CMD ["npm", "start"]
```

---

## 9. Security and Compliance

All log messages transmitted to client browsers undergo mandatory field-level sanitation on the server side. Raw authorization tokens, unencrypted PAN data, and PIN verification blocks are permanently removed before reaching the WebSocket transport layer.
