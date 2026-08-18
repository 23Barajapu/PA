import { LogLevel, ParsedLog, ServiceName, TransactionType } from './types.js';
import { maskLogMessage } from './masker.js';

let counter = 0;

export function parseRawLog(rawLine: string, podNameHint?: string, defaultService?: ServiceName): ParsedLog {
  const logId = `log-${Date.now()}-${++counter}`;
  const nowIso = new Date().toISOString();

  let timestamp = nowIso;
  let service: ServiceName = defaultService || 'api-gateway';
  let podName = podNameHint || 'pod-unknown';
  let level: LogLevel = 'INFO';
  let traceId: string | null = null;
  let rrn: string | null = null;
  let transactionType: TransactionType = 'UNKNOWN';
  let statusCode: string | null = null;
  let mti: string | null = null;
  let processingCode: string | null = null;
  let accountNumber: string | null = null;
  let amount: number | null = null;
  let latencyMs: number | null = null;
  let message = rawLine.trim();

  // Infer service from pod name if available
  if (podName.includes('gateway') || podName.includes('gw')) {
    service = 'api-gateway';
  } else if (podName.includes('otp') || podName.includes('auth') || podName.includes('login')) {
    service = 'auth-otp-service';
  } else if (podName.includes('gate') || podName.includes('routing')) {
    service = 'gate-service';
  } else if (podName.includes('transport') || podName.includes('swc') || podName.includes('iso')) {
    service = 'transport-core-swc';
  }

  // Attempt JSON parse
  let isJson = false;
  if (rawLine.startsWith('{') && rawLine.endsWith('}')) {
    try {
      const parsedJson = JSON.parse(rawLine);
      isJson = true;
      timestamp = parsedJson.timestamp || parsedJson.time || parsedJson['@timestamp'] || timestamp;
      level = normalizeLogLevel(parsedJson.level || parsedJson.severity || level);
      traceId = parsedJson.traceId || parsedJson.trace_id || parsedJson.x_request_id || parsedJson.correlationId || null;
      rrn = parsedJson.rrn || parsedJson.RRN || parsedJson.retrievalReferenceNumber || null;
      statusCode = parsedJson.statusCode || parsedJson.status_code || parsedJson.responseCode || parsedJson.rc || null;
      if (statusCode !== null) statusCode = String(statusCode);
      
      transactionType = detectTransactionType(parsedJson.transactionType || parsedJson.tx_type || parsedJson.endpoint || parsedJson.message || '');
      accountNumber = parsedJson.accountNumber || parsedJson.acc_no || null;
      amount = parsedJson.amount ? Number(parsedJson.amount) : null;
      latencyMs = parsedJson.latencyMs || parsedJson.duration_ms || parsedJson.elapsed || null;
      message = parsedJson.message || parsedJson.msg || JSON.stringify(parsedJson);
    } catch {
      // fallback to regex extraction
    }
  }

  if (!isJson) {
    // Regex extraction for standard Spring/K8s/ISO logs
    // Level detection
    const levelMatch = rawLine.match(/\b(INFO|WARN|WARNING|ERROR|DEBUG|FATAL)\b/i);
    if (levelMatch) {
      level = normalizeLogLevel(levelMatch[1]);
    }

    // Timestamp extraction (ISO8601 or standard 2026-08-18 09:30:15.123)
    const timeMatch = rawLine.match(/\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2}:\d{2}(?:\.\d{3,6})?(?:Z|[+-]\d{2}:\d{2})?/);
    if (timeMatch) {
      timestamp = timeMatch[0];
    }

    // Trace ID / X-Request-ID / Correlation ID
    const traceMatch = rawLine.match(/(?:trace[_-]?id|x[_-]request[_-]id|correlation[_-]?id|traceId)\s*[:=]\s*["']?([a-zA-Z0-9_-]{8,64})["']?/i);
    if (traceMatch) {
      traceId = traceMatch[1];
    }

    // RRN (Retrieval Reference Number - 12 digits in ISO8583)
    const rrnMatch = rawLine.match(/(?:rrn|referenceNumber|retrievalRef|F37|bit37)\s*[:=]\s*["']?([0-9]{6,12})["']?/i);
    if (rrnMatch) {
      rrn = rrnMatch[1];
    }

    // ISO8583 MTI (0200, 0210, 0800, 0810, 0420)
    const mtiMatch = rawLine.match(/\bMTI\s*[:=]\s*([0-9]{4})\b/i) || rawLine.match(/\b(0200|0210|0800|0810|0420)\b/);
    if (mtiMatch) {
      mti = mtiMatch[1];
    }

    // Processing Code (e.g. 310000 = Balance Inquiry, 000000 = Transfer / Posting)
    const procMatch = rawLine.match(/(?:ProcCode|ProcessingCode|F3|bit3)\s*[:=]\s*["']?([0-9]{6})["']?/i);
    if (procMatch) {
      processingCode = procMatch[1];
      if (processingCode.startsWith('31') || processingCode.startsWith('30')) {
        transactionType = 'INQUIRY';
      } else if (processingCode.startsWith('00') || processingCode.startsWith('40') || processingCode.startsWith('20')) {
        transactionType = 'POSTING';
      }
    }

    // Status / Response Code (HTTP 200/500 or ISO RC 00/68/51)
    const statusMatch = rawLine.match(/(?:status(?:[_-]?code)?|http[_-]?status|resp(?:onse)?[_-]?code|rc|RC|F39|bit39)\s*[:=]\s*["']?([0-9]{2,3})["']?/i);
    if (statusMatch) {
      statusCode = statusMatch[1];
    }

    // Latency extraction (e.g. 125ms or latency=125)
    const latMatch = rawLine.match(/(?:latency|duration|elapsed|took)\s*[:=]\s*(\d+)(?:\s*ms)?/i);
    if (latMatch) {
      latencyMs = parseInt(latMatch[1], 10);
    }

    // Tx Type fallback
    if (transactionType === 'UNKNOWN') {
      transactionType = detectTransactionType(rawLine);
    }
  }

  // Apply Security Masking
  const maskedMessage = maskLogMessage(message);
  const maskedRaw = maskLogMessage(rawLine);

  return {
    id: logId,
    timestamp,
    service,
    podName,
    level,
    traceId,
    rrn,
    transactionType,
    statusCode,
    mti,
    processingCode,
    accountNumber: accountNumber ? maskLogMessage(accountNumber) : null,
    amount,
    latencyMs,
    message: maskedMessage,
    rawLog: maskedRaw,
    masked: true
  };
}

function normalizeLogLevel(lvl: string): LogLevel {
  const upper = (lvl || '').toUpperCase();
  if (upper.includes('ERR') || upper.includes('FATAL')) return 'ERROR';
  if (upper.includes('WARN')) return 'WARN';
  if (upper.includes('DEBUG') || upper.includes('TRACE')) return 'DEBUG';
  return 'INFO';
}

function detectTransactionType(text: string): TransactionType {
  const upper = text.toUpperCase();
  if (upper.includes('OTP_VERIFY') || upper.includes('VERIFY_OTP') || upper.includes('VALIDATE_OTP') || upper.includes('VERIFY-OTP')) {
    return 'OTP_VERIFY';
  }
  if (upper.includes('LOGIN') || upper.includes('AUTH') || upper.includes('SIGNIN') || upper.includes('REQUEST_OTP') || upper.includes('SEND_OTP')) {
    return 'LOGIN';
  }
  if (upper.includes('INQUIRY') || upper.includes('BALANCE') || upper.includes('CEK_SALDO') || upper.includes('CHECK_ACCOUNT') || upper.includes('310000')) {
    return 'INQUIRY';
  }
  if (upper.includes('POSTING') || upper.includes('TRANSFER') || upper.includes('PAYMENT') || upper.includes('DEBIT') || upper.includes('CREDIT') || upper.includes('000000')) {
    return 'POSTING';
  }
  return 'UNKNOWN';
}
