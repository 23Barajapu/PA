export type ServiceName = 'api-gateway' | 'gate-service' | 'transport-core-swc' | 'auth-otp-service';

export type TransactionType = 'INQUIRY' | 'POSTING' | 'LOGIN' | 'OTP_VERIFY' | 'UNKNOWN';

export type LogLevel = 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';

export interface ParsedLog {
  id: string;
  timestamp: string;
  service: ServiceName;
  podName: string;
  level: LogLevel;
  traceId: string | null;
  rrn: string | null;
  transactionType: TransactionType;
  statusCode: string | null; // e.g. "200", "500", "00", "68", "51", "401"
  mti?: string | null;        // e.g. "0200", "0210"
  processingCode?: string | null; // e.g. "310000" (Inquiry), "000000" (Posting)
  accountNumber?: string | null;
  amount?: number | null;
  latencyMs?: number | null;
  message: string;
  rawLog: string;
  masked: boolean;
}

export interface HopTrace {
  traceId: string;
  rrn: string | null;
  transactionType: TransactionType;
  startTime: string;
  endTime?: string;
  totalLatencyMs?: number;
  finalStatus?: string;
  isComplete: boolean;
  hasError: boolean;
  hops: {
    gateway?: ParsedLog[];
    authOtp?: ParsedLog[];
    gate?: ParsedLog[];
    transport?: ParsedLog[];
  };
}

export interface StreamStats {
  connectedClients: number;
  totalLogsProcessed: number;
  logsPerSecond: number;
  k8sConnected: boolean;
  activePods: string[];
  mockMode: boolean;
}

export interface WSClientMessage {
  type: 'subscribe' | 'ping' | 'filter' | 'get_history' | 'get_trace';
  payload?: any;
}

export interface WSServerMessage {
  type: 'log' | 'batch_logs' | 'stats' | 'pong' | 'trace_details' | 'k8s_status';
  payload: any;
}
