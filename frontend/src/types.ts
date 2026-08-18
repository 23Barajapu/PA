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
  statusCode: string | null;
  mti?: string | null;
  processingCode?: string | null;
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

export interface AiAnalysisResult {
  traceId: string;
  rrn: string | null;
  transactionType: string;
  status: 'SUCCESS' | 'FAILURE' | 'WARNING';
  failedService: string | null;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';
  rootCause: string;
  technicalDetails: string;
  recommendedAction: string;
  engineUsed: string;
  jiraTicket: {
    summary: string;
    issueType: 'Bug' | 'Incident' | 'Task';
    priority: 'Highest' | 'High' | 'Medium' | 'Low';
    description: string;
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

export interface FilterState {
  searchQuery: string;
  serviceFilter: 'ALL' | ServiceName;
  txTypeFilter: 'ALL' | 'INQUIRY' | 'POSTING' | 'LOGIN' | 'OTP_VERIFY';
  statusFilter: 'ALL' | 'SUCCESS' | 'ERROR';
  isRegex: boolean;
}
