import { EventEmitter } from 'events';

export class MockLogGenerator extends EventEmitter {
  private timer: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;
  private intervalMs: number;

  constructor(intervalMs: number = 1800) {
    super();
    this.intervalMs = intervalMs;
  }

  start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.scheduleNext();
  }

  stop(): void {
    this.isRunning = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  private scheduleNext(): void {
    if (!this.isRunning) return;
    const randomDelay = this.intervalMs + (Math.random() * 800 - 400);
    this.timer = setTimeout(() => {
      this.simulateTransaction();
      this.scheduleNext();
    }, Math.max(600, randomDelay));
  }

  private simulateTransaction(): void {
    const txRand = Math.random();
    
    if (txRand < 0.35) {
      this.simulateLoginOtpTransaction();
    } else {
      this.simulateFinancialTransaction(txRand < 0.65 ? 'INQUIRY' : 'POSTING');
    }
  }

  private simulateLoginOtpTransaction(): void {
    const traceId = `trx-login-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
    const rrn = Math.floor(100000000000 + Math.random() * 900000000000).toString();
    const username = `user_${Math.floor(1000 + Math.random() * 9000)}`;
    const isOtpVerify = Math.random() > 0.4;
    const isSuccess = Math.random() > 0.15;
    const httpStatus = isSuccess ? 200 : 401;

    const podGateway = 'api-gateway-79dfb89bc-k92lx';
    const podAuthOtp = 'auth-otp-service-7f6da91-bx201';

    // Step 1: API Gateway (Login / OTP Request Ingress)
    setTimeout(() => {
      this.emit('rawLog', {
        timestamp: new Date().toISOString(),
        service: 'api-gateway',
        podName: podGateway,
        rawLine: JSON.stringify({
          timestamp: new Date().toISOString(),
          level: 'INFO',
          service: 'api-gateway',
          traceId,
          rrn,
          tx_type: isOtpVerify ? 'OTP_VERIFY' : 'LOGIN',
          endpoint: isOtpVerify ? '/api/v1/auth/verify-otp' : '/api/v1/auth/login',
          client_ip: '192.168.1.105',
          message: `[API-GW] Received ${isOtpVerify ? 'OTP verification' : 'User authentication'} request for username=${username}. Routing to auth-otp-service.`
        })
      });
    }, 0);

    // Step 2: Auth OTP Service (Validation, OTP Generation / Token Exchange)
    setTimeout(() => {
      const generatedOtp = Math.floor(100000 + Math.random() * 900000);
      this.emit('rawLog', {
        timestamp: new Date().toISOString(),
        service: 'auth-otp-service',
        podName: podAuthOtp,
        rawLine: `[${new Date().toISOString()}] [auth-otp-service] ${isSuccess ? 'INFO' : 'WARN'} trace_id=${traceId} rrn=${rrn} user=${username} otpCode=${generatedOtp} - ${
          isOtpVerify
            ? (isSuccess ? 'OTP matched successfully. Generating session JWT bearer token.' : 'Invalid OTP code entered. Attempt 2 of 3.')
            : 'Credentials valid. Generated 6-digit SMS OTP. Dispatching to Notification Gateway.'
        }`
      });
    }, 120 + Math.random() * 60);

    // Step 3: API Gateway (Response Sent)
    setTimeout(() => {
      this.emit('rawLog', {
        timestamp: new Date().toISOString(),
        service: 'api-gateway',
        podName: podGateway,
        rawLine: JSON.stringify({
          timestamp: new Date().toISOString(),
          level: isSuccess ? 'INFO' : 'WARN',
          service: 'api-gateway',
          traceId,
          rrn,
          tx_type: isOtpVerify ? 'OTP_VERIFY' : 'LOGIN',
          statusCode: String(httpStatus),
          duration_ms: Math.floor(220 + Math.random() * 80),
          message: `[API-GW] Completed HTTP ${httpStatus} for ${isOtpVerify ? 'OTP verification' : 'Login'} username=${username} traceId=${traceId}`
        })
      });
    }, 280 + Math.random() * 70);
  }

  private simulateFinancialTransaction(txType: 'INQUIRY' | 'POSTING'): void {
    const isPosting = txType === 'POSTING';
    const traceId = `trx-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 7)}`;
    const rrn = Math.floor(100000000000 + Math.random() * 900000000000).toString();
    const sourceAcc = `502${Math.floor(1000000 + Math.random() * 9000000)}`;
    const destAcc = isPosting ? `508${Math.floor(1000000 + Math.random() * 9000000)}` : null;
    const amount = isPosting ? (Math.floor(Math.random() * 20) + 1) * 50000 : 0;
    
    // Status outcome
    const roll = Math.random();
    let isSuccess = true;
    let isoRc = '00';
    let httpStatus = 200;
    let statusDesc = 'APPROVED / SUCCESS';

    if (roll > 0.90) {
      isSuccess = false;
      isoRc = '68'; // ISO Timeout
      httpStatus = 504;
      statusDesc = 'SUSPECT / CORE BANKING TIMEOUT';
    } else if (roll > 0.82) {
      isSuccess = false;
      isoRc = '51'; // Insufficient Funds
      httpStatus = 400;
      statusDesc = 'DECLINED / INSUFFICIENT BALANCE';
    }

    const podGateway = 'api-gateway-79dfb89bc-k92lx';
    const podGate = 'gate-service-58d7c49b-mn82z';
    const podTransport = 'transport-core-swc-6f8cb584-p41jq';

    // Step 1: API Gateway (Entry)
    setTimeout(() => {
      const gwInLog = {
        timestamp: new Date().toISOString(),
        service: 'api-gateway',
        podName: podGateway,
        rawLine: JSON.stringify({
          timestamp: new Date().toISOString(),
          level: 'INFO',
          service: 'api-gateway',
          traceId,
          rrn,
          tx_type: txType,
          endpoint: `/api/v1/switching/${txType.toLowerCase()}`,
          client_ip: '10.244.2.14',
          authorization: `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwidXNlciI6InFjLXRlc3RlciJ9.987654321abcdef`,
          accountNumber: sourceAcc,
          destAccount: destAcc,
          amount,
          message: `[API-GW] Received incoming ${txType} HTTP request from Client. Route assigned: gate-service.traceId=${traceId}`
        })
      };
      this.emit('rawLog', gwInLog);
    }, 0);

    // Step 2: Gate Service (Business Routing & Transformation)
    setTimeout(() => {
      const gateLog = {
        timestamp: new Date().toISOString(),
        service: 'gate-service',
        podName: podGate,
        rawLine: `[${new Date().toISOString()}] [gate-service] INFO trace_id=${traceId} rrn=${rrn} tx_type=${txType} acc_no=${sourceAcc} - Validating KYC & routing rule. Dispatching to Transport Core ISO8583 handler.`
      };
      this.emit('rawLog', gateLog);
    }, 120 + Math.random() * 80);

    // Step 3: Transport Core SWC (ISO8583 Creation & Host Exchange)
    setTimeout(() => {
      const procCode = isPosting ? '000000' : '310000';
      const mtiReq = '0200';
      const transportIn = {
        timestamp: new Date().toISOString(),
        service: 'transport-core-swc',
        podName: podTransport,
        rawLine: `[${new Date().toISOString()}] [transport-core-swc] DEBUG trace_id=${traceId} rrn=${rrn} ProcCode=${procCode} MTI=${mtiReq} bit52=[PINBLOCK_D8A9F3218BC871A2] - Built ISO8583 Request Message. Sending TCP socket to Core Banking host 172.16.0.10:9000`
      };
      this.emit('rawLog', transportIn);
    }, 280 + Math.random() * 100);

    // Step 4: Transport Core SWC (Host Response)
    setTimeout(() => {
      const mtiResp = '0210';
      const transportOut = {
        timestamp: new Date().toISOString(),
        service: 'transport-core-swc',
        podName: podTransport,
        rawLine: JSON.stringify({
          timestamp: new Date().toISOString(),
          level: isSuccess ? 'INFO' : 'ERROR',
          service: 'transport-core-swc',
          traceId,
          rrn,
          mti: mtiResp,
          processingCode: isPosting ? '000000' : '310000',
          rc: isoRc,
          statusCode: isoRc,
          latencyMs: isSuccess ? Math.floor(180 + Math.random() * 90) : (isoRc === '68' ? 5000 : 120),
          message: `[TRANSPORT-SWC] Host response received. MTI=${mtiResp} RC=${isoRc} (${statusDesc}) for RRN=${rrn}`
        })
      };
      this.emit('rawLog', transportOut);
    }, 450 + (isoRc === '68' ? 800 : Math.random() * 150));

    // Step 5: Gate Service (Transform back)
    setTimeout(() => {
      const gateOut = {
        timestamp: new Date().toISOString(),
        service: 'gate-service',
        podName: podGate,
        rawLine: `[${new Date().toISOString()}] [gate-service] ${isSuccess ? 'INFO' : 'WARN'} trace_id=${traceId} rrn=${rrn} status_code=${isSuccess ? '00' : isoRc} - Core banking response normalized. Forwarding back to API Gateway.`
      };
      this.emit('rawLog', gateOut);
    }, 600 + Math.random() * 80);

    // Step 6: API Gateway (Response Sent)
    setTimeout(() => {
      const gwOut = {
        timestamp: new Date().toISOString(),
        service: 'api-gateway',
        podName: podGateway,
        rawLine: JSON.stringify({
          timestamp: new Date().toISOString(),
          level: isSuccess ? 'INFO' : 'ERROR',
          service: 'api-gateway',
          traceId,
          rrn,
          tx_type: txType,
          statusCode: String(httpStatus),
          duration_ms: Math.floor(650 + Math.random() * 150),
          message: `[API-GW] Completed HTTP ${httpStatus} response for ${txType} traceId=${traceId} rrn=${rrn} rc=${isoRc}`
        })
      };
      this.emit('rawLog', gwOut);
    }, 720 + Math.random() * 90);
  }
}
