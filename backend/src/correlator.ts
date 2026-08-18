import { HopTrace, ParsedLog, ServiceName } from './types.js';

export class RingBuffer<T> {
  private buffer: T[];
  private capacity: number;
  private head: number = 0;
  private size: number = 0;

  constructor(capacity: number = 5000) {
    this.capacity = capacity;
    this.buffer = new Array<T>(capacity);
  }

  push(item: T): void {
    this.buffer[this.head] = item;
    this.head = (this.head + 1) % this.capacity;
    if (this.size < this.capacity) {
      this.size++;
    }
  }

  toArray(): T[] {
    if (this.size < this.capacity) {
      return this.buffer.slice(0, this.size);
    }
    return [
      ...this.buffer.slice(this.head),
      ...this.buffer.slice(0, this.head)
    ];
  }

  clear(): void {
    this.buffer = new Array<T>(this.capacity);
    this.head = 0;
    this.size = 0;
  }

  getSize(): number {
    return this.size;
  }
}

export class LogCorrelator {
  private globalBuffer: RingBuffer<ParsedLog>;
  private serviceBuffers: Map<ServiceName, RingBuffer<ParsedLog>>;
  private traceIndex: Map<string, HopTrace>;
  private rrnToTraceMap: Map<string, string>;
  private maxTraces: number = 2000;

  constructor(maxLogs: number = 10000) {
    this.globalBuffer = new RingBuffer<ParsedLog>(maxLogs);
    this.serviceBuffers = new Map([
      ['api-gateway', new RingBuffer<ParsedLog>(3000)],
      ['auth-otp-service', new RingBuffer<ParsedLog>(3000)],
      ['gate-service', new RingBuffer<ParsedLog>(3000)],
      ['transport-core-swc', new RingBuffer<ParsedLog>(3000)]
    ]);
    this.traceIndex = new Map();
    this.rrnToTraceMap = new Map();
  }

  addLog(log: ParsedLog): void {
    this.globalBuffer.push(log);
    
    const svcBuf = this.serviceBuffers.get(log.service);
    if (svcBuf) {
      svcBuf.push(log);
    }

    if (log.traceId) {
      this.indexTraceLog(log.traceId, log);
    } else if (log.rrn) {
      const existingTraceId = this.rrnToTraceMap.get(log.rrn);
      if (existingTraceId) {
        this.indexTraceLog(existingTraceId, log);
      }
    }
  }

  private indexTraceLog(traceId: string, log: ParsedLog): void {
    // Evict old traces if cache gets too large
    if (this.traceIndex.size > this.maxTraces) {
      const oldestKey = this.traceIndex.keys().next().value;
      if (oldestKey) {
        this.traceIndex.delete(oldestKey);
      }
    }

    let hopTrace = this.traceIndex.get(traceId);
    if (!hopTrace) {
      hopTrace = {
        traceId,
        rrn: log.rrn || null,
        transactionType: log.transactionType,
        startTime: log.timestamp,
        isComplete: false,
        hasError: false,
        hops: {
          gateway: [],
          authOtp: [],
          gate: [],
          transport: []
        }
      };
      this.traceIndex.set(traceId, hopTrace);
    }

    if (log.rrn && !hopTrace.rrn) {
      hopTrace.rrn = log.rrn;
      this.rrnToTraceMap.set(log.rrn, traceId);
    }

    if (log.transactionType !== 'UNKNOWN' && hopTrace.transactionType === 'UNKNOWN') {
      hopTrace.transactionType = log.transactionType;
    }

    if (log.service === 'api-gateway') {
      hopTrace.hops.gateway = hopTrace.hops.gateway || [];
      hopTrace.hops.gateway.push(log);
    } else if (log.service === 'auth-otp-service') {
      hopTrace.hops.authOtp = hopTrace.hops.authOtp || [];
      hopTrace.hops.authOtp.push(log);
    } else if (log.service === 'gate-service') {
      hopTrace.hops.gate = hopTrace.hops.gate || [];
      hopTrace.hops.gate.push(log);
    } else if (log.service === 'transport-core-swc') {
      hopTrace.hops.transport = hopTrace.hops.transport || [];
      hopTrace.hops.transport.push(log);
    }

    if (log.level === 'ERROR' || (log.statusCode && log.statusCode !== '200' && log.statusCode !== '00')) {
      hopTrace.hasError = true;
    }

    if (log.statusCode) {
      hopTrace.finalStatus = log.statusCode;
    }

    hopTrace.endTime = log.timestamp;

    // Check completeness (has touched all 3 hops)
    const hasGateway = (hopTrace.hops.gateway?.length || 0) > 0;
    const hasGate = (hopTrace.hops.gate?.length || 0) > 0;
    const hasTransport = (hopTrace.hops.transport?.length || 0) > 0;
    hopTrace.isComplete = hasGateway && hasGate && hasTransport;

    if (hopTrace.startTime && hopTrace.endTime) {
      const start = new Date(hopTrace.startTime).getTime();
      const end = new Date(hopTrace.endTime).getTime();
      hopTrace.totalLatencyMs = Math.max(0, end - start);
    }
  }

  getRecentLogs(limit: number = 100, service?: ServiceName): ParsedLog[] {
    let logs: ParsedLog[];
    if (service && this.serviceBuffers.has(service)) {
      logs = this.serviceBuffers.get(service)!.toArray();
    } else {
      logs = this.globalBuffer.toArray();
    }
    return logs.slice(-limit);
  }

  getTrace(traceIdOrRrn: string): HopTrace | null {
    if (this.traceIndex.has(traceIdOrRrn)) {
      return this.traceIndex.get(traceIdOrRrn)!;
    }
    const mappedTraceId = this.rrnToTraceMap.get(traceIdOrRrn);
    if (mappedTraceId && this.traceIndex.has(mappedTraceId)) {
      return this.traceIndex.get(mappedTraceId)!;
    }
    return null;
  }

  clear(): void {
    this.globalBuffer.clear();
    this.serviceBuffers.forEach(buf => buf.clear());
    this.traceIndex.clear();
    this.rrnToTraceMap.clear();
  }
}
